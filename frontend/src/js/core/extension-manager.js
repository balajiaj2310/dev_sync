/**
 * DevSync Extension Manager
 * Modular, extensible engine for managing IDE extension lifecycle.
 * Supports register, enable, disable, and persist across sessions via localStorage.
 *
 * Usage:
 *   import { ExtensionManager } from './extension-manager.js';
 *   ExtensionManager.registerExtension(manifest, activateFn);
 *   ExtensionManager.enableExtension('vim-mode');
 */

const STORAGE_KEY = 'devsync_extensions_state';

/** @type {Map<string, { manifest: ExtensionManifest, activate: Function, deactivate: Function|null, enabled: boolean, loaded: boolean, instance: any }>} */
const _registry = new Map();

/** Persisted settings blob: { [id]: { enabled: boolean, settings: object } } */
let _persisted = {};

function _loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _persisted = JSON.parse(raw);
  } catch {
    _persisted = {};
  }
}

function _savePersisted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_persisted));
  } catch {
    /* storage full or private mode */
  }
}

/**
 * @typedef {Object} ExtensionManifest
 * @property {string} id          - Unique extension identifier (e.g., 'vim-mode')
 * @property {string} name        - Display name
 * @property {string} description - Short description
 * @property {string} category    - 'theme' | 'formatter' | 'keybinding' | 'productivity' | 'preview'
 * @property {string} [version]   - Semver string
 * @property {string} [icon]      - Emoji or SVG string used in the marketplace
 * @property {boolean} [bundled]  - True if shipped as a starter extension
 * @property {string[]} [tags]    - Searchable tags
 */

export const ExtensionManager = {
  /**
   * Register an extension with its manifest and activate/deactivate functions.
   * @param {ExtensionManifest} manifest
   * @param {Function} activateFn   - Called with (context) when extension is enabled
   * @param {Function} [deactivateFn] - Called with (context) when extension is disabled
   */
  registerExtension(manifest, activateFn, deactivateFn = null) {
    if (!manifest?.id) {
      console.warn('[ExtensionManager] registerExtension: manifest.id is required.');
      return;
    }
    if (_registry.has(manifest.id)) {
      console.warn(`[ExtensionManager] Extension "${manifest.id}" is already registered.`);
      return;
    }

    // Load persisted enabled state; default to manifest's default or false
    const persisted = _persisted[manifest.id] || {};
    const enabled = typeof persisted.enabled === 'boolean'
      ? persisted.enabled
      : (manifest.enabledByDefault === true);

    _registry.set(manifest.id, {
      manifest,
      activate: activateFn,
      deactivate: deactivateFn,
      enabled,
      loaded: false,
      instance: null
    });
  },

  /**
   * Enable an extension by id. Calls its activateFn if not already loaded.
   * @param {string} id
   * @param {object} [context] - Shared context (e.g., { monaco, editor, getActiveTab })
   */
  async enableExtension(id, context = {}) {
    const entry = _registry.get(id);
    if (!entry) {
      console.warn(`[ExtensionManager] enableExtension: "${id}" not found in registry.`);
      return;
    }
    if (entry.enabled && entry.loaded) return; // Already active

    try {
      const instance = await entry.activate(context);
      entry.enabled = true;
      entry.loaded = true;
      entry.instance = instance || null;

      if (!_persisted[id]) _persisted[id] = {};
      _persisted[id].enabled = true;
      _savePersisted();

      console.info(`[ExtensionManager] Extension "${id}" enabled.`);
      ExtensionManager._emit('enabled', { id, manifest: entry.manifest });
    } catch (err) {
      console.error(`[ExtensionManager] Failed to enable "${id}":`, err);
    }
  },

  /**
   * Disable an extension by id. Calls its deactivateFn if present.
   * @param {string} id
   * @param {object} [context]
   */
  async disableExtension(id, context = {}) {
    const entry = _registry.get(id);
    if (!entry) return;
    if (!entry.enabled) return;

    try {
      if (entry.deactivate) {
        await entry.deactivate({ ...context, instance: entry.instance });
      }
      entry.enabled = false;
      entry.loaded = false;
      entry.instance = null;

      if (!_persisted[id]) _persisted[id] = {};
      _persisted[id].enabled = false;
      _savePersisted();

      console.info(`[ExtensionManager] Extension "${id}" disabled.`);
      ExtensionManager._emit('disabled', { id, manifest: entry.manifest });
    } catch (err) {
      console.error(`[ExtensionManager] Failed to disable "${id}":`, err);
    }
  },

  /**
   * Toggle an extension on/off.
   * @param {string} id
   * @param {object} [context]
   */
  async toggleExtension(id, context = {}) {
    const entry = _registry.get(id);
    if (!entry) return;
    if (entry.enabled) {
      await ExtensionManager.disableExtension(id, context);
    } else {
      await ExtensionManager.enableExtension(id, context);
    }
  },

  /**
   * Returns all registered extensions with their current state.
   * @returns {Array<{ manifest: ExtensionManifest, enabled: boolean }>}
   */
  getInstalledExtensions() {
    return Array.from(_registry.values()).map(e => ({
      manifest: e.manifest,
      enabled: e.enabled,
      loaded: e.loaded
    }));
  },

  /**
   * Check if a specific extension is currently enabled.
   * @param {string} id
   * @returns {boolean}
   */
  isEnabled(id) {
    return _registry.get(id)?.enabled === true;
  },

  /**
   * Get extension instance (returned value from activateFn).
   * @param {string} id
   */
  getInstance(id) {
    return _registry.get(id)?.instance || null;
  },

  /**
   * Get persisted user setting for an extension.
   * @param {string} id
   * @param {string} key
   * @param {*} defaultValue
   */
  getSetting(id, key, defaultValue = null) {
    return _persisted[id]?.settings?.[key] ?? defaultValue;
  },

  /**
   * Persist a user setting for an extension.
   * @param {string} id
   * @param {string} key
   * @param {*} value
   */
  setSetting(id, key, value) {
    if (!_persisted[id]) _persisted[id] = {};
    if (!_persisted[id].settings) _persisted[id].settings = {};
    _persisted[id].settings[key] = value;
    _savePersisted();
  },

  /**
   * Boot all extensions that were previously enabled (restores session state).
   * Should be called once after Monaco is ready.
   * @param {object} context
   */
  async bootPersistedExtensions(context = {}) {
    const toEnable = Array.from(_registry.values()).filter(e => e.enabled && !e.loaded);
    for (const entry of toEnable) {
      await ExtensionManager.enableExtension(entry.manifest.id, context);
    }
  },

  // ── Simple event bus ────────────────────────────────────────────────────────
  _listeners: new Map(),

  on(event, fn) {
    if (!ExtensionManager._listeners.has(event)) {
      ExtensionManager._listeners.set(event, []);
    }
    ExtensionManager._listeners.get(event).push(fn);
  },

  off(event, fn) {
    const arr = ExtensionManager._listeners.get(event) || [];
    ExtensionManager._listeners.set(event, arr.filter(f => f !== fn));
  },

  _emit(event, data) {
    (ExtensionManager._listeners.get(event) || []).forEach(fn => {
      try { fn(data); } catch { /* swallow listener errors */ }
    });
  }
};

// Initialize on module load
_loadPersisted();
