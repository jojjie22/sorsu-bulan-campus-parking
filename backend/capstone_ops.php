<?php
/** Shared validation and transaction logic for the capstone operational modules. */
declare(strict_types=1);
require_once __DIR__.'/allocation.php';

function capstoneMigrationReady(): bool {
    return (int)query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('gate_processing_metrics','parking_reconciliation_requests','parking_area_policies','parking_inspections','gate_queue_arrivals','user_parking_preferences')")->fetchColumn()===6;
}
function metricDuration(float $started): int {return (int)max(0,min(600000,round((microtime(true)-$started)*1000)));}
function measuredMs(array $input,string $key): ?int {
    if (!isset($input[$key]) || $input[$key]==='') return null;
    if (!is_numeric($input[$key])) return null;
    return max(0,min(600000,(int)$input[$key]));
}
function gateMetric(array $user,array $input,string $phase,string $outcome,float $started,?int $permitId=null,?string $plate=null,string $reason=''): void {
    $arrivalId=isset($input['arrival_id'])&&ctype_digit((string)$input['arrival_id'])?(int)$input['arrival_id']:null;
    $label=substr(trim((string)($input['gate_label']??'Main Gate')),0,40) ?: 'Main Gate';
    $wait=null;
    if ($arrivalId && $phase==='transaction' && $outcome!=='denied') {
        $arrival=query('SELECT arrived_at FROM gate_queue_arrivals WHERE id=? AND guard_id=? AND completed_at IS NULL FOR UPDATE',[$arrivalId,$user['id']])->fetch();
        if ($arrival) {
            $wait=(int)query('SELECT TIMESTAMPDIFF(MICROSECOND,?,NOW(3)) DIV 1000',[$arrival['arrived_at']])->fetchColumn();
            query('UPDATE gate_queue_arrivals SET completed_at=NOW(3) WHERE id=?',[$arrivalId]);
        } else $arrivalId=null;
    }
    if ($arrivalId && $phase==='verification') $arrivalId=null; // Arrival is claimed only on final transaction.
    query('INSERT INTO gate_processing_metrics(guard_id,queue_arrival_id,permit_id,plate_number,gate_label,phase,outcome,reason,server_duration_ms,client_scan_ms,client_confirm_ms,wait_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[
        $user['id'],$arrivalId,$permitId,$plate,$label,$phase,$outcome,substr($reason,0,160),metricDuration($started),
        measuredMs($input,'scan_ms'),measuredMs($input,'confirm_ms'),$wait]);
}
function reportGateMetrics(array $args): array {
    $start=(string)($args['start']??date('Y-m-d',strtotime('-6 days')));
    $end=(string)($args['end']??date('Y-m-d'));
    foreach([$start,$end] as $v){if (!preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)||!checkdate((int)substr($v,5,2),(int)substr($v,8,2),(int)substr($v,0,4))) gateReject('Invalid report date');}
    if($start>$end)fail('Start date must precede end date');
    $summary=query("SELECT COUNT(*) attempts,SUM(outcome='denied') denied,SUM(outcome='entry') entries,SUM(outcome='exit') exits,
      ROUND(AVG(CASE WHEN outcome IN ('entry','exit') THEN client_confirm_ms END)) avg_confirm_ms,
      ROUND(AVG(CASE WHEN outcome IN ('entry','exit') THEN wait_ms END)) avg_wait_ms,
      ROUND(AVG(server_duration_ms)) avg_server_ms
      FROM gate_processing_metrics WHERE phase='transaction' AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY)",[$start,$end])->fetch();
    $scanSummary=query("SELECT COUNT(*) scans,SUM(outcome='verified') verified_scans,SUM(outcome='denied') rejected_scans,ROUND(AVG(client_scan_ms)) avg_scan_ms FROM gate_processing_metrics WHERE phase='verification' AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY)",[$start,$end])->fetch();
    $hourly=query('SELECT day,hour_of_day,gate_label,attempts,entries,exits,denied,avg_confirmation_ms,avg_wait_ms FROM vw_gate_hourly_traffic WHERE day BETWEEN ? AND ? ORDER BY day DESC,hour_of_day DESC',[$start,$end])->fetchAll();
    $recent=query('SELECT m.*,u.full_name guard_name FROM gate_processing_metrics m JOIN users u ON u.id=m.guard_id WHERE m.created_at>=? AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY) ORDER BY m.created_at DESC LIMIT 150',[$start,$end])->fetchAll();
    return ['summary'=>$summary,'scans'=>$scanSummary,'hourly'=>$hourly,'recent'=>$recent,'start'=>$start,'end'=>$end];
}
function inspectSpace(array $user,array $input): array {
    $slot=id($input,'slot_id');
    $status=oneof(need($input,'observed_status'),['occupied','empty'],'observed status');
    $plate=$status==='occupied'?normalizePlate(need($input,'observed_plate',25)):null;
    $note=optional($input,'notes',500);
    if (!query('SELECT id FROM parking_slots WHERE id=?',[$slot])->fetchColumn()) gateReject('Parking slot not found',404);
    query('INSERT INTO parking_inspections(slot_id,guard_id,observed_status,observed_plate,notes) VALUES(?,?,?,?,?)',[$slot,$user['id'],$status,$plate,$note]);
    $inspectionId=(int)db()->lastInsertId();
    $row=query('SELECT * FROM vw_latest_parking_inspections WHERE id=?',[$inspectionId])->fetch();
    audit($user,'inspection.create','inspection='.$inspectionId.'; slot='.$slot);
    return $row;
}
function requestReconciliation(array $user,array $input): array {
    $inspection=id($input,'inspection_id');$reason=need($input,'reason',500);
    if(mb_strlen($reason)<12)fail('Provide a meaningful reason (at least 12 characters)');
    $row=query('SELECT * FROM vw_latest_parking_inspections WHERE id=?',[$inspection])->fetch();
    if(!$row || !(int)$row['mismatch'])fail('Inspection is no longer the latest discrepancy for that slot',409);
    $action=$row['observed_status']==='empty'?'close_missing_exit':'open_missing_entry';
    if($action==='open_missing_entry' && $row['recorded_status']==='occupied') gateReject('Slot contains a different recorded vehicle; supervisor must investigate before correction',409);
    $permitId=null;
    if($action==='open_missing_entry'){
        $permit=query("SELECT p.id FROM permits p JOIN vehicles v ON v.id=p.vehicle_id WHERE v.plate_number=? AND v.verification_status='verified' AND p.status='approved' AND p.expires_at>=CURDATE() ORDER BY p.id DESC LIMIT 1",[$row['observed_plate']])->fetchColumn();
        if(!$permit)fail('No active approved permit for observed plate',409);
        $permitId=(int)$permit;
    }
    if(query("SELECT id FROM parking_reconciliation_requests WHERE inspection_id=? AND status='pending'",[$inspection])->fetch())fail('Pending request already exists',409);
    query('INSERT INTO parking_reconciliation_requests(inspection_id,slot_id,action,visit_id,permit_id,observed_plate,reason,requested_by) VALUES(?,?,?,?,?,?,?,?)',[
        $inspection,$row['slot_id'],$action,$row['recorded_visit_id'],$permitId,$row['observed_plate'],$reason,$user['id']]);
    $requestId=(int)db()->lastInsertId();
    audit($user,'reconciliation.request','request='.$requestId.'; action='.$action);
    return ['id'=>$requestId,'action'=>$action,'status'=>'pending'];
}
function reviewReconciliation(array $user,array $input): array {
    $requestId=id($input);$decision=oneof(need($input,'decision'),['approved','rejected'],'decision');
    $resolution=need($input,'resolution',500);
    db()->beginTransaction();
    try{
        $r=query('SELECT * FROM parking_reconciliation_requests WHERE id=? FOR UPDATE',[$requestId])->fetch();
        if (!$r || $r['status']!=='pending')fail('Request is not pending',409);
        if((int)$r['requested_by']===$user['id']) gateReject('A different administrator must review their own request',403);
        if($decision==='approved'){
            $latest=query('SELECT * FROM vw_latest_parking_inspections WHERE slot_id=?',[$r['slot_id']])->fetch();
            if (!$latest || (int)$latest['id']!==(int)$r['inspection_id'])fail('New inspection exists; request a fresh reconciliation',409);
            if($r['action']==='close_missing_exit'){
                $visit=query('SELECT id,exit_at FROM parking_visits WHERE id=? FOR UPDATE',[$r['visit_id']])->fetch();
                if(!$visit || $visit['exit_at']!==null)fail('Visit already closed',409);
                query('UPDATE parking_visits SET exit_at=NOW(),exit_guard_id=? WHERE id=? AND exit_at IS NULL',[$user['id'],$r['visit_id']]);
            }else{
                $permit=query('SELECT p.id,p.vehicle_id,v.plate_number,v.vehicle_type FROM permits p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=? AND p.status=\'approved\' AND p.expires_at>=CURDATE() AND v.verification_status=\'verified\' FOR UPDATE',[$r['permit_id']])->fetch();
                if (!$permit || normalizePlate($permit['plate_number'])!==normalizePlate($r['observed_plate'])) gateReject('Permit or plate no longer valid',409);
                $slot=query('SELECT id,status,vehicle_type FROM parking_slots WHERE id=? FOR UPDATE',[$r['slot_id']])->fetch();
                if(!$slot || $slot['status']!=='active' || !in_array($slot['vehicle_type'],['any',$permit['vehicle_type']],true))fail('Slot unavailable for this vehicle',409);
                if(query('SELECT id FROM parking_visits WHERE slot_id=? AND exit_at IS NULL',[$r['slot_id']])->fetch()) gateReject('Slot occupied since inspection',409);
                if(query('SELECT id FROM parking_visits WHERE vehicle_id=? AND exit_at IS NULL',[$permit['vehicle_id']])->fetch())fail('Vehicle already inside campus',409);
                // Recorded as a supervised correction, not as a scanned QR gate admission.
                query('INSERT INTO parking_visits(permit_id,vehicle_id,slot_id,plate_number,entry_guard_id) VALUES(?,?,?,?,?)',[$permit['id'],$permit['vehicle_id'],$r['slot_id'],$permit['plate_number'],$user['id']]);
            }
        }
        query('UPDATE parking_reconciliation_requests SET status=?,reviewed_by=?,reviewed_at=NOW(),resolution=? WHERE id=?',[$decision,$user['id'],$resolution,$requestId]);
        audit($user,'reconciliation.review','request='.$requestId.'; decision='.$decision.'; '.$resolution);
        db()->commit();return ['message'=>'Reconciliation '.$decision];
    }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
}
