#!/usr/bin/env python3
"""Add vision field to test files that create GameState objects."""
import os
import re

TEST_DIR = '/home/z/my-project/repo/src/__tests__'
files = [
    'buildSiteSelection.test.ts',
    'builder.test.ts', 
    'construction.test.ts',
    'mapValidation.test.ts',
    'occupancy.test.ts',
    'pathfinding.test.ts',
    'production.test.ts',
    'separatorProcessing.test.ts',
    'statusHelpers.test.ts',
]

for fname in files:
    fpath = os.path.join(TEST_DIR, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    
    if 'vision:' in content:
        print(f'SKIP: {fname} already has vision')
        continue
    
    # Add import
    if "createInitialVisionState" not in content:
        # Find last import line
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        lines.insert(last_import + 1, "import { createInitialVisionState } from '../state/visibility';")
        content = '\n'.join(lines)
    
    # Add vision field after production field
    # Pattern: production: { factories: [] }, or production: { factories: [] }
    content = re.sub(
        r'(production:\s*\{[^}]*\},?)\n',
        r'\1\n    vision: createInitialVisionState(48, 48),\n',
        content
    )
    
    if 'vision:' in content:
        with open(fpath, 'w') as f:
            f.write(content)
        print(f'FIXED: {fname}')
    else:
        print(f'MANUAL: {fname}')
