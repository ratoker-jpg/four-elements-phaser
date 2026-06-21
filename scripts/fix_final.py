#!/usr/bin/env python3
"""Final fix: add missing vision imports and fix duplicates."""
import os
import re

TEST_DIR = '/home/z/my-project/repo/src/__tests__'

# Fix blockout files - add import back
blockout_files = [
    'blockoutDamage.test.ts',
    'blockoutMovement.test.ts',
    'blockoutObstacles.test.ts',
    'blockoutScenario.test.ts',
    'blockoutSelectionAim.test.ts',
    'blockoutVehicleState.test.ts',
    'blockoutWeaponVfx.test.ts',
]

for fname in blockout_files:
    fpath = os.path.join(TEST_DIR, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    
    if "createInitialVisionState" in content and "from '../state/visibility'" in content:
        print(f'SKIP (has import): {fname}')
        continue
    
    # Add import at the top after existing imports
    # Find the line before the first describe/const/let
    lines = content.split('\n')
    insert_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            insert_idx = i + 1
        elif line.strip() == '' and insert_idx > 0:
            insert_idx = i + 1
        elif not line.startswith('import ') and not line.strip() == '' and insert_idx > 0:
            break
    
    lines.insert(insert_idx, "import { createInitialVisionState } from '../state/visibility';")
    content = '\n'.join(lines)
    
    with open(fpath, 'w') as f:
        f.write(content)
    print(f'Fixed: {fname}')

# Fix production.test.ts - remove duplicate
fpath = os.path.join(TEST_DIR, 'production.test.ts')
with open(fpath, 'r') as f:
    content = f.read()

# Remove ALL vision import lines, then add one
content = re.sub(r"import\s*\{\s*createInitialVisionState\s*\}\s*from\s*'../state/visibility';\s*\n?", '', content)

# Add one import after the last import line
lines = content.split('\n')
last_import = 0
for i, line in enumerate(lines):
    if line.startswith('import '):
        last_import = i

lines.insert(last_import + 1, "import { createInitialVisionState } from '../state/visibility';")
with open(fpath, 'w') as f:
    f.write('\n'.join(lines))
print('Fixed: production.test.ts')

# Fix statusHelpers.test.ts - add vision to two more GameState objects
fpath = os.path.join(TEST_DIR, 'statusHelpers.test.ts')
with open(fpath, 'r') as f:
    content = f.read()

# Find GameState objects missing vision and add it
# The pattern is production: { ... }, followed by };
# We need to add vision before the };
content = re.sub(
    r'(production:\s*\{[^}]*\},\n)(\s*\};)',
    r'\1    vision: createInitialVisionState(48, 48),\n\2',
    content
)

with open(fpath, 'w') as f:
    f.write(content)
print('Fixed: statusHelpers.test.ts')
