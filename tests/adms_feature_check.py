"""Static smoke checks for the ADMS upgrade (does not execute SQL)."""
from pathlib import Path
p=Path(__file__).resolve().parents[1]
sql=(p/'database'/'ADMS_advanced_features.sql').read_text()
api=(p/'backend'/'api.php').read_text() + (p/'backend'/'qr_access.php').read_text()
css=(p/'frontend'/'src'/'responsive.css').read_text()
for tag in ['CREATE TRIGGER trg_permit_status_audit','CREATE TRIGGER trg_visit_entry_audit',
            'CREATE TRIGGER trg_visit_exit_audit','CREATE PROCEDURE sp_record_parking_entry',
            'CREATE PROCEDURE sp_record_parking_exit','CREATE PROCEDURE sp_expire_parking_permits',
            'CREATE OR REPLACE VIEW vw_parking_availability','CREATE OR REPLACE VIEW vw_active_permits',
            'CREATE OR REPLACE VIEW vw_parking_area_summary','CREATE OR REPLACE VIEW vw_daily_parking_activity',
            'CREATE EVENT ev_expire_parking_permits']:
    assert tag in sql, f'Missing SQL object: {tag}'
for api_dependency in ['CALL sp_record_parking_entry','CALL sp_record_parking_exit',
                       'vw_parking_availability','vw_parking_area_summary','vw_daily_parking_activity']:
    assert api_dependency in api, f'API does not use {api_dependency}'
for breakpoint in ('1024px','820px','600px','370px'):
    assert breakpoint in css, f'Missing responsive breakpoint {breakpoint}'
assert "import './responsive.css'" in (p/'frontend'/'src'/'main.jsx').read_text()
print('ADMS object, API integration and responsive CSS static checks passed.')
