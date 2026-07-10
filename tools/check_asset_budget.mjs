#!/usr/bin/env node

import { readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const targetDir = resolve(process.argv[2] ?? 'dist');
// Current runtime assets are intentionally large. This guard establishes a
// ceiling slightly above the existing baseline; it prevents silent growth but
// does not pretend the existing asset footprint has already been optimized.
const maxTotalBytes = Number(process.env.ASSET_BUDGET_TOTAL_MB ?? 5200) * 1024 * 1024;
const maxFileBytes = Number(process.env.ASSET_BUDGET_FILE_MB ?? 256) * 1024 * 1024;

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path));
    } else if (entry.isFile()) {
      const info = await stat(path);
      files.push({ path, size: info.size });
    }
  }
  return files;
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

try {
  const files = await collectFiles(targetDir);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const oversized = files.filter(file => file.size > maxFileBytes);
  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 15);

  console.log(`[asset-budget] files: ${files.length}`);
  console.log(`[asset-budget] total: ${mb(total)} MiB / ${mb(maxTotalBytes)} MiB`);
  console.log('[asset-budget] largest files:');
  for (const file of largest) {
    console.log(`  ${mb(file.size)} MiB  ${relative(targetDir, file.path)}`);
  }

  const errors = [];
  if (total > maxTotalBytes) {
    errors.push(`dist total ${mb(total)} MiB exceeds ${mb(maxTotalBytes)} MiB`);
  }
  for (const file of oversized) {
    errors.push(`${relative(targetDir, file.path)} is ${mb(file.size)} MiB; limit is ${mb(maxFileBytes)} MiB`);
  }

  if (errors.length > 0) {
    console.error('[asset-budget] FAIL');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('[asset-budget] PASS');
} catch (error) {
  console.error(`[asset-budget] unable to inspect ${targetDir}: ${error.message}`);
  process.exit(1);
}
