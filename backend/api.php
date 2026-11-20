<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/qr_access.php';
require_once __DIR__ . '/capstone_ops.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// This app uses same-origin Vite proxy in development and Apache in production.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
function reply(mixed $data, int $status = 200): never { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function fail(string $message, int $status = 400): never { reply(['error' => $message], $status); }
function body(): array { $a = json_decode(file_get_contents('php://input') ?: '{}', true); if (!is_array($a)) fail('Invalid JSON request'); return $a; }
function need(array $data, string $key, int $max = 255): string { $v = trim((string)($data[$key] ?? '')); if ($v === '' || mb_strlen($v) > $max) fail('Invalid or missing ' . str_replace('_',' ',$key)); return $v; }
function optional(array $data, string $key, int $max = 255): string { $v = trim((string)($data[$key] ?? '')); if (mb_strlen($v) > $max) fail('Invalid ' . $key); return $v; }
function oneof(string $v, array $options, string $label): string { if (!in_array($v, $options, true)) fail('Invalid ' . $label); return $v; }
function id(array $data, string $key='id'): int { $v=filter_var($data[$key] ?? null,FILTER_VALIDATE_INT); if (!$v || $v < 1) fail('Invalid ' . $key); return $v; }
function token(): ?string { $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''; return preg_match('/^Bearer ([a-f0-9]{64})$/i', $h, $m) ? $m[1] : null; }
function auth(): array {
    $t = token(); if (!$t) fail('Please sign in',401);
    $s=query('SELECT u.id,u.full_name,u.email,u.role,u.student_employee_id,u.active FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at > NOW() LIMIT 1', [hash('sha256',$t)]);
    $u=$s->fetch(); if (!$u || !$u['active']) fail('Session expired or account inactive',401);
    $u['id']=(int)$u['id']; return $u;
}
function allow(array $u, string ...$roles): void { if (!in_array($u['role'],$roles,true)) fail('You do not have permission for this action',403); }
function audit(array $u, string $action, string $details=''): void { query('INSERT INTO audit_logs(user_id,action,details) VALUES (?,?,?)',[$u['id'],$action,$details]); }
function setting(string $key,string $fallback): string { $v=query('SELECT value FROM settings WHERE `key`=?',[$key])->fetchColumn();return $v===false?$fallback:(string)$v; }
function slotsSql(): string {return 'SELECT * FROM vw_parking_availability';}
function uniqueCode(): string {return 'CPM-'.date('Y').'-'.strtoupper(bin2hex(random_bytes(5)));}
try {
    $route=trim((string)($_GET['route'] ?? ''),'/');
    $method=$_SERVER['REQUEST_METHOD'];
    if ($route==='health' && $method==='GET') {
        $tableCount=(int)query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users','auth_tokens','parking_slots')")->fetchColumn();
        if ($tableCount < 3) fail('Database tables are missing. Import database/campus_parking.sql in phpMyAdmin.',503);
        $accountCount=(int)query('SELECT COUNT(*) FROM users')->fetchColumn();
        // ADMS migration status helps diagnose missing procedures before gate use.
        $routineCount=(int)query("SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_NAME IN ('sp_record_parking_entry','sp_record_parking_exit','sp_expire_parking_permits')")->fetchColumn();
        reply(['ok'=>true,'service'=>'campus-parking','database'=>'connected','accounts_seeded'=>$accountCount>0,'account_count'=>$accountCount,'adms_installed'=>$routineCount===3,'capstone_ops_installed'=>capstoneMigrationReady(),'dynamic_qr_installed'=>(int)query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('qr_access_tokens','gate_scan_attempts')")->fetchColumn()===2]);
    }
    if ($route==='login' && $method==='POST') {
        $a=body(); $email=strtolower(need($a,'email',190));$password=(string)($a['password']??'');
        $u=query('SELECT * FROM users WHERE email=? LIMIT 1',[$email])->fetch();
        if (!$u || !$u['active'] || !password_verify($password,$u['password_hash'])) fail('Invalid email or password, or account inactive. If using demo credentials, run backend/seed.php first.',401);
        $t=bin2hex(random_bytes(32)); query('INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))',[$u['id'],hash('sha256',$t)]);
        unset($u['password_hash']); $u['id']=(int)$u['id'];reply(['token'=>$t,'user'=>$u]);
    }
    if ($route==='register' && $method==='POST') {
        $a=body();$name=need($a,'full_name',140);$email=strtolower(need($a,'email',190));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Invalid email');
        $role=oneof(need($a,'role'),['student','faculty'],'role');
        $ref=need($a,'student_employee_id',60);$p=(string)($a['password']??'');if(strlen($p)<8)fail('Password must contain at least 8 characters');
        try { query('INSERT INTO users(full_name,email,password_hash,role,student_employee_id) VALUES (?,?,?,?,?)',[$name,$email,password_hash($p,PASSWORD_DEFAULT),$role,$ref]); }
        catch(PDOException $e){if($e->getCode()==='23000')fail('Email or ID is already registered',409);throw $e;}
        reply(['message'=>'Account created. Please sign in.'],201);
    }
    $u=auth();
    if ($route==='me' && $method==='GET') reply(['user'=>$u]);
    if ($route==='logout' && $method==='POST') { if ($t=token()) query('DELETE FROM auth_tokens WHERE token_hash=?',[hash('sha256',$t)]); reply(['message'=>'Signed out']); }
    if ($route==='summary' && $method==='GET') {
        $tot=(int)query("SELECT COUNT(*) FROM parking_slots WHERE status='active'")->fetchColumn();
        $occupied=(int)query('SELECT COUNT(*) FROM parking_visits WHERE exit_at IS NULL')->fetchColumn();
        $vehicles=(int)query("SELECT COUNT(*) FROM vehicles WHERE verification_status='verified'")->fetchColumn();
        $permits=(int)query('SELECT COUNT(*) FROM vw_active_permits')->fetchColumn();
        $today=(int)query('SELECT COUNT(*) FROM parking_visits WHERE DATE(entry_at)=CURDATE()')->fetchColumn();
        $byArea=query("SELECT name,total,active,occupied FROM vw_parking_area_summary ORDER BY name")->fetchAll();
        $trend=query("SELECT DATE(entry_at) AS day, COUNT(*) AS entries FROM parking_visits WHERE entry_at >= DATE_SUB(CURDATE(),INTERVAL 6 DAY) GROUP BY DATE(entry_at) ORDER BY day")->fetchAll();
        $mine=$u['role']==='student'||$u['role']==='faculty';
        $myVehicles=$mine?(int)query('SELECT COUNT(*) FROM vehicles WHERE user_id=?',[$u['id']])->fetchColumn():null;
        $myPermits=$mine?(int)query('SELECT COUNT(*) FROM vw_active_permits a JOIN vehicles v ON v.id=a.vehicle_id WHERE v.user_id=?',[$u['id']])->fetchColumn():null;
        reply(['total_slots'=>$tot,'occupied'=>$occupied,'available'=>max(0,$tot-$occupied),'vehicles'=>$vehicles,'active_permits'=>$permits,'today_entries'=>$today,'by_area'=>$byArea,'trend'=>$trend,'my_vehicles'=>$myVehicles,'my_permits'=>$myPermits]);
    }
    if ($route==='areas' && $method==='GET') reply(['items'=>query('SELECT * FROM parking_areas ORDER BY name')->fetchAll()]);
    if ($route==='areas' && $method==='POST') {allow($u,'admin');$a=body();$name=need($a,'name',100);try{query('INSERT INTO parking_areas(name) VALUES (?)',[$name]);}catch(PDOException $e){if($e->getCode()==='23000')fail('Area already exists',409);throw $e;}audit($u,'area.create',$name);reply(['message'=>'Area created'],201);}
    if ($route==='slots' && $method==='GET') { $items=query(slotsSql().' ORDER BY area,code')->fetchAll();reply(['items'=>$items]); }
    if ($route==='slots' && $method==='POST') {
        allow($u,'admin');$a=body();$area=id($a,'area_id');$code=strtoupper(need($a,'code',30));$type=oneof(need($a,'vehicle_type'),['car','motorcycle','any'],'vehicle type');
        if (!query('SELECT id FROM parking_areas WHERE id=?',[$area])->fetch()) fail('Area not found');
        try {query('INSERT INTO parking_slots(area_id,code,vehicle_type) VALUES (?,?,?)',[$area,$code,$type]);}catch(PDOException $e){if($e->getCode()==='23000')fail('Slot code already exists in this area',409);throw $e;}
        audit($u,'slot.create',$code);reply(['message'=>'Slot created'],201);
    }
    if ($route==='slots/update' && $method==='POST') {
        allow($u,'admin');$a=body();$slot=id($a);$area=id($a,'area_id');$code=strtoupper(need($a,'code',30));$type=oneof(need($a,'vehicle_type'),['car','motorcycle','any'],'vehicle type');$status=oneof(need($a,'status'),['active','unavailable'],'slot status');
        if ($status==='unavailable' && (int)query('SELECT COUNT(*) FROM parking_visits WHERE slot_id=? AND exit_at IS NULL',[$slot])->fetchColumn())fail('Cannot deactivate an occupied slot');
        try{query('UPDATE parking_slots SET area_id=?,code=?,vehicle_type=?,status=? WHERE id=?',[$area,$code,$type,$status,$slot]);}catch(PDOException $e){if($e->getCode()==='23000')fail('Duplicate slot code',409);throw $e;}
        audit($u,'slot.update',(string)$slot);reply(['message'=>'Slot updated']);
    }
    if ($route==='vehicles' && $method==='GET') {
        $sql='SELECT v.*,u.full_name,u.email FROM vehicles v JOIN users u ON u.id=v.user_id';$p=[];
        if(in_array($u['role'],['student','faculty'],true)){$sql.=' WHERE v.user_id=?';$p=[$u['id']];}
        reply(['items'=>query($sql.' ORDER BY v.created_at DESC',$p)->fetchAll()]);
    }
    if ($route==='vehicles' && $method==='POST') {
        allow($u,'student','faculty');$a=body();$plate=strtoupper(preg_replace('/\s+/','',need($a,'plate_number',20)));$type=oneof(need($a,'vehicle_type'),['car','motorcycle'],'vehicle type');
        $brand=need($a,'brand',70);$model=need($a,'model',70);$color=need($a,'color',40);$ownership=oneof(need($a,'ownership'),['owned','family','authorized'],'ownership');
        try{query('INSERT INTO vehicles(user_id,plate_number,vehicle_type,brand,model,color,ownership) VALUES (?,?,?,?,?,?,?)',[$u['id'],$plate,$type,$brand,$model,$color,$ownership]);}catch(PDOException $e){if($e->getCode()==='23000')fail('Plate number already registered',409);throw $e;}
        audit($u,'vehicle.register',$plate);reply(['message'=>'Vehicle submitted for verification'],201);
    }
    if ($route==='vehicles/verify' && $method==='POST') {
        allow($u,'admin');$a=body();$vid=id($a);$status=oneof(need($a,'status'),['verified','rejected'],'verification status');
        $changed=query("UPDATE vehicles SET verification_status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND verification_status='pending'",[$status,$u['id'],$vid])->rowCount();
        if(!$changed)fail('Vehicle not found or already reviewed',409);audit($u,'vehicle.verify',"$vid:$status");reply(['message'=>'Vehicle '.$status]);
    }
    if ($route==='permits' && $method==='GET') {
        $sql='SELECT p.*,v.plate_number,v.vehicle_type,v.brand,v.model,v.user_id,u.full_name,u.email, EXISTS(SELECT 1 FROM parking_visits pv WHERE pv.permit_id=p.id AND pv.exit_at IS NULL) AS active_visit FROM permits p JOIN vehicles v ON v.id=p.vehicle_id JOIN users u ON u.id=v.user_id';$params=[];
        if(in_array($u['role'],['student','faculty'],true)){$sql.=' WHERE v.user_id=?';$params=[$u['id']];}
        $rows=query($sql.' ORDER BY p.created_at DESC',$params)->fetchAll();
        foreach($rows as &$r){$r['qr_available']=(($r['status']==='approved' && $r['expires_at']>=date('Y-m-d')) || (bool)$r['active_visit']);unset($r['qr_secret']);}unset($r);
        reply(['items'=>$rows]);
    }
    if ($route==='permits' && $method==='POST') {
        allow($u,'student','faculty');$a=body();$vid=id($a,'vehicle_id');
        $vehicle=query("SELECT * FROM vehicles WHERE id=? AND user_id=?",[$vid,$u['id']])->fetch();if(!$vehicle)fail('Vehicle not found',404);
        if($vehicle['verification_status']!=='verified')fail('Vehicle must be verified first');
        if((int)query("SELECT COUNT(*) FROM permits WHERE vehicle_id=? AND (status='pending' OR (status='approved' AND expires_at>=CURDATE()))",[$vid])->fetchColumn())fail('This vehicle has a pending or active permit',409);
        query("INSERT INTO permits(vehicle_id,status) VALUES(?,'pending')",[$vid]);audit($u,'permit.request',(string)$vid);reply(['message'=>'Permit application submitted'],201);
    }
    // Live QR: a fresh credential expires in 60 seconds, even if the permit is valid for months.
    if ($route==='permits/qr' && $method==='GET') {
        $pid=filter_var($_GET['id'] ?? null,FILTER_VALIDATE_INT);
        if (!$pid || $pid < 1) fail('Invalid permit ID');
        $data=qrIssue($u,(int)$pid);
        audit($u,'permit.dynamic_qr',(string)$pid);
        reply($data);
    }
    // Old static QR image endpoint is deliberately disabled: cached images are replayable.
    if ($route==='permits/qr-image' && $method==='GET') {
        fail('Static QR downloads are disabled. Open your live permit QR instead.',410);
    }
    if ($route==='permits/review' && $method==='POST') {
        allow($u,'admin');$a=body();$pid=id($a);$status=oneof(need($a,'status'),['approved','rejected'],'permit decision');
        db()->beginTransaction();
        try{
            $permit=query('SELECT p.*,v.verification_status,v.user_id FROM permits p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=? FOR UPDATE',[$pid])->fetch();
            if(!$permit || $permit['status']!=='pending')fail('Permit not pending',409);
            if($status==='approved' && $permit['verification_status']!=='verified') fail('Vehicle is not verified');
            if($status==='approved'){
                if((int)query("SELECT COUNT(*) FROM permits WHERE vehicle_id=? AND id<>? AND status='approved' AND expires_at>=CURDATE()",[$permit['vehicle_id'],$pid])->fetchColumn())fail('Vehicle already has an active permit',409);
                query("UPDATE permits SET status='approved',permit_code=?,qr_secret=?,issued_at=CURDATE(),expires_at=DATE_ADD(CURDATE(),INTERVAL 6 MONTH),reviewed_by=?,reviewed_at=NOW() WHERE id=?",[uniqueCode(),bin2hex(random_bytes(24)),$u['id'],$pid]);
            }else{query("UPDATE permits SET status='rejected',reviewed_by=?,reviewed_at=NOW() WHERE id=?",[$u['id'],$pid]);}
            audit($u,'permit.review',"$pid:$status");db()->commit();reply(['message'=>'Permit '.$status]);
        }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
    }
    // Gate telemetry is recorded after every verification or transaction attempt.
    // Client durations are labeled estimates; server durations are measured here.
    if ($route==='gate/arrival' && $method==='POST') {
        allow($u,'guard','admin');$a=body();
        $label=optional($a,'gate_label',40) ?: 'Main Gate';
        query('INSERT INTO gate_queue_arrivals(guard_id,gate_label) VALUES(?,?)',[$u['id'],$label]);
        reply(['arrival_id'=>(int)db()->lastInsertId(),'message'=>'Vehicle arrival marked']);
    }
    if ($route==='gate/verify' && $method==='POST') {
        allow($u,'guard','admin');$a=body();$started=microtime(true);
        try {
            $result=qrGateVerify($u,$a);
            try {gateMetric($u,$a,'verification','verified',$started,(int)$result['permit']['id'],$result['permit']['plate_number']);} catch(Throwable $logError) {error_log('Metric error: '.$logError->getMessage());}
            reply($result);
        } catch(Throwable $e) {
            try {gateMetric($u,$a,'verification','denied',$started,null,null,$e->getMessage());} catch(Throwable $logError) {error_log('Metric error: '.$logError->getMessage());}
            throw $e;
        }
    }
    if (in_array($route,['gate/record','gate/entry','gate/exit'],true) && $method==='POST') {
        allow($u,'guard','admin');$a=body();$started=microtime(true);
        if ($route==='gate/entry') $a['action']='entry';
        if ($route==='gate/exit') $a['action']='exit';
        try {
            $result=qrGateRecord($u,$a);
            try {gateMetric($u,$a,'transaction',$result['action'],$started,null,$result['plate_number']);} catch(Throwable $logError) {error_log('Metric error: '.$logError->getMessage());}
            reply($result);
        } catch (Throwable $e) {
            try {gateMetric($u,$a,'transaction','denied',$started,null,null,$e->getMessage());} catch(Throwable $logError) {error_log('Metric error: '.$logError->getMessage());}
            if ($e instanceof PDOException && $e->getCode()==='23000') fail('Anti-passback: duplicate entry or occupied parking slot.',409);
            if ($e instanceof PDOException && $e->getCode()==='45000') fail('Gate rejected transaction. Rescan QR and verify vehicle details.',409);
            throw $e;
        }
    }
    if ($route==='gate/metrics' && $method==='GET') {
        allow($u,'admin','guard');reply(reportGateMetrics($_GET));
    }
    if ($route==='allocation/preference' && $method==='GET') {
        $value=query('SELECT preferred_area_id FROM user_parking_preferences WHERE user_id=?',[$u['id']])->fetchColumn();
        reply(['preferred_area_id'=>$value===false?null:(int)$value]);
    }
    if ($route==='allocation/preference' && $method==='POST') {
        allow($u,'student','faculty');$a=body();
        if (empty($a['preferred_area_id'])) {query('DELETE FROM user_parking_preferences WHERE user_id=?',[$u['id']]);reply(['message'=>'Area preference cleared']);}
        $area=id($a,'preferred_area_id');
        if(!query('SELECT id FROM parking_areas WHERE id=?',[$area])->fetch())fail('Unknown area',404);
        query('INSERT INTO user_parking_preferences(user_id,preferred_area_id) VALUES(?,?) ON DUPLICATE KEY UPDATE preferred_area_id=VALUES(preferred_area_id)',[$u['id'],$area]);
        audit($u,'allocation.preference',(string)$area);reply(['message'=>'Preferred area saved']);
    }
    if ($route==='allocation/policies' && $method==='GET') {
        allow($u,'admin','guard');
        reply(['items'=>query('SELECT a.id,a.name,COALESCE(p.allocation_priority,50) allocation_priority,COALESCE(p.enabled,1) enabled FROM parking_areas a LEFT JOIN parking_area_policies p ON p.area_id=a.id ORDER BY a.name')->fetchAll()]);
    }
    if ($route==='allocation/policies' && $method==='POST') {
        allow($u,'admin');$a=body();$area=id($a,'area_id');$priority=(int)($a['allocation_priority']??50);
        if($priority<0||$priority>100)fail('Priority must be 0–100');
        $enabled=isset($a['enabled'])?(int)(bool)$a['enabled']:1;
        if(!query('SELECT id FROM parking_areas WHERE id=?',[$area])->fetch())fail('Unknown area',404);
        query('INSERT INTO parking_area_policies(area_id,allocation_priority,enabled) VALUES(?,?,?) ON DUPLICATE KEY UPDATE allocation_priority=VALUES(allocation_priority),enabled=VALUES(enabled)',[$area,$priority,$enabled]);
        audit($u,'allocation.policy','area='.$area.'; priority='.$priority.'; enabled='.$enabled);reply(['message'=>'Area allocation policy saved']);
    }
    if ($route==='allocation/evaluate' && $method==='GET') {
        allow($u,'admin','guard');
        $vehicle=filter_var($_GET['vehicle_id']??null,FILTER_VALIDATE_INT);
        if (!$vehicle) fail('Select a registered vehicle');
        $candidates=allocationCandidates((int)$vehicle);
        $baseline=$candidates;
        usort($baseline,static fn($a,$b)=>strcmp($a['area'],$b['area'])?:strcmp($a['code'],$b['code']));
        reply(['recommended'=>array_slice($candidates,0,10),'baseline'=>$baseline[0]??null,
          'total_candidates'=>count($candidates),'chosen'=>$candidates[0]??null,
          'method'=>'weighted: preference + policy + free capacity ratio + vehicle fit; deterministic baseline alphabetical']);
    }
    if ($route==='inspections' && $method==='GET') {
        allow($u,'admin','guard');
        reply(['items'=>query('SELECT i.*,u.full_name inspector_name FROM vw_latest_parking_inspections i JOIN users u ON u.id=i.guard_id ORDER BY i.created_at DESC LIMIT 250')->fetchAll()]);
    }
    if ($route==='inspections' && $method==='POST') {
        allow($u,'admin','guard');reply(['item'=>inspectSpace($u,body())],201);
    }
    if ($route==='reconciliations' && $method==='GET') {
        allow($u,'admin','guard');
        $rows=query('SELECT r.*,s.code slot_code,a.name area,u.full_name requester,reviewer.full_name reviewer FROM parking_reconciliation_requests r JOIN parking_slots s ON s.id=r.slot_id JOIN parking_areas a ON a.id=s.area_id JOIN users u ON u.id=r.requested_by LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by ORDER BY r.created_at DESC LIMIT 250')->fetchAll();
        reply(['items'=>$rows]);
    }
    if ($route==='reconciliations' && $method==='POST') {
        allow($u,'admin','guard');reply(['request'=>requestReconciliation($u,body())],201);
    }
    if ($route==='reconciliations/review' && $method==='POST') {
        allow($u,'admin');reply(reviewReconciliation($u,body()));
    }
    if ($route==='visits' && $method==='GET') {
        allow($u,'guard','admin');
        $rows=query('SELECT pv.id,pv.plate_number,pv.entry_at,pv.exit_at,s.code AS slot,a.name AS area,ue.full_name AS entry_guard,ux.full_name AS exit_guard FROM parking_visits pv JOIN parking_slots s ON s.id=pv.slot_id JOIN parking_areas a ON a.id=s.area_id LEFT JOIN users ue ON ue.id=pv.entry_guard_id LEFT JOIN users ux ON ux.id=pv.exit_guard_id ORDER BY pv.entry_at DESC LIMIT 250')->fetchAll();reply(['items'=>$rows]);
    }
    if ($route==='users' && $method==='GET') {allow($u,'admin');reply(['items'=>query('SELECT id,full_name,email,role,student_employee_id,active,created_at FROM users ORDER BY created_at DESC')->fetchAll()]);}
    if ($route==='users/update' && $method==='POST') {
        allow($u,'admin');$a=body();$uid=id($a);$role=oneof(need($a,'role'),['admin','guard','student','faculty'],'role');$active=(int)(bool)($a['active']??false);
        if($uid===$u['id'] && ($role!=='admin'||!$active))fail('Cannot remove your own administrator access');
        $changed=query('UPDATE users SET role=?,active=? WHERE id=?',[$role,$active,$uid])->rowCount();
        if(!$changed&&!query('SELECT id FROM users WHERE id=?',[$uid])->fetch())fail('User not found',404);
        audit($u,'user.update',(string)$uid);reply(['message'=>'User updated']);
    }
    if ($route==='users/create' && $method==='POST') {
        allow($u,'admin');$a=body();$name=need($a,'full_name',140);$email=strtolower(need($a,'email',190));$ref=need($a,'student_employee_id',60);
        if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Invalid email');$role=oneof(need($a,'role'),['admin','guard','student','faculty'],'role');$p=(string)($a['password']??'');if(strlen($p)<8)fail('Password must contain at least 8 characters');
        try{query('INSERT INTO users(full_name,email,student_employee_id,role,password_hash) VALUES (?,?,?,?,?)',[$name,$email,$ref,$role,password_hash($p,PASSWORD_DEFAULT)]);}catch(PDOException $e){if($e->getCode()==='23000')fail('Email or ID already exists',409);throw $e;}
        audit($u,'user.create',$email);reply(['message'=>'Account created'],201);
    }
    if ($route==='settings' && $method==='GET') {allow($u,'admin');reply(['items'=>query('SELECT `key`,value FROM settings ORDER BY `key`')->fetchAll()]);}
    if ($route==='settings' && $method==='POST') {
        allow($u,'admin');$a=body();$key=oneof(need($a,'key'),['campus_name','parking_hours'],'setting');$value=need($a,'value',200);
        query('INSERT INTO settings(`key`,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[$key,$value]);audit($u,'settings.update',$key);reply(['message'=>'Setting saved']);
    }
    if ($route==='reports' && $method==='GET') {
        allow($u,'admin');
        $start=$_GET['start']??date('Y-m-01');$end=$_GET['end']??date('Y-m-d');
        foreach([$start,$end] as $d){if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$d)||!strtotime($d))fail('Invalid date range');}
        if($start>$end)fail('Start date must be before end date');
        $daily=query('SELECT day,entries,exits FROM vw_daily_parking_activity WHERE day>=? AND day<=? ORDER BY day',[$start,$end])->fetchAll();
        $byArea=query('SELECT a.name AS area,COUNT(*) AS entries FROM parking_visits pv JOIN parking_slots s ON s.id=pv.slot_id JOIN parking_areas a ON a.id=s.area_id WHERE pv.entry_at>=? AND pv.entry_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY a.id,a.name ORDER BY entries DESC',[$start,$end])->fetchAll();
        reply(['daily'=>$daily,'by_area'=>$byArea]);
    }
    if ($route==='audit' && $method==='GET') {allow($u,'admin');reply(['items'=>query('SELECT l.id,u.full_name,l.action,l.details,l.created_at FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 150')->fetchAll()]);}
    fail('Endpoint not found',404);
} catch(GateRejection $e) {
    reply(['error'=>$e->getMessage()],$e->httpStatus);
} catch(PDOException $e) {
    error_log('Campus parking DB error: '.$e->getMessage());
    reply(['error'=>'Database error. Check MySQL, schema, and backend configuration.'],500);
} catch(Throwable $e) {
    error_log('Campus parking error: '.$e->getMessage());
    reply(['error'=>'An unexpected server error occurred.'],500);
}
