#!/usr/bin/env node
/**
 * Cross-platform wrapper for tools/generate_building_meta.py
 *
 * On Unix/macOS the Python 3 binary is typically `python3`.
 * On Windows it is typically `python` (which is Python 3 when
 * installed from python.org or the Microsoft Store).
 *
 * This wrapper tries `python3` first, then falls back to `python`.
 * If neither is available, it prints a clear error message.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptPath = join(__dirname, 'generate_building_meta.py');

/**
 * Try to run the Python script with the given binary name.
 * Returns true if the process exits with code 0.
 */
function tryPython(binaryName) {
  return new Promise((resolve) => {
    const child = spawn(binaryName, [scriptPath], {
      stdio: 'inherit',
      // On Windows, { shell: true } is needed to resolve .exe from PATH
      // without a file extension. On Unix it is not required, but harmless.
      // We pass args as an array (not concatenated), so this is safe.
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  // Try python3 first (Unix/macOS convention), then python (Windows convention)
  const candidates = ['python3', 'python'];

  for (const candidate of candidates) {
    const ok = await tryPython(candidate);
    if (ok) {
      process.exit(0);
    }
  }

  console.error(
    'Error: Could not find a Python 3 interpreter.\n' +
    'Please install Python 3 with Pillow, then re-run.\n' +
    '  See: tools/requirements.txt'
  );
  process.exit(1);
}

main();
