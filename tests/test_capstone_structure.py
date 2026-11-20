"""Static migration and route wiring checks (do not require a live MySQL server)."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
api=(root/'backend/api.php').read_text()
qr=(root/'backend/qr_access.php').read_text()
migration=(root/'database/CAPSTONE_OPERATIONS_UPGRADE.sql').read_text()
for table in ('gate_queue_arrivals','gate_processing_metrics','parking_inspections',
              'parking_reconciliation_requests','parking_area_policies','user_parking_preferences'):
    assert f'CREATE TABLE IF NOT EXISTS {table}' in migration,table
for route in ('gate/arrival','gate/metrics','inspections','reconciliations','reconciliations/review',
              'allocation/preference','allocation/policies','allocation/evaluate'):
    assert f"$route==='{route}'" in api,route
assert 'allocationCandidates(' in qr
assert 'gateMetric(' in api
assert 'reviewReconciliation(' in api
src=root/'frontend/src'
for file in src.rglob('*'):
    if file.suffix not in ('.js','.jsx'):continue
    for relative in re.findall(r'''from\s+['"](\.[^'"]+)['"]''',file.read_text()):
        assert (file.parent/relative).is_file(),(file,relative)
print('Capstone schema and frontend import references checked.')
