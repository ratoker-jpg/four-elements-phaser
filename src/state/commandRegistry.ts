/**
 * Command Registry — centralized hotkey / command definitions.
 *
 * HOTKEYS-01: Provides a single source-of-truth for all registered
 * commands, their hotkeys, labels, categories, and enabled predicates.
 *
 * Design goals:
 * - Keys are not scattered — all definitions live here.
 * - UI can show hotkey hints from registry data.
 * - Future unit/building commands can reuse the same structure.
 * - Conflicting keys are easier to detect.
 * - StarCraft-like control can be added incrementally.
 *
 * Architecture:
 * - Pure TypeScript, no Phaser imports (state layer).
 * - Commands are *definitions* — they describe what exists.
 * - Execution wiring happens at the input layer (GameInputController).
 * - The registry is a singleton for simplicity in this MVP phase.
 */

// ─── Types ──────────────────────────────────────────────────────────

/** Command categories for grouping and UI display. */
export type CommandCategory = 'camera' | 'menu' | 'build' | 'produce' | 'debug';

/** A single command definition. */
export interface CommandDef {
  /** Unique identifier, e.g. 'build-separator', 'camera-reset'. */
  id: string;
  /** Human-readable label, e.g. 'Build Separator', 'Camera Reset'. */
  label: string;
  /** Keyboard key that triggers this command (Phaser key code string, e.g. 'B', 'ESC', 'R'). */
  key: string;
  /** Category for grouping and UI display. */
  category: CommandCategory;
  /**
   * Optional enabled predicate.
   * If provided, the command should only execute when this returns true.
   * Used for context-sensitive commands (e.g., production only when factory exists).
   */
  enabled?: () => boolean;
  /**
   * Optional action callback.
   * Set at wire time by GameInputController — the registry itself
   * does not depend on Phaser or gameplay state.
   * If not set, the command is definition-only (for UI display).
   */
  execute?: () => void;
}

// ─── Registry class ─────────────────────────────────────────────────

/**
 * CommandRegistry — manages registered command definitions.
 *
 * Singleton pattern for this MVP: one global registry instance.
 * Future iterations may support per-scene or per-context registries.
 */
export class CommandRegistry {
  private commands: Map<string, CommandDef> = new Map();

  /** Register a command definition. Returns false if id already exists. */
  register(def: CommandDef): boolean {
    if (this.commands.has(def.id)) {
      console.warn(`[CommandRegistry] Duplicate command id: ${def.id}`);
      return false;
    }
    this.commands.set(def.id, { ...def });
    return true;
  }

  /** Get a command by its unique id. Returns undefined if not found. */
  get(id: string): CommandDef | undefined {
    return this.commands.get(id);
  }

  /** Find a command by its key binding. Returns the first match. */
  findByKey(key: string): CommandDef | undefined {
    for (const cmd of this.commands.values()) {
      if (cmd.key === key) return cmd;
    }
    return undefined;
  }

  /** Find all commands by category. */
  findByCategory(category: CommandCategory): CommandDef[] {
    const result: CommandDef[] = [];
    for (const cmd of this.commands.values()) {
      if (cmd.category === category) result.push(cmd);
    }
    return result;
  }

  /** List all registered commands. */
  list(): CommandDef[] {
    return [...this.commands.values()];
  }

  /**
   * Detect duplicate key bindings across categories.
   * Returns an array of conflict descriptions.
   * Commands within the 'debug' category are allowed to share keys
   * with other categories since they have their own guard predicates.
   */
  detectDuplicateKeys(): Array<{ key: string; commands: string[] }> {
    const keyMap = new Map<string, string[]>();
    for (const cmd of this.commands.values()) {
      // Skip debug commands from duplicate detection — they have guard predicates
      // that prevent them from firing outside debug mode.
      if (cmd.category === 'debug') continue;
      const existing = keyMap.get(cmd.key) ?? [];
      existing.push(cmd.id);
      keyMap.set(cmd.key, existing);
    }
    const conflicts: Array<{ key: string; commands: string[] }> = [];
    for (const [key, ids] of keyMap) {
      if (ids.length > 1) {
        conflicts.push({ key, commands: ids });
      }
    }
    return conflicts;
  }

  /**
   * Get the hotkey label for a command id.
   * Returns the label with hotkey in brackets, e.g. "Separator [B]".
   * Returns just the label if command not found or has no key.
   */
  getHotkeyLabel(id: string): string {
    const cmd = this.commands.get(id);
    if (!cmd) return id;
    if (cmd.key) return `${cmd.label} [${cmd.key}]`;
    return cmd.label;
  }

  /**
   * Execute a command by id, respecting the enabled predicate.
   * Returns true if the command was executed, false otherwise.
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    if (cmd.enabled && !cmd.enabled()) return false;
    if (cmd.execute) {
      cmd.execute();
      return true;
    }
    return false;
  }

  /**
   * Try to execute a command by key, respecting the enabled predicate.
   * Returns the executed command id, or null if no command was executed.
   */
  executeByKey(key: string): string | null {
    // Check non-debug commands first (they take priority)
    for (const cmd of this.commands.values()) {
      if (cmd.category === 'debug') continue;
      if (cmd.key === key) {
        if (cmd.enabled && !cmd.enabled()) continue;
        if (cmd.execute) {
          cmd.execute();
          return cmd.id;
        }
      }
    }
    // Then check debug commands
    for (const cmd of this.commands.values()) {
      if (cmd.category !== 'debug') continue;
      if (cmd.key === key) {
        if (cmd.enabled && !cmd.enabled()) continue;
        if (cmd.execute) {
          cmd.execute();
          return cmd.id;
        }
      }
    }
    return null;
  }

  /** Clear all registered commands. Useful for testing. */
  clear(): void {
    this.commands.clear();
  }
}

// ─── Singleton instance ─────────────────────────────────────────────

/** Global command registry instance. */
export const commandRegistry = new CommandRegistry();

// ─── Default MVP command definitions ────────────────────────────────

/**
 * MVP command definitions — data-only, no execute callbacks.
 *
 * These use the CURRENT established key bindings.
 * Proposed remappings (S for separator, H for harvester, B for builder)
 * are deferred — see PR body for rationale.
 *
 * Execute callbacks are NOT set here — they are wired by
 * GameInputController at setup time, because the registry
 * is pure TS (state layer) and must not import Phaser or
 * depend on gameplay subsystems.
 */
const MVP_COMMAND_DEFS: CommandDef[] = [
  { id: 'camera-reset', label: 'Camera Reset', key: 'R', category: 'camera' },
  { id: 'pause-menu', label: 'Pause / Menu', key: 'ESC', category: 'menu' },
  { id: 'build-separator', label: 'Build Separator', key: 'B', category: 'build' },
  { id: 'build-raw-storage', label: 'Build Raw Storage', key: 'ONE', category: 'build' },
  { id: 'build-matter-storage', label: 'Build Energy Storage', key: 'TWO', category: 'build' },
  { id: 'build-element-storage', label: 'Build Elements Storage', key: 'THREE', category: 'build' },
  { id: 'build-power-plant', label: 'Build Power Plant', key: 'P', category: 'build' },
  { id: 'build-energy-plant', label: 'Build Energy Reactor', key: 'FOUR', category: 'build' },
  { id: 'build-units-factory', label: 'Build Units Factory', key: 'F', category: 'build' },
  { id: 'produce-builder', label: 'Train Builder', key: 'N', category: 'produce' },
  { id: 'produce-harvester', label: 'Train Harvester', key: 'G', category: 'produce' },
];

/**
 * Register all safe MVP commands.
 *
 * Idempotent: calling this multiple times is safe.
 * - If a command ID already exists, its definition fields (label, key, category)
 *   are updated in place while preserving any execute/enabled callbacks
 *   that were wired by GameInputController.
 * - If a command ID does not exist yet, it is registered normally.
 * - No duplicate warnings are emitted on repeated calls.
 */
export function registerMvpCommands(): void {
  for (const def of MVP_COMMAND_DEFS) {
    const existing = commandRegistry.get(def.id);
    if (existing) {
      // Update definition fields but preserve execute/enabled callbacks
      existing.label = def.label;
      existing.key = def.key;
      existing.category = def.category;
    } else {
      commandRegistry.register(def);
    }
  }
}

/**
 * Ensure MVP commands are registered — convenience wrapper.
 *
 * Identical to registerMvpCommands() but named for clarity at call sites
 * that only need to guarantee definitions exist (e.g., PlaytestHud label
 * lookups) rather than performing initial registration.
 */
export function ensureMvpCommandsRegistered(): void {
  registerMvpCommands();
}

/**
 * Get the hotkey for an MVP command by id, ensuring definitions exist first.
 *
 * Safe to call from any initialization order — will register MVP command
 * definitions if they haven't been registered yet, without overwriting
 * any execute/enabled callbacks already wired.
 * Returns the key string or empty string if the command has no key.
 */
export function getMvpCommandHotkey(commandId: string): string {
  ensureMvpCommandsRegistered();
  const cmd = commandRegistry.get(commandId);
  return cmd?.key ?? '';
}
