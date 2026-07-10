import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, before, after) {
  const original = await readFile(path, 'utf8');
  const index = original.indexOf(before);
  if (index < 0) throw new Error(`${path}: patch marker not found:\n${before}`);
  if (original.indexOf(before, index + before.length) >= 0) {
    throw new Error(`${path}: patch marker is not unique:\n${before}`);
  }
  const updated = original.slice(0, index) + after + original.slice(index + before.length);
  await writeFile(path, updated, 'utf8');
}

const path = 'src/phaser/render/BlockoutVehicleRenderer.ts';

await replaceOnce(
  path,
  `import {\n  debugRenderFlags,\n} from '../../config/debugRenderFlags';`,
  `import {\n  debugRenderFlags,\n} from '../../config/debugRenderFlags';\nimport { BlockoutMotionFeedbackRenderer } from './BlockoutMotionFeedbackRenderer';`,
);

await replaceOnce(
  path,
  `  /** MODULAR-RUNTIME-03A: Live modular vehicle adapter. */\n  private modularAdapter: ModularVehicleLiveAdapter;`,
  `  /** MODULAR-RUNTIME-03A: Live modular vehicle adapter. */\n  private modularAdapter: ModularVehicleLiveAdapter;\n\n  /** Cosmetic projected tracks and dust; renderer-local and never saved. */\n  private motionFeedbackRenderer: BlockoutMotionFeedbackRenderer;`,
);

await replaceOnce(
  path,
  `    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, BLOCKOUT_DEPTH);`,
  `    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, BLOCKOUT_DEPTH);\n    this.motionFeedbackRenderer = new BlockoutMotionFeedbackRenderer(scene, offset, BLOCKOUT_DEPTH);`,
);

await replaceOnce(
  path,
  `  syncFromState(vehicles: BlockoutVehicleState[]): void {\n    const activeIds = new Set<string>();`,
  `  syncFromState(vehicles: BlockoutVehicleState[]): void {\n    this.motionFeedbackRenderer.syncFromState(vehicles, this.scene.time.now);\n    const activeIds = new Set<string>();`,
);

await replaceOnce(
  path,
  `    // MODULAR-RUNTIME-03A: Clean up modular adapter\n    this.modularAdapter.destroy();`,
  `    // Cosmetic movement feedback is renderer-local and owns its Graphics layers.\n    this.motionFeedbackRenderer.destroy();\n\n    // MODULAR-RUNTIME-03A: Clean up modular adapter\n    this.modularAdapter.destroy();`,
);

console.log('Motion feedback renderer integration applied.');
