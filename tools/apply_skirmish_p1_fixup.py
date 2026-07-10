from pathlib import Path

path = Path('src/phaser/GameScene.ts')
text = path.read_text(encoding='utf-8')
old = '''
    // SKIRMISH-P1: destroyed vehicles become non-interactive wrecks, then
    // leave canonical state after a bounded delay. Run before render sync so
    // stale adapters, selection and target references disappear this frame.
    if (this.gameState.blockoutVehicles && this.devtoolsActive) {
      const destruction = updateBlockoutDestructionLifecycle(
        this.gameState.blockoutVehicles,
        this.time.now,
        this.reservationMap ?? undefined,
      );
      const selectedId = this.blockoutVehicleInputController?.selectedVehicleId ?? null;
      if (selectedId && destruction.destroyedIds.includes(selectedId)) {
        this.blockoutVehicleInputController?.setSelectedVehicleId(null);
      }
    }
'''
new = '''
    if (this.gameState.blockoutVehicles && this.devtoolsActive && updateBlockoutDestructionLifecycle(this.gameState.blockoutVehicles, this.time.now, this.reservationMap ?? undefined).destroyedIds.includes(this.blockoutVehicleInputController?.selectedVehicleId ?? '')) this.blockoutVehicleInputController?.setSelectedVehicleId(null);
'''
if new in text:
    print('SKIRMISH-P1 line-budget fixup already applied')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('SKIRMISH-P1 line-budget fixup applied')
else:
    raise SystemExit('Expected GameScene destruction block not found')
