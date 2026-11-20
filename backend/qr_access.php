<?php
/** Single-use QR access credentials. Secrets are never stored in plaintext. */
declare(strict_types=1);

/** Gate denials must throw: exiting from legacy fail() bypasses telemetry and rollback. */
final class GateRejection extends RuntimeException {
    public function __construct(string $message, public int $httpStatus=400) {
        parent::__construct($message);
    }
}
function gateReject(string $message,int $httpStatus=400): never {
    throw new GateRejection($message,$httpStatus);
}

function qrIssue(array $user, int $permitId): array {
    $permit = query('SELECT p.id,p.permit_code,p.expires_at,p.status,v.user_id,v.verification_status
      FROM permits p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=?', [$permitId])->fetch();
    if (!$permit) gateReject('Permit not found', 404);
    if ($user['role'] !== 'admin' && (int)$permit['user_id'] !== (int)$user['id']) gateReject('Not your permit', 403);
    $parked = (bool)query('SELECT 1 FROM parking_visits WHERE permit_id=? AND exit_at IS NULL LIMIT 1', [$permitId])->fetchColumn();
    if (!$parked && ($permit['status'] !== 'approved' || $permit['expires_at'] < date('Y-m-d') || $permit['verification_status'] !== 'verified')) {
        gateReject('No active parking access for this permit', 403);
    }
    $token = bin2hex(random_bytes(24));
    $hash = hash('sha256', $token);
    // A refresh invalidates previously issued unused tokens, reducing exposure.
    query('UPDATE qr_access_tokens SET expires_at=NOW() WHERE permit_id=? AND used_at IS NULL', [$permitId]);
    query('INSERT INTO qr_access_tokens(permit_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 60 SECOND))', [$permitId,$hash]);
    $expires = query('SELECT expires_at FROM qr_access_tokens WHERE token_hash=?', [$hash])->fetchColumn();
    return ['permit_code'=>$permit['permit_code'],'plate_number'=>null,
      'qr_payload'=>'CPD|'.$permit['permit_code'].'|'.$token,
      'expires_at'=>$expires,'lifetime_seconds'=>60];
}

function qrParse(string $payload): array {
    $parts = explode('|', trim($payload));
    if (count($parts)!==3 || $parts[0] !== 'CPD' || !preg_match('/^[A-Z0-9-]{6,35}$/', $parts[1]) || !preg_match('/^[a-f0-9]{48}$/D', $parts[2])) {
        gateReject('Invalid or old static QR. Open the live digital permit.', 403);
    }
    return [$parts[1],hash('sha256',$parts[2])];
}

function qrLookup(string $code, string $hash, bool $lock=false): array {
    $sql = 'SELECT t.id token_id,t.used_at,t.expires_at token_expires_at,p.id permit_id,p.status,p.expires_at permit_expires_at,
      v.id vehicle_id,v.plate_number,v.vehicle_type,v.brand,v.model,v.verification_status,u.full_name
      FROM qr_access_tokens t JOIN permits p ON p.id=t.permit_id
      JOIN vehicles v ON v.id=p.vehicle_id JOIN users u ON u.id=v.user_id
      WHERE t.token_hash=? AND p.permit_code=? LIMIT 1';
    $row=query($sql.($lock?' FOR UPDATE':''),[$hash,$code])->fetch();
    if (!$row) gateReject('QR not recognized', 403);
    if ($row['used_at']) gateReject('QR already used. Refresh the permit.', 409);
    if ((int)query('SELECT NOW() >= ?',[ $row['token_expires_at'] ])->fetchColumn()) gateReject('QR expired. Refresh the permit.', 409);
    return $row;
}

function qrVisit(int $vehicleId): array|false {
    return query('SELECT pv.id,pv.entry_at,s.id slot_id,s.code,a.name area
       FROM parking_visits pv JOIN parking_slots s ON s.id=pv.slot_id
       JOIN parking_areas a ON a.id=s.area_id
       WHERE pv.vehicle_id=? AND pv.exit_at IS NULL LIMIT 1',[$vehicleId])->fetch();
}

function qrLog(int $guardId, ?int $permitId, string $decision,string $reason): void {
    query('INSERT INTO gate_scan_attempts(guard_id,permit_id,decision,reason) VALUES(?,?,?,?)',[$guardId,$permitId,$decision,substr($reason,0,120)]);
}

function normalizePlate(string $plate): string {return strtoupper(preg_replace('/[^A-Z0-9]/i','',$plate));}

function qrGateVerify(array $user, array $input): array {
    [$code,$hash] = qrParse(need($input,'qr',200));
    $permit=qrLookup($code,$hash);
    $visit=qrVisit((int)$permit['vehicle_id']);
    if (!$visit && ($permit['status']!=='approved'||$permit['permit_expires_at']<date('Y-m-d')||$permit['verification_status']!=='verified')) gateReject('Permit not approved for entry',403);
    qrLog($user['id'],(int)$permit['permit_id'],'verified',$visit?'exit pending':'entry pending');
    return ['permit'=>[
      'id'=>(int)$permit['permit_id'],'plate_number'=>$permit['plate_number'],
      'vehicle_type'=>$permit['vehicle_type'],'brand'=>$permit['brand'],'model'=>$permit['model'],
      'full_name'=>$permit['full_name'],'expires_at'=>$permit['permit_expires_at']],
      'current_visit'=>$visit?:null,'suggested_action'=>$visit?'exit':'entry',
      'plate_confirmation_required'=>true,'automatic_slot_assignment'=>true];
}

function qrGateRecord(array $user, array $input): array {
    [$code,$hash] = qrParse(need($input,'qr',200));
    $action=oneof(need($input,'action'),['entry','exit'],'action');
    $plate=normalizePlate(need($input,'observed_plate',25));
    db()->beginTransaction();
    try {
        $p=qrLookup($code,$hash,true);
        if (!hash_equals(normalizePlate($p['plate_number']),$plate)) gateReject('Plate mismatch: do not admit vehicle',403);
        $visit=qrVisit((int)$p['vehicle_id']);
        $actual=$visit?'exit':'entry';
        if ($actual!==$action) gateReject('Anti-passback: vehicle state has changed; rescan',409);
        if ($action==='entry') {
            if ($p['status']!=='approved'||$p['permit_expires_at']<date('Y-m-d')||$p['verification_status']!=='verified') gateReject('Permit not valid for entry',403);
            // Allocation candidates are scored by preferred area, policy, free capacity
            // and vehicle fit. Every candidate slot is locked before admission.
            $candidates=allocationCandidates((int)$p['vehicle_id'],true);
            $slot=$candidates[0]??null;
            if (!$slot) gateReject('No available compatible parking slots',409);
            $stmt=query('CALL sp_record_parking_entry(?,?,?,?,?)',[$p['permit_id'],$p['vehicle_id'],$slot['id'],$p['plate_number'],$user['id']]);
            $stmt->closeCursor();
            $message='Entry recorded. Assigned '.$slot['area'].' / '.$slot['code'];
        } else {
            $slot=['id'=>$visit['slot_id'],'code'=>$visit['code'],'area'=>$visit['area']];
            $stmt=query('CALL sp_record_parking_exit(?,?)',[$p['vehicle_id'],$user['id']]);
            $stmt->closeCursor();
            $message='Exit recorded. Slot released.';
        }
        query('UPDATE qr_access_tokens SET used_at=NOW(),used_by=? WHERE id=? AND used_at IS NULL',[$user['id'],$p['token_id']]);
        qrLog($user['id'],(int)$p['permit_id'],$action==='entry'?'allowed_entry':'allowed_exit','plate confirmed');
        audit($user,'gate.'.$action,$p['plate_number']);
        db()->commit();
        return ['message'=>$message,'action'=>$action,'plate_number'=>$p['plate_number'],
          'slot'=>['id'=>(int)$slot['id'],'code'=>$slot['code'],'area'=>$slot['area']]];
    } catch (Throwable $e) {
        if(db()->inTransaction())db()->rollBack();
        throw $e;
    }
}
