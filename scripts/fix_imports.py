#!/usr/bin/env python3
"""Fix test files - remove broken vision imports and add them correctly."""
import os
import re

TEST_DIR = '/home/z/my-project/repo/src/__tests__'

# Files that have broken imports from the sed command
files = [
    'blockoutDamage.test.ts',
    'blockoutMovement.test.ts',
    'blockoutObstacles.test.ts',
    'blockoutScenario.test.ts',
    'blockoutSelectionAim.test.ts',
    'blockoutVehicleState.test.ts',
    'blockoutWeaponVfx.test.ts',
]

for fname in files:
    fpath = os.path.join(TEST_DIR, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    
    # Remove the broken inline import line
    content = content.replace("\nimport { createInitialVisionState } from '../state/visibility';\n", "\n")
    
    # Remove any duplicate standalone import lines
    lines = content.split('\n')
    new_lines = []
    seen_vision_import = False
    for line in lines:
        if "import { createInitialVisionState }" in line:
            if not seen_vision_import:
                seen_vision_import = True
                new_lines.append(line)
            # skip duplicates
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)
    
    # If no vision import exists, add it after the last top-level import
    if "createInitialVisionState" not in content:
        # Find last line that starts with 'import '
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        # But skip if it's inside a multi-line import block
        # Find the end of the import block
        insert_idx = last_import
        for i in range(last_import, len(lines)):
            if lines[i].strip() == '' or (not lines[i].startswith('import ') and not lines[i].startswith('  ') and not lines[i].startswith('\t') and lines[i].strip().startswith('}')):
                insert_idx = i
                break
        lines.insert(insert_idx, "import { createInitialVisionState } from '../state/visibility';")
        content = '\n'.join(lines)
    
    with open(fpath, 'w') as f:
        f.write(content)
    print(f'Fixed: {fname}')
