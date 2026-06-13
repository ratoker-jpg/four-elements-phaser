#!/usr/bin/env node

/**
 * qa_smoke.mjs — Playwright-based smoke check for Four Elements Phaser.
 *
 * ARCH-11A: Dual-mode automated QA smoke test that builds the game,
 * opens it in Chromium with two URL configurations (standard and
 * devtools/arena), collects console output, verifies readiness markers,
 * asserts HUD DOM content, takes screenshots, and writes per-run and
 * combined reports. Designed to run locally and in CI.
 *
 * Usage:
 *   node tools/qa_smoke.mjs
 *   npm run qa:smoke
 *
 * Exit code: 0 = both runs pass, 1 = any run fails
 */

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Configuration ──────────────────────────────────────────────────

const PREVIEW_PORT = 4173;
const READINESS_TIMEOUT_MS = 30_000;
const DOM_ASSERT_TIMEOUT_MS = 10_000;
const REPORTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '_reports');
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

// ─── Dual-mode run definitions ──────────────────────────────────────

const SMOKE_RUNS = [
  {
    name: 'standard',
    url: `http://localhost:${PREVIEW_PORT}?skipMenu`,
    requiredMarkers: [
      '[PreloadScene] All assets loaded.',
      '[GameScene] All asset textures verified.',
      '[GameScene] State-driven scene ready.',
      '[GameScene] Faction: cyan',
      '[PreloadScene] modularUnits loading skipped (standard mode).',
      '[GameScene] Harvester animation ready.',
    ],
    screenshotFile: 'qa-smoke-standard.png',
    reportFile: 'qa-smoke-standard-report',
  },
  {
    name: 'devtools',
    url: `http://localhost:${PREVIEW_PORT}?skipMenu&devtools=1&arena=1`,
    requiredMarkers: [
      '[PreloadScene] All assets loaded.',
      '[GameScene] All asset textures verified.',
      '[GameScene] State-driven scene ready.',
      '[GameScene] Faction: cyan',
      '[PreloadScene] generated hull sets loaded: wasp/<all factions>/m0 (16 dirs each).',
      '[GameScene] Harvester animation ready.',
    ],
    screenshotFile: 'qa-smoke-devtools.png',
    reportFile: 'qa-smoke-devtools-report',
    // ARENA-01H+: Arena mode has ArenaMenu, not PlaytestHud (#hud-economy)
    isArenaMode: true,
  },
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

// ─── Single smoke run ───────────────────────────────────────────────

/**
 * Run a single Playwright smoke check with the given configuration.
 * Returns a run report object.
 */
async function runSmokeCheck(runConfig, previewProcess) {
  const runStart = Date.now();
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const foundMarkers = new Set();
  const smokeErrors = [];
  let hasCanvas = false;
  let hudEconomyText = null;

  let browser;
  let page;

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
      for (const marker of runConfig.requiredMarkers) {
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
    console.log(`[qa_smoke:${runConfig.name}] Navigating to ${runConfig.url}...`);
    await page.goto(runConfig.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // Wait for readiness markers
    console.log(`[qa_smoke:${runConfig.name}] Waiting for readiness markers...`);
    const readinessStart = Date.now();
    while (foundMarkers.size < runConfig.requiredMarkers.length) {
      if (Date.now() - readinessStart > READINESS_TIMEOUT_MS) {
        break;
      }
      await page.waitForTimeout(500);
    }

    // Check for canvas element
    hasCanvas = await page.locator('canvas').count() > 0;

    // ARENA-01H+: Arena mode uses ArenaMenu, not PlaytestHud
    // In Arena mode, assert ArenaMenu exists instead of #hud-economy
    const isArena = runConfig.isArenaMode ?? false;
    if (isArena) {
      console.log(`[qa_smoke:${runConfig.name}] Asserting ArenaMenu DOM...`);
      try {
        const arenaMenuLocator = page.locator('#arena-menu');
        await arenaMenuLocator.waitFor({ state: 'attached', timeout: DOM_ASSERT_TIMEOUT_MS });
        // ArenaMenu exists — mark HUD checks as satisfied (they don't apply)
        hudEconomyText = 'Сырьё: N/A (Arena mode) Юниты: N/A (Arena mode)';
      } catch (err) {
        smokeErrors.push(`ArenaMenu #arena-menu assertion failed: ${err.message}`);
      }
    } else {
      // Normal Game: verify #hud-economy contains Russian "Сырьё:" and "Юниты:"
      // CORE-STEP-01B: HUD labels are now Russian
      console.log(`[qa_smoke:${runConfig.name}] Asserting HUD economy DOM...`);
      try {
        const hudEconomyLocator = page.locator('#hud-economy');
        // Wait for the element to have non-empty text content (retry/poll)
        await hudEconomyLocator.waitFor({ state: 'attached', timeout: DOM_ASSERT_TIMEOUT_MS });
        // Poll until text content is populated (Phaser HUD updates each frame)
        const pollStart = Date.now();
        while (Date.now() - pollStart < DOM_ASSERT_TIMEOUT_MS) {
          hudEconomyText = await hudEconomyLocator.textContent();
          if (hudEconomyText && hudEconomyText.includes('Сырьё:') && hudEconomyText.includes('Юниты:')) {
            break;
          }
          await page.waitForTimeout(250);
        }
      } catch (err) {
        // HUD element may not exist or not be populated in time
        smokeErrors.push(`HUD #hud-economy assertion failed: ${err.message}`);
      }
    }

    // Take screenshot (ensure _reports exists)
    mkdirSync(REPORTS_DIR, { recursive: true });
    const screenshotPath = resolve(REPORTS_DIR, runConfig.screenshotFile);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[qa_smoke:${runConfig.name}] Screenshot saved to ${screenshotPath}`);

  } catch (err) {
    console.error(`[qa_smoke:${runConfig.name}] Playwright error:`, err.message);
    smokeErrors.push(err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Build run report
  const missingMarkers = runConfig.requiredMarkers.filter(m => !foundMarkers.has(m));
  const hudHasRaw = hudEconomyText ? hudEconomyText.includes('Сырьё:') : false;
  const hudHasUnits = hudEconomyText ? hudEconomyText.includes('Юниты:') : false;

  const pass =
    smokeErrors.length === 0 &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    failedRequests.length === 0 &&
    missingMarkers.length === 0 &&
    hasCanvas &&
    hudHasRaw &&
    hudHasUnits;

  const duration = Date.now() - runStart;

  return {
    name: runConfig.name,
    url: runConfig.url,
    result: pass ? 'PASS' : 'FAIL',
    duration_ms: duration,
    duration_human: formatDuration(duration),
    readiness: {
      required_markers: runConfig.requiredMarkers,
      found_markers: [...foundMarkers],
      missing_markers: missingMarkers,
    },
    smoke_errors: smokeErrors,
    console_errors: consoleErrors,
    console_warnings: consoleWarnings,
    page_errors: pageErrors,
    failed_requests: failedRequests,
    has_canvas: hasCanvas,
    hud_economy: {
      element_exists: hudEconomyText !== null,
      contains_raw: hudHasRaw,
      contains_units: hudHasUnits,
      text_preview: hudEconomyText ? hudEconomyText.substring(0, 200) : null,
    },
    screenshot: `_reports/${runConfig.screenshotFile}`,
  };
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('[qa_smoke] Starting dual-mode smoke check...');

  // ── Step 1: Build ──────────────────────────────────────────────
  console.log('[qa_smoke] Running npm run build...');
  let buildOk = true;
  let buildError = '';
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: PROJECT_ROOT });
    console.log('[qa_smoke] Build succeeded.');
  } catch (err) {
    buildOk = false;
    buildError = err.stderr?.toString() || err.message;
    console.error('[qa_smoke] Build failed:', buildError);
  }

  if (!buildOk) {
    // Cannot proceed without a build
    const report = buildFailReport(buildError, Date.now() - startTime);
    writeReports(report, null);
    process.exit(1);
  }

  // ── Step 2: Start preview server ───────────────────────────────
  const previewUrl = `http://localhost:${PREVIEW_PORT}?skipMenu`;
  console.log(`[qa_smoke] Starting vite preview on port ${PREVIEW_PORT}...`);
  let previewProcess;
  try {
    const { spawn } = await import('node:child_process');
    previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });

    // Wait for server to be ready
    await waitForServer(previewUrl, 10_000);
    console.log('[qa_smoke] Preview server ready.');
  } catch (err) {
    console.error('[qa_smoke] Failed to start preview server:', err.message);
    if (previewProcess) {
      previewProcess.kill('SIGTERM');
    }
    const report = previewFailReport(err.message, Date.now() - startTime);
    writeReports(report, null);
    process.exit(1);
  }

  // ── Step 3: Run each smoke configuration ───────────────────────
  const runReports = [];
  for (const runConfig of SMOKE_RUNS) {
    console.log(`[qa_smoke] --- Running ${runConfig.name} mode ---`);
    const runReport = await runSmokeCheck(runConfig, previewProcess);
    runReports.push(runReport);
    console.log(`[qa_smoke:${runConfig.name}] Result: ${runReport.result} (${runReport.duration_human})`);
    if (runReport.result === 'FAIL') {
      if (runReport.smoke_errors.length > 0) console.log(`[qa_smoke:${runConfig.name}] Smoke/script errors: ${runReport.smoke_errors.length}`);
      if (runReport.console_errors.length > 0) console.log(`[qa_smoke:${runConfig.name}] Console errors: ${runReport.console_errors.length}`);
      if (runReport.page_errors.length > 0) console.log(`[qa_smoke:${runConfig.name}] Page errors: ${runReport.page_errors.length}`);
      if (runReport.failed_requests.length > 0) console.log(`[qa_smoke:${runConfig.name}] Failed requests: ${runReport.failed_requests.length}`);
      if (runReport.readiness.missing_markers.length > 0) console.log(`[qa_smoke:${runConfig.name}] Missing markers: ${runReport.readiness.missing_markers.join(', ')}`);
      if (!runReport.has_canvas) console.log(`[qa_smoke:${runConfig.name}] No canvas element found`);
      if (!runReport.hud_economy.contains_raw) console.log(`[qa_smoke:${runConfig.name}] HUD #hud-economy missing "Сырьё:"`);
      if (!runReport.hud_economy.contains_units) console.log(`[qa_smoke:${runConfig.name}] HUD #hud-economy missing "Юниты:"`);
    }
  }

  // ── Step 4: Cleanup preview server ─────────────────────────────
  if (previewProcess) {
    previewProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!previewProcess.killed) {
      previewProcess.kill('SIGKILL');
    }
  }

  // ── Step 5: Build combined report ──────────────────────────────
  const combinedPass = runReports.every(r => r.result === 'PASS');
  const duration = Date.now() - startTime;

  const combinedReport = {
    result: combinedPass ? 'PASS' : 'FAIL',
    duration_ms: duration,
    duration_human: formatDuration(duration),
    build: { ok: buildOk },
    preview: { ok: true },
    runs: runReports,
    summary: {
      total_runs: runReports.length,
      passed: runReports.filter(r => r.result === 'PASS').length,
      failed: runReports.filter(r => r.result === 'FAIL').length,
    },
  };

  // Write per-run and combined reports
  writeReports(combinedReport, runReports);

  console.log(`[qa_smoke] Combined result: ${combinedReport.result} (${formatDuration(duration)})`);
  console.log(`[qa_smoke] Runs: ${combinedReport.summary.passed}/${combinedReport.summary.total_runs} passed`);

  process.exit(combinedPass ? 0 : 1);
}

// ─── Report Writers ─────────────────────────────────────────────────

function writeReports(combinedReport, runReports) {
  mkdirSync(REPORTS_DIR, { recursive: true });

  // Write combined JSON report
  const combinedJsonPath = resolve(REPORTS_DIR, 'qa-smoke-report.json');
  writeFileSync(combinedJsonPath, JSON.stringify(combinedReport, null, 2), 'utf-8');
  console.log(`[qa_smoke] Combined JSON report: ${combinedJsonPath}`);

  // Write per-run JSON reports
  if (runReports) {
    for (const runReport of runReports) {
      const runJsonPath = resolve(REPORTS_DIR, `${runReport.name}-report.json`);
      writeFileSync(runJsonPath, JSON.stringify(runReport, null, 2), 'utf-8');
      console.log(`[qa_smoke] ${runReport.name} JSON report: ${runJsonPath}`);
    }
  }

  // Write combined Markdown report
  const mdPath = resolve(REPORTS_DIR, 'qa-smoke-report.md');
  writeFileSync(mdPath, generateCombinedMarkdown(combinedReport), 'utf-8');
  console.log(`[qa_smoke] Markdown report: ${mdPath}`);
}

function generateCombinedMarkdown(r) {
  const lines = [];
  lines.push(`# QA Smoke Test Report`);
  lines.push('');
  lines.push(`- **Combined Result:** ${r.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`- **Duration:** ${r.duration_human}`);
  lines.push(`- **Build:** ${r.build.ok ? 'OK' : 'FAILED'}`);
  if (!r.build.ok && r.build.error) {
    lines.push(`  - Error: \`${r.build.error.substring(0, 200)}\``);
  }
  lines.push(`- **Preview server:** ${r.preview.ok ? 'OK' : 'FAILED'}`);
  if (!r.preview.ok && r.preview.error) {
    lines.push(`  - Error: \`${r.preview.error.substring(0, 200)}\``);
  }
  lines.push(`- **Runs:** ${r.summary.passed}/${r.summary.total_runs} passed`);
  lines.push('');

  // Per-run details
  if (r.runs) {
    for (const run of r.runs) {
      lines.push(`---`);
      lines.push('');
      lines.push(`## Run: ${run.name}`);
      lines.push('');
      lines.push(`- **Result:** ${run.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
      lines.push(`- **URL:** ${run.url}`);
      lines.push(`- **Duration:** ${run.duration_human}`);
      lines.push('');

      // Readiness markers
      lines.push(`### Readiness Markers`);
      lines.push('');
      for (const marker of run.readiness.required_markers) {
        const found = run.readiness.found_markers.includes(marker);
        lines.push(`- ${found ? '✅' : '❌'} \`${marker}\``);
      }
      if (run.readiness.missing_markers.length > 0) {
        lines.push('');
        lines.push(`**Missing:** ${run.readiness.missing_markers.map(m => `\`${m}\``).join(', ')}`);
      }
      lines.push('');

      // Canvas
      lines.push(`### Canvas`);
      lines.push('');
      lines.push(`- Canvas found: ${run.has_canvas ? '✅ Yes' : '❌ No'}`);
      lines.push('');

      // HUD economy DOM assertion
      lines.push(`### HUD Economy (#hud-economy)`);
      lines.push('');
      lines.push(`- Element exists: ${run.hud_economy.element_exists ? '✅ Yes' : '❌ No'}`);
      lines.push(`- Contains "Сырьё:": ${run.hud_economy.contains_raw ? '✅ Yes' : '❌ No'}`);
      lines.push(`- Contains "Юниты:": ${run.hud_economy.contains_units ? '✅ Yes' : '❌ No'}`);
      if (run.hud_economy.text_preview) {
        lines.push(`- Text preview: \`${run.hud_economy.text_preview}\``);
      }
      lines.push('');

      // Console errors
      lines.push(`### Console Errors (${run.console_errors.length})`);
      lines.push('');
      if (run.console_errors.length === 0) {
        lines.push('None.');
      } else {
        for (const err of run.console_errors) {
          lines.push(`- \`${err.substring(0, 200)}\``);
        }
      }
      lines.push('');

      // Console warnings (after filtering)
      lines.push(`### Console Warnings (${run.console_warnings.length})`);
      lines.push('');
      if (run.console_warnings.length === 0) {
        lines.push('None (AudioContext/autoplay warnings filtered).');
      } else {
        for (const warn of run.console_warnings) {
          lines.push(`- \`${warn.substring(0, 200)}\``);
        }
      }
      lines.push('');

      // Page errors
      lines.push(`### Page Errors (${run.page_errors.length})`);
      lines.push('');
      if (run.page_errors.length === 0) {
        lines.push('None.');
      } else {
        for (const err of run.page_errors) {
          lines.push(`- \`${err.substring(0, 200)}\``);
        }
      }
      lines.push('');

      // Failed requests
      lines.push(`### Failed Requests (${run.failed_requests.length})`);
      lines.push('');
      if (run.failed_requests.length === 0) {
        lines.push('None.');
      } else {
        for (const req of run.failed_requests) {
          lines.push(`- \`${req.url}\` — ${req.failure}`);
        }
      }
      lines.push('');

      // Smoke/script errors
      lines.push(`### Smoke/Script Errors (${run.smoke_errors?.length || 0})`);
      lines.push('');
      if (!run.smoke_errors || run.smoke_errors.length === 0) {
        lines.push('None.');
      } else {
        for (const err of run.smoke_errors) {
          lines.push(`- \`${err.substring(0, 200)}\``);
        }
      }
      lines.push('');

      // Screenshot
      if (run.screenshot) {
        lines.push(`### Screenshot`);
        lines.push('');
        lines.push(`Saved to: \`${run.screenshot}\``);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ─── Failure Report Builders ────────────────────────────────────────

function buildFailReport(error, durationMs) {
  return {
    result: 'FAIL',
    duration_ms: durationMs,
    duration_human: formatDuration(durationMs),
    build: { ok: false, error },
    preview: { ok: false },
    runs: [],
    summary: { total_runs: 0, passed: 0, failed: 1 },
  };
}

function previewFailReport(error, durationMs) {
  return {
    result: 'FAIL',
    duration_ms: durationMs,
    duration_human: formatDuration(durationMs),
    build: { ok: true },
    preview: { ok: false, error },
    runs: [],
    summary: { total_runs: 0, passed: 0, failed: 1 },
  };
}

// ─── Server Wait ────────────────────────────────────────────────────

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

// ─── Entry point ────────────────────────────────────────────────────

main().catch(err => {
  console.error('[qa_smoke] Unhandled error:', err);
  process.exit(1);
});
