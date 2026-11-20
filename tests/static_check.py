"""Quick dependency-free structure and PHP checks. Run: python tests/static_check.py"""
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[1]
expected = [
 'backend/api.php','backend/db.php','backend/config.php','backend/seed.php',
 'database/campus_parking.sql','frontend/index.html','frontend/vite.config.js',
 'frontend/package.json','frontend/src/api.js','frontend/src/App.jsx',
 'frontend/src/main.jsx','frontend/src/style.css','README.md'
]
for rel in expected:
    assert (ROOT/rel).is_file(), f'Missing file: {rel}'
    print('OK',rel)
for name in ('api.php','db.php','config.php','seed.php'):
    subprocess.run(['php','-l',str(ROOT/'backend'/name)],check=True)
sql=(ROOT/'database/campus_parking.sql').read_text()
for table in ('users','auth_tokens','vehicles','permits','parking_slots','parking_areas','parking_visits','settings','audit_logs'):
    assert f'CREATE TABLE IF NOT EXISTS {table} ' in sql, f'Missing {table}'
print('All structure and PHP syntax checks passed.')

# Verify the modular React refactor and its relative import paths.
import re
source=ROOT/'frontend'/'src'
for folder in ('components','sections','ui','hooks','pages','lib'):
    assert (source/folder).is_dir(), f'Missing modular folder: {folder}'
for rel in ('components/layout/AppShell.jsx','sections/DashboardOverview.jsx',
            'sections/DashboardMetricCards.jsx','hooks/useData.js',
            'hooks/useNotification.js','ui/index.js','ui/Toast.jsx'):
    assert (source/rel).is_file(), f'Missing modular file: {rel}'
for f in (*source.rglob('*.jsx'),*source.rglob('*.js')):
    content=f.read_text(encoding='utf-8')
    for path in re.findall(r"\bfrom\s+['\"](\.[^'\"]+)['\"]",content):
        assert (f.parent/path).resolve().is_file(), f'Broken import {path} in {f}'
print('Modular frontend paths verified.')

# Maroon frontend redesign: verify core component boundaries.
for rel in ('components/layout/Sidebar.jsx','components/layout/Topbar.jsx',
            'components/layout/navigation.js','hooks/useAuthSession.js'):
    assert (source/rel).is_file(), f'Missing redesigned component: {rel}'
print('Maroon redesign components verified.')
