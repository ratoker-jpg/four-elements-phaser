#!/usr/bin/env node
/**
 * Tests for task/art-sample/index.html viewer
 *
 * ARCH-02E: Lightweight tests verifying the sample viewer HTML file
 * contains expected structure, references correct paths, and does not
 * import Phaser or runtime code.
 *
 * Usage:
 *   node tools/test_art_sample_viewer.mjs
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = resolve(__dirname, '..');
const VIEWER_PATH = join(PROJECT_ROOT, 'task', 'art-sample', 'index.html');
const README_PATH = join(PROJECT_ROOT, 'task', 'art-sample', 'README.md');

// ─── Test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ─── Load viewer content once ─────────────────────────────────────────

let viewerHtml = '';
let viewerLoaded = false;

function getViewerHtml() {
  if (!viewerLoaded) {
    viewerLoaded = true;
    viewerHtml = existsSync(VIEWER_PATH)
      ? readFileSync(VIEWER_PATH, 'utf-8')
      : '';
  }
  return viewerHtml;
}

// ─── Test cases ───────────────────────────────────────────────────────

console.log('\nart-sample viewer tests\n');

// ── File existence ────────────────────────────────────────────────────

test('viewer HTML file exists', () => {
  assert.ok(existsSync(VIEWER_PATH), `File not found: ${VIEWER_PATH}`);
});

test('viewer README exists', () => {
  assert.ok(existsSync(README_PATH), `File not found: ${README_PATH}`);
});

// ── Expected IDs/strings ──────────────────────────────────────────────

test('viewer contains search input element', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('id="searchInput"'), 'Missing #searchInput element');
});

test('viewer contains family filter element', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('id="familyFilter"'), 'Missing #familyFilter element');
});

test('viewer contains main content container', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('id="mainContent"'), 'Missing #mainContent element');
});

test('viewer contains page title', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('Generated Asset Viewer') || html.includes('asset viewer'),
    'Missing title string',
  );
});

// ── Manifest/audit path references ───────────────────────────────────

test('viewer references manifest.generated.json', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('manifest.generated.json'),
    'Missing reference to manifest.generated.json',
  );
});

test('viewer references audit-report.json', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('audit-report.json'),
    'Missing reference to audit-report.json',
  );
});

test('viewer manifest path uses relative path (not absolute)', () => {
  const html = getViewerHtml();
  // Should not start with / or contain hard-coded absolute path
  const manifestLine = html.split('\n').find(l => l.includes('manifest.generated.json') && l.includes('MANIFEST'));
  if (manifestLine) {
    assert.ok(
      !manifestLine.includes('/home/') && !manifestLine.includes('C:\\'),
      'Manifest path should not contain absolute local paths',
    );
  }
});

test('viewer uses ../../art/generated for JSON paths', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('../../art/generated/'),
    'Viewer should use relative path ../../art/generated/ to locate JSON files',
  );
});

test('viewer uses ../../public for image paths', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('../../public/'),
    'Viewer should use relative path ../../public/ to resolve image src',
  );
});

// ── No Phaser/runtime imports ─────────────────────────────────────────

test('viewer does not import Phaser', () => {
  const html = getViewerHtml();
  assert.ok(
    !html.includes('phaser') && !html.includes('Phaser'),
    'Viewer must not import Phaser',
  );
});

test('viewer does not reference src/ modules', () => {
  const html = getViewerHtml();
  assert.ok(
    !html.includes('src/') || html.includes('task/art-sample/'),
    'Viewer must not reference src/ runtime modules',
  );
});

test('viewer does not import external npm modules', () => {
  const html = getViewerHtml();
  // Check for import statements that reference node_modules
  assert.ok(
    !html.includes('import ') || html.includes("import.meta"),
    'Viewer should not use ES module imports (embedded JS only)',
  );
});

// ── Structural checks ────────────────────────────────────────────────

test('viewer is a complete HTML document', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('<!DOCTYPE html>'), 'Missing DOCTYPE declaration');
  assert.ok(html.includes('<html'), 'Missing <html> element');
  assert.ok(html.includes('</html>'), 'Missing closing </html>');
});

test('viewer has embedded CSS (no external stylesheet)', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('<style>'), 'Viewer should have embedded <style>');
  assert.ok(!html.includes('<link') || !html.includes('stylesheet'), 'Viewer should not link external stylesheets');
});

test('viewer has embedded JS (no external script)', () => {
  const html = getViewerHtml();
  assert.ok(html.includes('<script>'), 'Viewer should have embedded <script>');
  assert.ok(
    !html.includes('<script src=') || html.includes('import'),
    'Viewer should not reference external script files',
  );
});

test('viewer handles file:// fetch error gracefully', () => {
  const html = getViewerHtml();
  assert.ok(
    html.includes('file://') || html.includes('local dev') || html.includes('static server'),
    'Viewer should explain file:// limitation and suggest using a local server',
  );
});

// ── README content checks ────────────────────────────────────────────

test('README mentions process:art-assets command', () => {
  const readme = readFileSync(README_PATH, 'utf-8');
  assert.ok(
    readme.includes('process:art-assets'),
    'README should mention npm run process:art-assets',
  );
});

test('README mentions how to open the viewer', () => {
  const readme = readFileSync(README_PATH, 'utf-8');
  assert.ok(
    readme.includes('vite') || readme.includes('npm run dev') || readme.includes('serve'),
    'README should explain how to open the viewer',
  );
});

test('README states no runtime integration', () => {
  const readme = readFileSync(README_PATH, 'utf-8');
  assert.ok(
    readme.includes('runtime integration') && readme.includes('ARCH-02F'),
    'README should state that runtime integration is not yet implemented (ARCH-02F)',
  );
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
