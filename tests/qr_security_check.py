"""Static checks only: not a substitute for live MySQL and QR-camera tests."""
from pathlib import Path
p=Path(__file__).resolve().parents[1]
sql=(p/'database'/'QR_SECURITY_UPGRADE.sql').read_text()
php=(p/'backend'/'qr_access.php').read_text()
api=(p/'backend'/'api.php').read_text()
gate=(p/'frontend/src/pages/GatePage.jsx').read_text()
permits=(p/'frontend/src/pages/PermitsPage.jsx').read_text()
for table in ('qr_access_tokens','gate_scan_attempts'):
    assert 'CREATE TABLE IF NOT EXISTS '+table in sql
for check in ('hash(\'sha256\'','used_at','token_expires_at','normalizePlate','FOR UPDATE','sp_record_parking_entry','sp_record_parking_exit','automatic_slot_assignment'):
    assert check in php,check
assert 'qrGateRecord($u,$a)' in api
assert "\'CPM\'" not in php
assert 'observed_plate:observedPlate' in gate
assert 'setScanning(true)' in gate
assert "setInterval(() => refreshQr" in permits
assert 'QRCodeSVG' in permits
assert 'qr-image' in api and '410' in api
print('Dynamic token, entry/exit, plate, migration and UI static checks passed.')
