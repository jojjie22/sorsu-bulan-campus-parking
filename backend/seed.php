<?php
// Run once after SQL import: php backend/seed.php
// Remove or secure this script before deployment. CLI only.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit('CLI only');}
require_once __DIR__.'/db.php';
$accounts=[
 ['Campus Administrator','admin@campus.test','ADMIN-001','admin','Admin123!'],
 ['Gate Security','guard@campus.test','GUARD-001','guard','Guard123!'],
 ['Demo Student','student@campus.test','STU-2026-001','student','Student123!'],
 ['Demo Faculty','faculty@campus.test','FAC-001','faculty','Faculty123!'],
];
$reset = in_array('--reset-demo-passwords', $argv ?? [], true);
if ($reset) echo "Resetting passwords for the four LOCAL demo accounts. Do not run this on a deployed system.\n";
foreach($accounts as [$name,$email,$code,$role,$password]){
 if(!query('SELECT id FROM users WHERE email=?',[$email])->fetch()){
  query('INSERT INTO users(full_name,email,student_employee_id,role,password_hash) VALUES (?,?,?,?,?)',[$name,$email,$code,$role,password_hash($password,PASSWORD_DEFAULT)]);
  echo "Created $email\n";
 } elseif ($reset) {
  query('UPDATE users SET password_hash=?,active=1 WHERE email=?',[password_hash($password,PASSWORD_DEFAULT),$email]);
  echo "Reset password for $email\n";
 } else echo "Exists $email (password unchanged)\n";
}
$areas=query('SELECT id,name FROM parking_areas')->fetchAll();
foreach($areas as $area){
 for($i=1;$i<=12;$i++){
  $prefix=$area['id']==1?'N':($area['id']==2?'M':'F');$code=$prefix.'-'.str_pad((string)$i,2,'0',STR_PAD_LEFT);
  $type=$i<=8?'car':'motorcycle';
  query('INSERT IGNORE INTO parking_slots(area_id,code,vehicle_type,status) VALUES (?,?,?,?)',[$area['id'],$code,$type,'active']);
 }
}
echo "Created (or retained) demo parking slots. Setup complete.\n";
