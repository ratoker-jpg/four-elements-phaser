/**
 * AssetViewerPanel — dev-only DOM overlay for browsing asset registry.
 *
 * ARCH-17B: Provides a collapsible asset viewer within the devtools panel.
 * Shows asset groups, keys, loaded/missing status, faction gaps,
 * and placeholder/state-only categories.
 *
 * - Only visible when ?devtools=1 is active
 * - Opens as a separate DOM overlay (wider than devtools panel)
 * - No image generation, no asset pipeline changes
 * - No gameplay wiring changes
 *
 * Lifecycle:
 * - Created by DevtoolsPanel when "Asset Viewer" button is clicked.
 * - Destroyed when closed or on GameScene shutdown.
 */

import type { RuntimeAssetDiagnostics } from '../../assets/runtimeAssetDiagnostics';

// ─── AssetViewerPanel class ────────────────────────────────────────

export class AssetViewerPanel {
  private container: HTMLDivElement | null = null;
  private content: HTMLDivElement | null = null;

  /** Whether the asset viewer panel is currently shown. */
  private _visible = false;

  get visible(): boolean {
    return this._visible;
  }

  /**
   * Show the asset viewer panel with the given diagnostics data.
   */
  show(diagnostics: RuntimeAssetDiagnostics): void {
    if (this._visible) {
      this.update(diagnostics);
      return;
    }

    this.destroy();
    this._visible = true;

    const root = document.createElement('div');
    root.id = 'asset-viewer-panel';
    root.style.cssText = `
      position: fixed;
      top: 48px;
      left: 236px;
      width: 420px;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
      background: rgba(20, 10, 30, 0.95);
      border: 1px solid rgba(100, 200, 255, 0.25);
      border-radius: 6px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #a0d0ff;
      z-index: 26;
      pointer-events: auto;
      user-select: none;
    `;

    // ── Header ────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(100, 200, 255, 0.15);
      background: rgba(100, 200, 255, 0.08);
    `;

    const title = document.createElement('span');
    title.textContent = 'Asset Viewer';
    title.style.cssText = 'font-weight: 700; font-size: 12px; color: #80c0ff;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = `
      background: none;
      border: 1px solid rgba(255, 100, 100, 0.3);
      border-radius: 3px;
      color: #ff8888;
      font-size: 10px;
      cursor: pointer;
      padding: 2px 6px;
    `;
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeBtn);
    root.appendChild(header);

    // ── Content ───────────────────────────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'padding: 8px 10px;';

    this.renderSummary(content, diagnostics);
    this.renderFactionGaps(content, diagnostics);
    this.renderCategories(content, diagnostics);
    this.renderStateOnlySection(content, diagnostics);

    root.appendChild(content);

    document.body.appendChild(root);
    this.container = root;
    this.content = content;
  }

  /**
   * Update the asset viewer with fresh diagnostics data.
   */
  update(diagnostics: RuntimeAssetDiagnostics): void {
    if (!this._visible || !this.content) return;
    this.content.innerHTML = '';
    this.renderSummary(this.content, diagnostics);
    this.renderFactionGaps(this.content, diagnostics);
    this.renderCategories(this.content, diagnostics);
    this.renderStateOnlySection(this.content, diagnostics);
  }

  /** Hide the asset viewer panel. */
  hide(): void {
    this.destroy();
  }

  /** Toggle the asset viewer visibility. */
  toggle(diagnostics: RuntimeAssetDiagnostics | null): void {
    if (this._visible) {
      this.hide();
    } else if (diagnostics) {
      this.show(diagnostics);
    }
  }

  /** Remove the asset viewer panel DOM overlay. */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.content = null;
    this._visible = false;
  }

  // ─── Internal rendering helpers ──────────────────────────────────

  private renderSummary(parent: HTMLDivElement, diagnostics: RuntimeAssetDiagnostics): void {
    const s = diagnostics.summary;
    const section = this.createSection('Summary', '#80c0ff');
    section.innerHTML =
      `<div>Manifest keys: <b>${s.checked}</b> checked | <b>${s.loaded}</b> loaded | <b style="color:#ff8888">${s.missing}</b> missing</div>` +
      `<div>Unwired: ${s.manifestOnly} | Placeholder: ${s.placeholder} | Deferred: ${s.stateOnlyAndDeferred}</div>`;
    parent.appendChild(section);
  }

  private renderFactionGaps(parent: HTMLDivElement, diagnostics: RuntimeAssetDiagnostics): void {
    const section = this.createSection('Faction Gaps', '#ffcc44');

    // Collect faction info from entries
    const factionMap = new Map<string, { hq: boolean; hqWired: boolean; builder: boolean; builderWired: boolean; harvester: boolean; harvesterWired: boolean }>();

    for (const entry of diagnostics.entries) {
      if (!entry.faction) continue;
      if (!factionMap.has(entry.faction)) {
        factionMap.set(entry.faction, { hq: false, hqWired: false, builder: false, builderWired: false, harvester: false, harvesterWired: false });
      }
      const f = factionMap.get(entry.faction)!;
      if (entry.category === 'hq') {
        f.hq = true;
        f.hqWired = entry.status === 'expected';
      }
      if (entry.category === 'civil-units' && entry.key.startsWith('builder_')) {
        f.builder = true;
        f.builderWired = entry.status === 'expected';
      }
      if (entry.category === 'civil-units' && entry.key.startsWith('harvester_')) {
        f.harvester = true;
        f.harvesterWired = entry.status === 'expected';
      }
    }

    let html = '';
    for (const [faction, info] of factionMap) {
      const label = faction.charAt(0).toUpperCase() + faction.slice(1);
      const hqIcon = info.hqWired ? '✓' : info.hq ? '⚠' : '✗';
      const hqColor = info.hqWired ? '#81c784' : info.hq ? '#ffcc44' : '#ff8888';
      const builderIcon = info.builderWired ? '✓' : info.builder ? '⚠' : '✗';
      const builderColor = info.builderWired ? '#81c784' : info.builder ? '#ffcc44' : '#ff8888';
      const harvesterIcon = info.harvesterWired ? '✓' : info.harvester ? '⚠' : '✗';
      const harvesterColor = info.harvesterWired ? '#81c784' : info.harvester ? '#ffcc44' : '#ff8888';
      html += `<div style="margin-bottom:2px;">` +
        `<b>${label}</b>: ` +
        `HQ <span style="color:${hqColor}">${hqIcon}</span> ` +
        `Builder <span style="color:${builderColor}">${builderIcon}</span> ` +
        `Harvester <span style="color:${harvesterColor}">${harvesterIcon}</span>` +
        `</div>`;
    }
    html += `<div style="margin-top:3px;font-size:9px;color:#888;">✓=wired ⚠=manifest-only ✗=missing</div>`;
    section.innerHTML = html;
    parent.appendChild(section);
  }

  private renderCategories(parent: HTMLDivElement, diagnostics: RuntimeAssetDiagnostics): void {
    const section = this.createSection('Asset Categories', '#81c784');

    const categories: Array<{ name: string; cat: string }> = [
      { name: 'Terrain', cat: 'terrain' },
      { name: 'Resources', cat: 'resources' },
      { name: 'HQ', cat: 'hq' },
      { name: 'Buildings', cat: 'buildings' },
      { name: 'Civil Units', cat: 'civil-units' },
      { name: 'Modular Units', cat: 'modular-units' },
    ];

    let html = '';
    for (const { name, cat } of categories) {
      const catData = diagnostics.summary.byCategory[cat as keyof typeof diagnostics.summary.byCategory];
      if (!catData || catData.total === 0) continue;

      // Get entries for this category
      const catEntries = diagnostics.entries.filter(e => e.category === cat);
      const loadedCount = catEntries.filter(e => e.loaded === true).length;
      const missingCount = catEntries.filter(e => e.loaded === false && e.status === 'expected').length;
      const unwiredCount = catEntries.filter(e => e.status === 'manifest-only').length;
      const placeholderCount = catEntries.filter(e => e.status === 'placeholder').length;

      const statusParts: string[] = [];
      if (loadedCount > 0) statusParts.push(`<span style="color:#81c784">${loadedCount} loaded</span>`);
      if (missingCount > 0) statusParts.push(`<span style="color:#ff8888">${missingCount} missing</span>`);
      if (unwiredCount > 0) statusParts.push(`<span style="color:#ffcc44">${unwiredCount} unwired</span>`);
      if (placeholderCount > 0) statusParts.push(`<span style="color:#ff9944">${placeholderCount} placeholder</span>`);

      html += `<div style="margin-bottom:2px;"><b>${name}</b>: ${statusParts.join(' | ')}</div>`;

      // Show missing/unwired keys for this category
      const problemEntries = catEntries.filter(e => e.status === 'manifest-only' || (e.status === 'expected' && e.loaded === false));
      if (problemEntries.length > 0 && problemEntries.length <= 8) {
        for (const e of problemEntries) {
          const icon = e.status === 'manifest-only' ? '⚠' : '✗';
          const color = e.status === 'manifest-only' ? '#ffcc44' : '#ff8888';
          html += `<div style="margin-left:8px;font-size:9px;color:${color}">${icon} ${e.key}</div>`;
        }
      } else if (problemEntries.length > 8) {
        html += `<div style="margin-left:8px;font-size:9px;color:#ffcc44">${problemEntries.length} keys (expand for details)</div>`;
      }
    }

    section.innerHTML = html;
    parent.appendChild(section);
  }

  private renderStateOnlySection(parent: HTMLDivElement, diagnostics: RuntimeAssetDiagnostics): void {
    const deferredEntries = diagnostics.entries.filter(e => e.status === 'deferred' || e.status === 'placeholder');
    if (deferredEntries.length === 0) return;

    const section = this.createSection('Deferred / State-Only', '#888');

    let html = '';
    for (const entry of deferredEntries) {
      const icon = entry.status === 'deferred' ? '⏸' : '◇';
      html += `<div style="margin-bottom:1px;"><span style="color:#888">${icon}</span> ${entry.key} <span style="color:#666;font-size:9px">(${entry.status})</span></div>`;
    }
    html += `<div style="margin-top:3px;font-size:9px;color:#666;">⏸=deferred ◇=placeholder</div>`;

    section.innerHTML = html;
    parent.appendChild(section);
  }

  private createSection(title: string, color: string): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 8px;
      padding: 4px 6px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `font-weight: 600; font-size: 11px; margin-bottom: 3px; color: ${color};`;
    section.appendChild(titleEl);

    const body = document.createElement('div');
    body.style.cssText = 'font-size: 10px; line-height: 1.5; color: #999;';
    section.appendChild(body);

    // Return body for innerHTML — title is already appended
    // We'll repurpose: remove the body placeholder, use section directly
    section.removeChild(body);
    return section;
  }
}
