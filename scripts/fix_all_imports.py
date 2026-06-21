#!/usr/bin/env python3
"""Fix ALL test files - remove broken vision imports and add them correctly."""
import os
import re

TEST_DIR = '/home/z/my-project/repo/src/__tests__'

# All files that need the vision import fix
files = [
    'buildSiteSelection.test.ts',
    'builder.test.ts', 
    'construction.test.ts',
    'mapValidation.test.ts',
    'occupancy.test.ts',
    'pathfinding.test.ts',
    'separatorProcessing.test.ts',
    'statusHelpers.test.ts',
]

for fname in files:
    fpath = os.path.join(TEST_DIR, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    
    # Remove ALL instances of the broken inline import
    # Pattern: import {\nimport { createInitialVisionState } ...
    # or: standalone line that's inside an import block
    lines = content.split('\n')
    new_lines = []
    skip_next = False
    
    for i, line in enumerate(lines):
        # Skip lines that are broken inline vision imports
        if line.strip() == "import { createInitialVisionState } from '../state/visibility';":
            # Only keep if it's a standalone line (not inside another import block)
            # Check if previous line ends with 'import {' 
            if i > 0 and lines[i-1].strip().endswith('import {'):
                # This is a broken insert - skip it
                continue
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    content = '\n'.join(new_lines)
    
    # Now ensure we have exactly one correct import
    # Remove any existing vision imports
    content = re.sub(r"import\s*\{\s*createInitialVisionState\s*\}\s*from\s*'../state/visibility';\s*\n?", '', content)
    
    # Find the last import statement and add after it
    lines = content.split('\n')
    last_import_end = 0
    in_import = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import '):
            in_import = True
        if in_import:
            if stripped.endswith(';') or stripped == '':
                if stripped.endswith(';'):
                    last_import_end = i
                    in_import = False
        
    # Insert vision import after last import
    lines.insert(last_import_end + 1, "import { createInitialVisionState } from '../state/visibility';")
    content = '\n'.join(lines)
    
    with open(fpath, 'w') as f:
        f.write(content)
    print(f'Fixed: {fname}')
