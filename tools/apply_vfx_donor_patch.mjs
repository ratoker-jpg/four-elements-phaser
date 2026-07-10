import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, before, after) {
  const original = await readFile(path, 'utf8');
  const index = original.indexOf(before);
  if (index < 0) {
    throw new Error(`${path}: patch marker not found:\n${before}`);
  }
  if (original.indexOf(before, index + before.length) >= 0) {
    throw new Error(`${path}: patch marker is not unique:\n${before}`);
  }
  const updated = original.slice(0, index) + after + original.slice(index + before.length);
  await writeFile(path, updated, 'utf8');
}

async function patchProfiles() {
  const path = 'src/config/blockoutProfiles.ts';
  await replaceOnce(
    path,
    `  /** Charge pulse duration in ms for shaft. BLOCKOUT-06H+. */\n  chargePulseMs?: number;\n}`,
    `  /** Charge pulse duration in ms for shaft. BLOCKOUT-06H+. */\n  chargePulseMs?: number;\n  /** Optional runtime texture keys. Graphics primitives remain the fallback. */\n  muzzleTextureKey?: string;\n  trailTextureKey?: string;\n  impactTextureKey?: string;\n  smokeTextureKey?: string;\n  noiseTextureKey?: string;\n  /** Display sizing for the pooled texture overlay. */\n  muzzleTextureSizePx?: number;\n  trailTextureWidthPx?: number;\n  impactTextureSizePx?: number;\n  smokeTextureSizePx?: number;\n  noiseTextureSizePx?: number;\n}`,
  );
}

async function patchVfxData() {
  const path = 'src/config/blockoutVfxData.ts';
  await replaceOnce(
    path,
    `import { getWeaponProfile } from './blockoutWeaponData';`,
    `import { getWeaponProfile } from './blockoutWeaponData';\nimport { WEAPON_VFX_ASSET_KEYS } from '../assets/weaponVfxAssets';`,
  );

  const replacements = [
    [
      `    effectLengthPx: 250,\n  },`,
      `    effectLengthPx: 250,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.MUZZLE_FLARE,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.IMPACT_SPARK,\n    muzzleTextureSizePx: 30,\n    trailTextureWidthPx: 8,\n    impactTextureSizePx: 28,\n  },`,
    ],
    [
      `    effectLengthPx: 200,\n  },`,
      `    effectLengthPx: 200,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.MUZZLE_FLARE,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.EXPLOSION,\n    smokeTextureKey: WEAPON_VFX_ASSET_KEYS.ROUND_SMOKE,\n    muzzleTextureSizePx: 34,\n    trailTextureWidthPx: 10,\n    impactTextureSizePx: 86,\n    smokeTextureSizePx: 64,\n  },`,
    ],
    [
      `    effectLengthPx: 400,\n  },`,
      `    effectLengthPx: 400,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_HIT,\n    muzzleTextureSizePx: 44,\n    trailTextureWidthPx: 12,\n    impactTextureSizePx: 44,\n  },`,
    ],
    [
      `    chargePulseMs: 150,\n  },`,
      `    chargePulseMs: 150,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_HIT,\n    muzzleTextureSizePx: 40,\n    trailTextureWidthPx: 8,\n    impactTextureSizePx: 36,\n  },`,
    ],
    [
      `    streamCadenceMs: 50,\n  },`,
      `    streamCadenceMs: 50,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.FIRE_STREAM,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ROUND_SMOKE,\n    noiseTextureKey: WEAPON_VFX_ASSET_KEYS.CLOUD_NOISE,\n    muzzleTextureSizePx: 42,\n    impactTextureSizePx: 52,\n    noiseTextureSizePx: 48,\n  },`,
    ],
    [
      `    effectLengthPx: 150,\n    streamCadenceMs: 50,\n  },`,
      `    effectLengthPx: 150,\n    streamCadenceMs: 50,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    muzzleTextureSizePx: 30,\n    trailTextureWidthPx: 9,\n    impactTextureSizePx: 30,\n  },`,
    ],
    [
      `    overheatDurationMs: 3000,\n  },`,
      `    overheatDurationMs: 3000,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.MUZZLE_FLARE,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.IMPACT_SPARK,\n    smokeTextureKey: WEAPON_VFX_ASSET_KEYS.ROUND_SMOKE,\n    muzzleTextureSizePx: 24,\n    trailTextureWidthPx: 6,\n    impactTextureSizePx: 24,\n    smokeTextureSizePx: 34,\n  },`,
    ],
    [
      `    streamCadenceMs: 600,\n  },`,
      `    streamCadenceMs: 600,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_HIT,\n    muzzleTextureSizePx: 28,\n    trailTextureWidthPx: 12,\n    impactTextureSizePx: 34,\n  },`,
    ],
    [
      `    bounceCount: 2,\n  },`,
      `    bounceCount: 2,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.ENERGY_HIT,\n    muzzleTextureSizePx: 30,\n    trailTextureWidthPx: 10,\n    impactTextureSizePx: 34,\n  },`,
    ],
    [
      `    pelletCount: 5,\n  },`,
      `    pelletCount: 5,\n    muzzleTextureKey: WEAPON_VFX_ASSET_KEYS.HAMMER_BLAST,\n    trailTextureKey: WEAPON_VFX_ASSET_KEYS.TRAIL,\n    impactTextureKey: WEAPON_VFX_ASSET_KEYS.IMPACT_SPARK,\n    smokeTextureKey: WEAPON_VFX_ASSET_KEYS.ROUND_SMOKE,\n    muzzleTextureSizePx: 52,\n    trailTextureWidthPx: 7,\n    impactTextureSizePx: 28,\n    smokeTextureSizePx: 42,\n  },`,
    ],
  ];

  for (const [before, after] of replacements) {
    await replaceOnce(path, before, after);
  }
}

async function patchPreload() {
  const path = 'src/phaser/PreloadScene.ts';
  await replaceOnce(
    path,
    `import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadArenaVisualAssets, loadGeneratedTerrainAndResourceAssets, loadGeneratedIndustrialTerrainAssets, loadGeneratedIndustrialFrameAssets, loadGeneratedIndustrialResourceAssets } from '../assets/runtimeGeneratedAssets';`,
    `import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadArenaVisualAssets, loadGeneratedTerrainAndResourceAssets, loadGeneratedIndustrialTerrainAssets, loadGeneratedIndustrialFrameAssets, loadGeneratedIndustrialResourceAssets } from '../assets/runtimeGeneratedAssets';\nimport { loadWeaponVfxAssets } from '../assets/weaponVfxAssets';`,
  );
  await replaceOnce(
    path,
    `    // --- Civil unit spritesheets (loaded from generated manifest) ---\n    loadGeneratedCivilUnitAssets(this);`,
    `    // --- Civil unit spritesheets (loaded from generated manifest) ---\n    loadGeneratedCivilUnitAssets(this);\n\n    // --- Compact donor weapon VFX textures (always loaded, 10 alpha PNGs) ---\n    const weaponVfxAssets = loadWeaponVfxAssets(this);\n    console.log(\`[PreloadScene] Weapon VFX textures queued: \${weaponVfxAssets.length}\`);`,
  );
}

async function patchRenderer() {
  const path = 'src/phaser/render/BlockoutWeaponVfxRenderer.ts';
  await replaceOnce(
    path,
    `import { getWeaponVfxProfile } from '../../config/blockoutVfxData';`,
    `import { getWeaponVfxProfile } from '../../config/blockoutVfxData';\nimport { TextureWeaponVfxRenderer } from './TextureWeaponVfxRenderer';`,
  );
  await replaceOnce(
    path,
    `  /** Graphics object for VFX rendering. */\n  private graphics: Phaser.GameObjects.Graphics | null = null;`,
    `  /** Graphics object for VFX rendering and guaranteed fallback. */\n  private graphics: Phaser.GameObjects.Graphics | null = null;\n\n  /** Pooled PNG overlay imported from the Godot donor project. */\n  private readonly textureRenderer: TextureWeaponVfxRenderer;`,
  );
  await replaceOnce(
    path,
    `  constructor(scene: Phaser.Scene, _offset: IsoPoint) {\n    this.scene = scene;\n  }`,
    `  constructor(scene: Phaser.Scene, _offset: IsoPoint) {\n    this.scene = scene;\n    this.textureRenderer = new TextureWeaponVfxRenderer(scene);\n  }`,
  );
  await replaceOnce(
    path,
    `      this.renderVfxEvent(event, vfxProfile, alpha, ageMs, durationMs);\n    }\n  }`,
    `      this.renderVfxEvent(event, vfxProfile, alpha, ageMs, durationMs);\n    }\n\n    this.textureRenderer.syncFromState(nowMs);\n  }`,
  );
  await replaceOnce(
    path,
    `  destroy(): void {\n    if (this.graphics) {`,
    `  destroy(): void {\n    this.textureRenderer.destroy();\n    if (this.graphics) {`,
  );
}

async function patchPackage() {
  const path = 'package.json';
  await replaceOnce(
    path,
    `    "validate": "npm run check:project-status && npm run typecheck && npm test && npm audit --audit-level=high",`,
    `    "validate": "npm run check:project-status && npm run validate:vfx-alpha && npm run typecheck && npm test && npm audit --audit-level=high",`,
  );
  await replaceOnce(
    path,
    `    "check:asset-budget": "node tools/check_asset_budget.mjs dist",`,
    `    "check:asset-budget": "node tools/check_asset_budget.mjs dist",\n    "validate:vfx-alpha": "node tools/validate_vfx_alpha.mjs",`,
  );
}

async function patchValidationWorkflow() {
  const path = '.github/workflows/validation.yml';
  await replaceOnce(
    path,
    `      - name: Project status consistency\n        run: npm run check:project-status\n\n      - name: Typecheck`,
    `      - name: Project status consistency\n        run: npm run check:project-status\n\n      - name: VFX alpha integrity\n        run: npm run validate:vfx-alpha\n\n      - name: Typecheck`,
  );
}

await patchProfiles();
await patchVfxData();
await patchPreload();
await patchRenderer();
await patchPackage();
await patchValidationWorkflow();
console.log('VFX donor integration patches applied.');
