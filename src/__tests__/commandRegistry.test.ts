/**
 * Command registry unit tests — HOTKEYS-01.
 *
 * Tests the pure TypeScript command registry as a state-layer module.
 * No Phaser mocking required — the registry is purely data-driven.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CommandRegistry,
  registerMvpCommands,
  ensureMvpCommandsRegistered,
  getMvpCommandHotkey,
  commandRegistry,
  type CommandDef,
} from '../state/commandRegistry';

// ─── Helper: fresh registry for each test ──────────────────────────

function freshRegistry(): CommandRegistry {
  return new CommandRegistry();
}

// ─── Test suite ────────────────────────────────────────────────────

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = freshRegistry();
  });

  // ─── Registration ─────────────────────────────────────────────

  describe('register', () => {
    it('registers a command and retrieves it by id', () => {
      const cmd: CommandDef = {
        id: 'test-cmd',
        label: 'Test Command',
        key: 'T',
        category: 'camera',
      };
      expect(registry.register(cmd)).toBe(true);
      const retrieved = registry.get('test-cmd');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test-cmd');
      expect(retrieved!.label).toBe('Test Command');
      expect(retrieved!.key).toBe('T');
      expect(retrieved!.category).toBe('camera');
    });

    it('rejects duplicate command ids', () => {
      const cmd: CommandDef = { id: 'dup', label: 'First', key: 'A', category: 'build' };
      expect(registry.register(cmd)).toBe(true);
      expect(registry.register({ ...cmd })).toBe(false);
    });

    it('does not mutate the original definition', () => {
      const cmd: CommandDef = { id: 'orig', label: 'Original', key: 'O', category: 'camera' };
      registry.register(cmd);
      const retrieved = registry.get('orig');
      expect(retrieved).not.toBe(cmd); // different reference (spread copy)
    });
  });

  // ─── Lookup ───────────────────────────────────────────────────

  describe('findByKey', () => {
    it('finds a command by its key binding', () => {
      registry.register({ id: 'cmd-a', label: 'A', key: 'A', category: 'build' });
      registry.register({ id: 'cmd-b', label: 'B', key: 'B', category: 'produce' });

      const found = registry.findByKey('A');
      expect(found).toBeDefined();
      expect(found!.id).toBe('cmd-a');
    });

    it('returns undefined for unmapped key', () => {
      expect(registry.findByKey('Z')).toBeUndefined();
    });

    it('returns the first match if multiple commands share a key', () => {
      registry.register({ id: 'first', label: 'First', key: 'X', category: 'build' });
      registry.register({ id: 'second', label: 'Second', key: 'X', category: 'produce' });

      const found = registry.findByKey('X');
      expect(found).toBeDefined();
      // Should find one of them (order is insertion order)
      expect(['first', 'second']).toContain(found!.id);
    });
  });

  describe('findByCategory', () => {
    it('returns all commands in a category', () => {
      registry.register({ id: 'a', label: 'A', key: 'A', category: 'build' });
      registry.register({ id: 'b', label: 'B', key: 'B', category: 'build' });
      registry.register({ id: 'c', label: 'C', key: 'C', category: 'produce' });

      const builds = registry.findByCategory('build');
      expect(builds).toHaveLength(2);
      expect(builds.map(c => c.id)).toContain('a');
      expect(builds.map(c => c.id)).toContain('b');
    });

    it('returns empty array for category with no commands', () => {
      expect(registry.findByCategory('debug')).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns all registered commands', () => {
      registry.register({ id: 'a', label: 'A', key: 'A', category: 'build' });
      registry.register({ id: 'b', label: 'B', key: 'B', category: 'produce' });
      expect(registry.list()).toHaveLength(2);
    });
  });

  // ─── Duplicate key detection ──────────────────────────────────

  describe('detectDuplicateKeys', () => {
    it('returns empty when no duplicates exist', () => {
      registry.register({ id: 'a', label: 'A', key: 'A', category: 'build' });
      registry.register({ id: 'b', label: 'B', key: 'B', category: 'produce' });
      expect(registry.detectDuplicateKeys()).toHaveLength(0);
    });

    it('detects duplicate keys across categories', () => {
      registry.register({ id: 'build-x', label: 'Build X', key: 'X', category: 'build' });
      registry.register({ id: 'produce-x', label: 'Produce X', key: 'X', category: 'produce' });

      const conflicts = registry.detectDuplicateKeys();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].key).toBe('X');
      expect(conflicts[0].commands).toContain('build-x');
      expect(conflicts[0].commands).toContain('produce-x');
    });

    it('excludes debug category from duplicate detection', () => {
      // Debug commands often share keys with game commands because they
      // have guard predicates that prevent firing outside debug mode.
      registry.register({ id: 'build-h', label: 'Build H', key: 'H', category: 'build' });
      registry.register({ id: 'debug-h', label: 'Debug Hull', key: 'H', category: 'debug' });

      expect(registry.detectDuplicateKeys()).toHaveLength(0);
    });
  });

  // ─── Hotkey labels ────────────────────────────────────────────

  describe('getHotkeyLabel', () => {
    it('returns label with hotkey in brackets', () => {
      registry.register({ id: 'test', label: 'Separator', key: 'B', category: 'build' });
      expect(registry.getHotkeyLabel('test')).toBe('Separator [B]');
    });

    it('returns just the label if key is empty', () => {
      registry.register({ id: 'nokey', label: 'No Key', key: '', category: 'menu' });
      expect(registry.getHotkeyLabel('nokey')).toBe('No Key');
    });

    it('returns the id if command not found', () => {
      expect(registry.getHotkeyLabel('missing')).toBe('missing');
    });
  });

  // ─── Execution ────────────────────────────────────────────────

  describe('execute', () => {
    it('executes a registered command', () => {
      let called = false;
      registry.register({
        id: 'fire',
        label: 'Fire',
        key: 'F',
        category: 'build',
        execute: () => { called = true; },
      });

      expect(registry.execute('fire')).toBe(true);
      expect(called).toBe(true);
    });

    it('does not execute when enabled predicate returns false', () => {
      let called = false;
      registry.register({
        id: 'guarded',
        label: 'Guarded',
        key: 'G',
        category: 'produce',
        enabled: () => false,
        execute: () => { called = true; },
      });

      expect(registry.execute('guarded')).toBe(false);
      expect(called).toBe(false);
    });

    it('executes when enabled predicate returns true', () => {
      let called = false;
      registry.register({
        id: 'enabled-cmd',
        label: 'Enabled',
        key: 'E',
        category: 'build',
        enabled: () => true,
        execute: () => { called = true; },
      });

      expect(registry.execute('enabled-cmd')).toBe(true);
      expect(called).toBe(true);
    });

    it('returns false for unknown command id', () => {
      expect(registry.execute('nonexistent')).toBe(false);
    });

    it('returns false for command with no execute callback', () => {
      registry.register({ id: 'defonly', label: 'Def Only', key: 'D', category: 'camera' });
      expect(registry.execute('defonly')).toBe(false);
    });
  });

  describe('executeByKey', () => {
    it('executes command matching the key', () => {
      let called = false;
      registry.register({
        id: 'cmd-b',
        label: 'Build',
        key: 'B',
        category: 'build',
        execute: () => { called = true; },
      });

      expect(registry.executeByKey('B')).toBe('cmd-b');
      expect(called).toBe(true);
    });

    it('prioritizes non-debug commands over debug commands', () => {
      let gameCalled = false;
      let debugCalled = false;

      registry.register({
        id: 'debug-h',
        label: 'Hull Layer',
        key: 'H',
        category: 'debug',
        execute: () => { debugCalled = true; },
      });
      registry.register({
        id: 'game-h',
        label: 'Train Harvester',
        key: 'H',
        category: 'produce',
        execute: () => { gameCalled = true; },
      });

      // Game command should take priority
      const result = registry.executeByKey('H');
      expect(result).toBe('game-h');
      expect(gameCalled).toBe(true);
      expect(debugCalled).toBe(false);
    });

    it('falls back to debug command if no game command matches', () => {
      let debugCalled = false;

      registry.register({
        id: 'debug-t',
        label: 'Toggle Overlay',
        key: 'T',
        category: 'debug',
        execute: () => { debugCalled = true; },
      });

      const result = registry.executeByKey('T');
      expect(result).toBe('debug-t');
      expect(debugCalled).toBe(true);
    });

    it('skips disabled commands and tries next match', () => {
      let enabledCalled = false;

      registry.register({
        id: 'disabled-cmd',
        label: 'Disabled',
        key: 'K',
        category: 'build',
        enabled: () => false,
        execute: () => { /* should not be called */ },
      });
      registry.register({
        id: 'enabled-cmd',
        label: 'Enabled',
        key: 'K',
        category: 'produce',
        execute: () => { enabledCalled = true; },
      });

      expect(registry.executeByKey('K')).toBe('enabled-cmd');
      expect(enabledCalled).toBe(true);
    });

    it('returns null when no command matches the key', () => {
      expect(registry.executeByKey('Z')).toBeNull();
    });
  });

  // ─── Clear ────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all registered commands', () => {
      registry.register({ id: 'a', label: 'A', key: 'A', category: 'build' });
      registry.register({ id: 'b', label: 'B', key: 'B', category: 'produce' });
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });
});

// ─── MVP commands ──────────────────────────────────────────────────

describe('registerMvpCommands', () => {
  beforeEach(() => {
    // We test registerMvpCommands by using the global registry
    // but we need to clear it first to avoid duplicate issues
    commandRegistry.clear();
  });

  it('registers all 10 MVP commands (build-energy-plant removed for visual-ready guard)', () => {
    registerMvpCommands();
    const cmds = commandRegistry.list();
    expect(cmds).toHaveLength(10);
  });

  it('registers camera-reset with key R', () => {
    registerMvpCommands();
    const cmd = commandRegistry.get('camera-reset');
    expect(cmd).toBeDefined();
    expect(cmd!.key).toBe('R');
    expect(cmd!.category).toBe('camera');
  });

  it('registers pause-menu with key ESC', () => {
    registerMvpCommands();
    const cmd = commandRegistry.get('pause-menu');
    expect(cmd).toBeDefined();
    expect(cmd!.key).toBe('ESC');
    expect(cmd!.category).toBe('menu');
  });

  it('registers build commands with correct keys', () => {
    registerMvpCommands();
    expect(commandRegistry.get('build-separator')!.key).toBe('B');
    expect(commandRegistry.get('build-units-factory')!.key).toBe('F');
    expect(commandRegistry.get('build-power-plant')!.key).toBe('P');
    expect(commandRegistry.get('build-raw-storage')!.key).toBe('ONE');
    expect(commandRegistry.get('build-matter-storage')!.key).toBe('TWO');
    expect(commandRegistry.get('build-element-storage')!.key).toBe('THREE');
  });

  it('does not register build-energy-plant (visual-ready guard)', () => {
    registerMvpCommands();
    expect(commandRegistry.get('build-energy-plant')).toBeUndefined();
  });

  it('registers produce commands with correct keys', () => {
    registerMvpCommands();
    expect(commandRegistry.get('produce-builder')!.key).toBe('N');
    expect(commandRegistry.get('produce-harvester')!.key).toBe('G');
  });

  it('no duplicate keys among MVP commands', () => {
    registerMvpCommands();
    const conflicts = commandRegistry.detectDuplicateKeys();
    expect(conflicts).toHaveLength(0);
  });

  it('Escape and R commands do not conflict with other commands', () => {
    registerMvpCommands();
    // ESC should only map to pause-menu
    const escCmds = commandRegistry.list().filter(c => c.key === 'ESC');
    expect(escCmds).toHaveLength(1);
    expect(escCmds[0].id).toBe('pause-menu');

    // R should only map to camera-reset
    const rCmds = commandRegistry.list().filter(c => c.key === 'R');
    expect(rCmds).toHaveLength(1);
    expect(rCmds[0].id).toBe('camera-reset');
  });

  it('command labels and hotkeys are stable', () => {
    registerMvpCommands();
    // Verify exact labels — these are used for UI display
    expect(commandRegistry.get('camera-reset')!.label).toBe('Camera Reset');
    expect(commandRegistry.get('pause-menu')!.label).toBe('Pause / Menu');
    expect(commandRegistry.get('build-separator')!.label).toBe('Build Separator');
    expect(commandRegistry.get('build-units-factory')!.label).toBe('Build Units Factory');
    expect(commandRegistry.get('build-power-plant')!.label).toBe('Build Power Plant');
    expect(commandRegistry.get('produce-builder')!.label).toBe('Train Builder');
    expect(commandRegistry.get('produce-harvester')!.label).toBe('Train Harvester');
  });

  // ─── Idempotency tests (PR #111 fixup — Issue 1) ─────────────

  describe('idempotency', () => {
    it('calling registerMvpCommands() twice keeps exactly 10 commands (build-energy-plant removed)', () => {
      registerMvpCommands();
      registerMvpCommands();
      expect(commandRegistry.list()).toHaveLength(10);
    });

    it('second call does not create duplicate key conflicts', () => {
      registerMvpCommands();
      registerMvpCommands();
      const conflicts = commandRegistry.detectDuplicateKeys();
      expect(conflicts).toHaveLength(0);
    });

    it('second call preserves existing execute callback', () => {
      registerMvpCommands();

      // Wire an execute callback (simulating GameInputController wiring)
      const cmd = commandRegistry.get('build-separator')!;
      let called = false;
      cmd.execute = () => { called = true; };

      // Call registerMvpCommands again (simulating scene recreation)
      registerMvpCommands();

      // The execute callback should still be present
      const afterReregister = commandRegistry.get('build-separator')!;
      expect(afterReregister.execute).toBeDefined();
      afterReregister.execute!();
      expect(called).toBe(true);
    });

    it('second call preserves existing enabled callback', () => {
      registerMvpCommands();

      // Wire an enabled predicate
      const cmd = commandRegistry.get('produce-builder')!;
      let checkCount = 0;
      cmd.enabled = () => { checkCount++; return true; };

      // Call registerMvpCommands again
      registerMvpCommands();

      // The enabled callback should still be present
      const afterReregister = commandRegistry.get('produce-builder')!;
      expect(afterReregister.enabled).toBeDefined();
      afterReregister.enabled!();
      expect(checkCount).toBe(1);
    });

    it('second call updates definition fields while preserving callbacks', () => {
      registerMvpCommands();

      // Wire callbacks
      const cmd = commandRegistry.get('build-separator')!;
      let called = false;
      cmd.execute = () => { called = true; };
      cmd.enabled = () => true;

      // Re-register — definition fields are updated, callbacks preserved
      registerMvpCommands();

      const afterReregister = commandRegistry.get('build-separator')!;
      expect(afterReregister.label).toBe('Build Separator');
      expect(afterReregister.key).toBe('B');
      expect(afterReregister.category).toBe('build');
      expect(afterReregister.execute).toBeDefined();
      expect(afterReregister.enabled).toBeDefined();
      afterReregister.execute!();
      expect(called).toBe(true);
    });
  });
});

// ─── ensureMvpCommandsRegistered & getMvpCommandHotkey (PR #111 fixup — Issue 2) ──

describe('ensureMvpCommandsRegistered', () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  it('registers MVP commands when registry is empty', () => {
    ensureMvpCommandsRegistered();
    expect(commandRegistry.list()).toHaveLength(10);
  });

  it('is idempotent — repeated calls keep exactly 10 commands', () => {
    ensureMvpCommandsRegistered();
    ensureMvpCommandsRegistered();
    ensureMvpCommandsRegistered();
    expect(commandRegistry.list()).toHaveLength(10);
  });

  it('does not remove existing execute callbacks', () => {
    registerMvpCommands();
    const cmd = commandRegistry.get('build-separator')!;
    let called = false;
    cmd.execute = () => { called = true; };

    ensureMvpCommandsRegistered();

    commandRegistry.get('build-separator')!.execute!();
    expect(called).toBe(true);
  });
});

describe('getMvpCommandHotkey', () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  it('returns correct hotkey for registered MVP command', () => {
    registerMvpCommands();
    expect(getMvpCommandHotkey('build-separator')).toBe('B');
    expect(getMvpCommandHotkey('camera-reset')).toBe('R');
    expect(getMvpCommandHotkey('pause-menu')).toBe('ESC');
  });

  it('resolves hotkey even when registry was empty before call', () => {
    // Simulates PlaytestHud creating buttons before GameInputController
    expect(getMvpCommandHotkey('build-separator')).toBe('B');
    expect(getMvpCommandHotkey('produce-builder')).toBe('N');
  });

  it('returns empty string for unknown command id', () => {
    registerMvpCommands();
    expect(getMvpCommandHotkey('nonexistent')).toBe('');
  });

  it('does not duplicate commands when called multiple times', () => {
    getMvpCommandHotkey('build-separator');
    getMvpCommandHotkey('build-separator');
    getMvpCommandHotkey('produce-builder');
    expect(commandRegistry.list()).toHaveLength(10);
  });
});

// Clean up global registry after all tests
afterEach(() => {
  commandRegistry.clear();
});
