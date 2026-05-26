#!/usr/bin/env node

/**
 * qa_smoke.mjs — Playwright-based smoke check for Four Elements Phaser.
 *
 * ARCH-11A: Automated QA smoke test that builds the game, opens it in
 * Chromium, collects console output, verifies readiness markers, takes a
 * screenshot, and writes a report. Designed to run locally and in CI.
 *
 * Usage:
 *   node tools/qa_smoke.mjs
 *
 * Exit code: 0 = pass, 1 = fail
 */

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Configuration ──────────────────────────────────────────────────

const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const READINESS_TIMEOUT_MS = 30_000;
const REPORTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '_reports');

/** Required console log markers that indicate the game booted correctly. */
const REQUIRED_MARKERS = [
  '[PreloadScene] All assets loaded.',
  '[GameScene] All asset textures verified.',
  '[GameScene] State-driven scene ready.',
];

/** File extensions whose failed requests should cause a test failure. */
const FAIL_ON_EXTENSIONS = ['.js', '.css', '.json', '.png', '.jpg', '.webp'];

/** Warning patterns that are benign and should not cause failure. */
const IGNORED_WARNING_PATTERNS = [
  /AudioContext was not allowed to start/i,
  /autoplay/i,
  /user gesture/i,
  /audio.*policy/i,
  /play.*rejected/i,
];

// ─── Helpers ────────────────────────────────────────────────────────

function isIgnoredWarning(text) {
  return IGNORED_WARNING_PATTERNS.some(pattern => pattern.test(text));
}

function isRelevantFailedRequest(url) {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return FAIL_ON_EXTENSIONS.some(e => e === `.${ext}`);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('[qa_smoke] Starting smoke check...');

  // ── Step 1: Build ──────────────────────────────────────────────
  console.log('[qa_smoke] Running npm run build...');
  let buildOk = true;
  let buildError = '';
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..') });
    console.log('[qa_smoke] Build succeeded.');
  } catch (err) {
    buildOk = false;
    buildError = err.stderr?.toString() || err.message;
    console.error('[qa_smoke] Build failed:', buildError);
  }

  if (!buildOk) {
    // Cannot proceed without a build
    const report = buildFailReport(buildError, Date.now() - startTime);
    writeReports(report);
    process.exit(1);
  }

  // ── Step 2: Start preview server ───────────────────────────────
  console.log(`[qa_smoke] Starting vite preview on port ${PREVIEW_PORT}...`);
  let previewProcess;
  try {
    const { spawn } = await import('node:child_process');
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
      cwd: projectRoot,
      stdio: 'pipe',
    });

    // Wait for server to be ready
    await waitForServer(PREVIEW_URL, 10_000);
    console.log('[qa_smoke] Preview server ready.');
  } catch (err) {
    console.error('[qa_smoke] Failed to start preview server:', err.message);
    const report = buildFailReport(`Preview server failed: ${err.message}`, Date.now() - startTime);
    writeReports(report);
    process.exit(1);
  }

  // ── Step 3: Run Playwright checks ──────────────────────────────
  let browser;
  let page;
  let hasCanvas = false;
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const foundMarkers = new Set();

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();

    // Collect console messages
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        if (!isIgnoredWarning(text)) {
          consoleWarnings.push(text);
        }
      }
      // Check for required markers
      for (const marker of REQUIRED_MARKERS) {
        if (text.includes(marker)) {
          foundMarkers.add(marker);
        }
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Collect failed requests
    page.on('requestfailed', request => {
      const url = request.url();
      if (isRelevantFailedRequest(url)) {
        failedRequests.push({
          url,
          failure: request.failure()?.errorText || 'unknown',
        });
      }
    });

    // Navigate to the game
    console.log(`[qa_smoke] Navigating to ${PREVIEW_URL}...`);
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // Wait for readiness markers
    console.log('[qa_smoke] Waiting for readiness markers...');
    const readinessStart = Date.now();
    while (foundMarkers.size < REQUIRED_MARKERS.length) {
      if (Date.now() - readinessStart > READINESS_TIMEOUT_MS) {
        break;
      }
      await page.waitForTimeout(500);
    }

    // Check for canvas element
    hasCanvas = await page.locator('canvas').count() > 0;

    // Take screenshot
    const screenshotPath = resolve(REPORTS_DIR, 'qa-smoke-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[qa_smoke] Screenshot saved to ${screenshotPath}`);

  } catch (err) {
    console.error('[qa_smoke] Playwright error:', err.message);
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (previewProcess) {
      previewProcess.kill('SIGTERM');
      // Give it a moment to shut down
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!previewProcess.killed) {
        previewProcess.kill('SIGKILL');
      }
    }
  }

  // ── Step 4: Build report ───────────────────────────────────────
  const missingMarkers = REQUIRED_MARKERS.filter(m => !foundMarkers.has(m));
  const duration = Date.now() - startTime;

  const pass =
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    failedRequests.length === 0 &&
    missingMarkers.length === 0 &&
    hasCanvas;

  const report = {
    result: pass ? 'PASS' : 'FAIL',
    url: PREVIEW_URL,
    duration_ms: duration,
    duration_human: formatDuration(duration),
    build: { ok: buildOk },
    preview: { ok: true },
    readiness: {
      required_markers: REQUIRED_MARKERS,
      found_markers: [...foundMarkers],
      missing_markers: missingMarkers,
    },
    console_errors: consoleErrors,
    console_warnings: consoleWarnings,
    page_errors: pageErrors,
    failed_requests: failedRequests,
    has_canvas: hasCanvas,
    screenshot: '_reports/qa-smoke-screenshot.png',
  };

  writeReports(report);

  console.log(`[qa_smoke] Result: ${report.result} (${formatDuration(duration)})`);
  if (!pass) {
    if (consoleErrors.length > 0) console.log(`[qa_smoke] Console errors: ${consoleErrors.length}`);
    if (pageErrors.length > 0) console.log(`[qa_smoke] Page errors: ${pageErrors.length}`);
    if (failedRequests.length > 0) console.log(`[qa_smoke] Failed requests: ${failedRequests.length}`);
    if (missingMarkers.length > 0) console.log(`[qa_smoke] Missing markers: ${missingMarkers.join(', ')}`);
    if (!hasCanvas) console.log('[qa_smoke] No canvas element found');
  }

  process.exit(pass ? 0 : 1);
}

// ─── Utilities ──────────────────────────────────────────────────────

function buildFailReport(error, durationMs) {
  return {
    result: 'FAIL',
    url: PREVIEW_URL,
    duration_ms: durationMs,
    duration_human: formatDuration(durationMs),
    build: { ok: false, error },
    preview: { ok: false },
    readiness: {
      required_markers: REQUIRED_MARKERS,
      found_markers: [],
      missing_markers: [...REQUIRED_MARKERS],
    },
    console_errors: [],
    console_warnings: [],
    page_errors: [],
    failed_requests: [],
    has_canvas: false,
    screenshot: null,
  };
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

function writeReports(report) {
  // Ensure reports directory exists
  mkdirSync(REPORTS_DIR, { recursive: true });

  // Write JSON report
  const jsonPath = resolve(REPORTS_DIR, 'qa-smoke-report.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[qa_smoke] JSON report: ${jsonPath}`);

  // Write Markdown report
  const mdPath = resolve(REPORTS_DIR, 'qa-smoke-report.md');
  writeFileSync(mdPath, generateMarkdown(report), 'utf-8');
  console.log(`[qa_smoke] Markdown report: ${mdPath}`);
}

function generateMarkdown(r) {
  const lines = [];
  lines.push(`# QA Smoke Test Report`);
  lines.push('');
  lines.push(`- **Result:** ${r.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`- **URL:** ${r.url}`);
  lines.push(`- **Duration:** ${r.duration_human}`);
  lines.push(`- **Build:** ${r.build.ok ? 'OK' : 'FAILED'}`);
  if (!r.build.ok && r.build.error) {
    lines.push(`  - Error: \`${r.build.error.substring(0, 200)}\``);
  }
  lines.push(`- **Preview server:** ${r.preview.ok ? 'OK' : 'FAILED'}`);
  lines.push('');

  // Readiness markers
  lines.push(`## Readiness Markers`);
  lines.push('');
  for (const marker of r.readiness.required_markers) {
    const found = r.readiness.found_markers.includes(marker);
    lines.push(`- ${found ? '✅' : '❌'} \`${marker}\``);
  }
  if (r.readiness.missing_markers.length > 0) {
    lines.push('');
    lines.push(`**Missing:** ${r.readiness.missing_markers.map(m => `\`${m}\``).join(', ')}`);
  }
  lines.push('');

  // Canvas
  lines.push(`## Canvas`);
  lines.push('');
  lines.push(`- Canvas found: ${r.has_canvas ? '✅ Yes' : '❌ No'}`);
  lines.push('');

  // Console errors
  lines.push(`## Console Errors (${r.console_errors.length})`);
  lines.push('');
  if (r.console_errors.length === 0) {
    lines.push('None.');
  } else {
    for (const err of r.console_errors) {
      lines.push(`- \`${err.substring(0, 200)}\``);
    }
  }
  lines.push('');

  // Console warnings (after filtering)
  lines.push(`## Console Warnings (${r.console_warnings.length})`);
  lines.push('');
  if (r.console_warnings.length === 0) {
    lines.push('None (AudioContext/autoplay warnings filtered).');
  } else {
    for (const warn of r.console_warnings) {
      lines.push(`- \`${warn.substring(0, 200)}\``);
    }
  }
  lines.push('');

  // Page errors
  lines.push(`## Page Errors (${r.page_errors.length})`);
  lines.push('');
  if (r.page_errors.length === 0) {
    lines.push('None.');
  } else {
    for (const err of r.page_errors) {
      lines.push(`- \`${err.substring(0, 200)}\``);
    }
  }
  lines.push('');

  // Failed requests
  lines.push(`## Failed Requests (${r.failed_requests.length})`);
  lines.push('');
  if (r.failed_requests.length === 0) {
    lines.push('None.');
  } else {
    for (const req of r.failed_requests) {
      lines.push(`- \`${req.url}\` — ${req.failure}`);
    }
  }
  lines.push('');

  // Screenshot
  if (r.screenshot) {
    lines.push(`## Screenshot`);
    lines.push('');
    lines.push(`Saved to: \`${r.screenshot}\``);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Entry point ────────────────────────────────────────────────────

main().catch(err => {
  console.error('[qa_smoke] Unhandled error:', err);
  process.exit(1);
});
