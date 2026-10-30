/**
 * DevSync Code Workspace & Browser IDE Controller — v2.0
 * Handles Monaco editor lifecycle, multi-tab file editing, tree navigation,
 * real code execution, Git operations, external IDE integration,
 * Activity Bar, Extensions Marketplace, Visual Git Diff, Quick File Picker,
 * and AI Coding Assistant integration.
 */

import { WorkspaceService } from '../services/workspace-service.js';
import { ExtensionManager } from '../core/extension-manager.js';
import {
  setExtensionContext,
  registerAllThemes,
  getThemeList,
  openMdPreview,
  closeMdPreview,
  formatDocumentWithPrettier,
  updateTodoDecorations
} from '../services/workspace-extensions.js';

// ─── Core state ──────────────────────────────────────────────────────────────
let currentRepoId = 'devsync-core';
let currentBranch = 'main';
let currentRepoInfo = null;
let monacoEditorInstance = null;
let monacoDiffEditor = null;
let monacoModels = new Map(); // path → monaco.editor.ITextModel

// Tab management state
let openTabs = [];      // Array of { path, name, language, dirty, content }
let activeTabPath = null;

// Flat file list for Quick Picker and Global Search
let flatFileList = []; // Array of { path, name }

// Git staged files (path → boolean)
let stagedFiles = new Map();

// Monaco language map
const EXT_TO_MONACO_LANG = {
  '.py': 'python',  '.js': 'javascript', '.mjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.java': 'java', '.html': 'html', '.css': 'css', '.json': 'json',
  '.md': 'markdown', '.markdown': 'markdown',
  '.sql': 'sql', '.sh': 'shell', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
  '.rs': 'rust', '.go': 'go', '.rb': 'ruby', '.php': 'php', '.kt': 'kotlin',
  '.swift': 'swift', '.cs': 'csharp', '.r': 'r'
};

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function initWorkspacePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const repoParam = urlParams.get('repo') || urlParams.get('project');
  if (repoParam) currentRepoId = repoParam.trim();

  const branchParam = urlParams.get('branch');
  if (branchParam) currentBranch = branchParam.trim();

  setupEventListeners();
  await loadWorkspace();
}

// ─── Event listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActiveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runActiveCode();
    }
    // Ctrl+P — Quick File Picker
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      openQuickPicker();
    }
    // Escape — close overlays
    if (e.key === 'Escape') {
      closeQuickPicker();
      closeAiDrawer();
    }
  });

  // Topbar actions
  document.getElementById('saveBtn')?.addEventListener('click', saveActiveFile);
  document.getElementById('runBtn')?.addEventListener('click', runActiveCode);
  document.getElementById('openIdeBtn')?.addEventListener('click', openIdeModal);
  document.getElementById('refreshTreeBtn')?.addEventListener('click', () => loadFileTree());

  // Branch selector
  document.getElementById('workspaceBranchSelect')?.addEventListener('change', async (e) => {
    currentBranch = e.target.value;
    updateDownloadZipUrl();
    updateGitBranchLabels();
    await loadFileTree();
  });

  // Language selector
  document.getElementById('workspaceLangSelect')?.addEventListener('change', (e) => {
    const newLang = e.target.value;
    if (activeTabPath && monacoEditorInstance) {
      const tab = openTabs.find(t => t.path === activeTabPath);
      if (tab) {
        tab.language = newLang;
        const model = monacoEditorInstance.getModel();
        if (model && window.monaco) window.monaco.editor.setModelLanguage(model, newLang);
      }
    }
  });

  // Sidebar collapse toggle
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => {
    document.getElementById('workspaceSidebar')?.classList.toggle('collapsed');
    if (monacoEditorInstance) monacoEditorInstance.layout();
  });

  // Bottom panel tabs
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-tab');
      switchBottomPanelView(view);
    });
  });

  // Bottom panel collapse
  document.getElementById('togglePanelBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('bottomPanel');
    panel?.classList.toggle('collapsed');
    if (monacoEditorInstance) monacoEditorInstance.layout();
  });

  // Clear output
  document.getElementById('clearOutputBtn')?.addEventListener('click', () => {
    const stdout = document.getElementById('stdoutText');
    const stderr = document.getElementById('stderrText');
    if (stdout) stdout.textContent = '';
    if (stderr) stderr.textContent = 'No errors reported.';
    document.getElementById('errorCountBadge').style.display = 'none';
    document.getElementById('aiFixBtnContainer').style.display = 'none';
  });

  // Run with stdin
  document.getElementById('runWithStdinBtn')?.addEventListener('click', () => {
    const stdin = document.getElementById('stdinInput')?.value || '';
    runActiveCode(stdin);
  });

  // Modal triggers
  document.getElementById('newFileBtn')?.addEventListener('click', () => showModal('newFileModal'));
  document.getElementById('newFolderBtn')?.addEventListener('click', () => showModal('newFolderModal'));
  document.getElementById('confirmNewFileBtn')?.addEventListener('click', handleCreateFile);
  document.getElementById('confirmNewFolderBtn')?.addEventListener('click', handleCreateFolder);
  document.getElementById('confirmRenameBtn')?.addEventListener('click', handleRenameConfirm);
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDeleteConfirm);
  document.getElementById('confirmGitCommitBtn')?.addEventListener('click', handleGitCommitConfirm);
  document.getElementById('openCommitModalBtn')?.addEventListener('click', () => showModal('gitCommitModal'));

  // Copy clone URL
  document.getElementById('copyCloneBtn')?.addEventListener('click', () => {
    const text = document.getElementById('httpsCloneUrl')?.textContent || '';
    navigator.clipboard?.writeText(text);
    const btn = document.getElementById('copyCloneBtn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
  });

  // Modal close buttons
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // Drag-resize bottom panel
  initResizeHandle();

  // ── Activity Bar ──────────────────────────────────────────────────────────
  document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel');
      switchActivityPanel(panel, btn);
    });
  });

  // ── Extensions panel tabs ─────────────────────────────────────────────────
  document.querySelectorAll('[data-ext-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-ext-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderExtensionsList(tab.getAttribute('data-ext-tab'));
    });
  });

  // Extensions search input
  document.getElementById('extSearchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const activeTab = document.querySelector('[data-ext-tab].active')?.getAttribute('data-ext-tab') || 'all';
    renderExtensionsList(activeTab, q);
  });

  // ── Settings panel ────────────────────────────────────────────────────────
  document.getElementById('settingFontSize')?.addEventListener('input', (e) => {
    const size = parseInt(e.target.value, 10);
    document.getElementById('settingFontSizeVal').textContent = size;
    monacoEditorInstance?.updateOptions({ fontSize: size });
    ExtensionManager.setSetting('editor', 'fontSize', size);
  });

  document.getElementById('settingTabSize')?.addEventListener('change', (e) => {
    const size = parseInt(e.target.value, 10);
    monacoEditorInstance?.updateOptions({ tabSize: size });
    ExtensionManager.setSetting('editor', 'tabSize', size);
  });

  document.getElementById('settingWordWrap')?.addEventListener('change', (e) => {
    monacoEditorInstance?.updateOptions({ wordWrap: e.target.value });
    ExtensionManager.setSetting('editor', 'wordWrap', e.target.value);
  });

  document.getElementById('settingMinimap')?.addEventListener('change', (e) => {
    monacoEditorInstance?.updateOptions({ minimap: { enabled: e.target.value === 'true' } });
    ExtensionManager.setSetting('editor', 'minimap', e.target.value);
  });

  document.getElementById('settingLineNumbers')?.addEventListener('change', (e) => {
    monacoEditorInstance?.updateOptions({ lineNumbers: e.target.value });
    ExtensionManager.setSetting('editor', 'lineNumbers', e.target.value);
  });

  // ── Quick File Picker ─────────────────────────────────────────────────────
  document.getElementById('quickPickerInput')?.addEventListener('input', (e) => {
    renderQuickPickerResults(e.target.value);
  });

  document.getElementById('quickPickerInput')?.addEventListener('keydown', (e) => {
    handleQuickPickerNavigation(e);
  });

  document.getElementById('quickPickerBackdrop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('quickPickerBackdrop')) closeQuickPicker();
  });

  // ── Markdown Preview Toggle ───────────────────────────────────────────────
  document.getElementById('mdPreviewToggleBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('mdPreviewToggleBtn');
    const isOpen = btn.getAttribute('data-open') === 'true';
    if (isOpen) {
      closeMdPreview();
      btn.setAttribute('data-open', 'false');
    } else {
      openMdPreview(monacoEditorInstance);
      btn.setAttribute('data-open', 'true');
    }
  });

  // ── Diff editor close ────────────────────────────────────────────────────
  document.getElementById('closeDiffBtn')?.addEventListener('click', closeDiffEditor);

  // ── Git sidebar panel ─────────────────────────────────────────────────────
  document.getElementById('refreshGitPanelBtn')?.addEventListener('click', () => loadGitSidebarPanel());
  document.getElementById('gitCommitInlineBtn')?.addEventListener('click', handleInlineGitCommit);

  // ── Global Search ─────────────────────────────────────────────────────────
  document.getElementById('globalSearchInput')?.addEventListener('input', debounce((e) => {
    runGlobalSearch(e.target.value);
  }, 300));

  document.getElementById('runGlobalSearchBtn')?.addEventListener('click', () => {
    runGlobalSearch(document.getElementById('globalSearchInput')?.value || '');
  });

  // ── AI drawer ─────────────────────────────────────────────────────────────
  document.getElementById('aiDrawerClose')?.addEventListener('click', closeAiDrawer);
  document.getElementById('aiAutoFixBtn')?.addEventListener('click', triggerAiAutoFix);
}

// ─── Load workspace ────────────────────────────────────────────────────────
async function loadWorkspace() {
  try {
    const info = await WorkspaceService.getInfo(currentRepoId);
    currentRepoInfo = info;

    const repoNameDisplay = document.getElementById('repoNameDisplay');
    if (repoNameDisplay) repoNameDisplay.textContent = info.repository;

    const repoBreadcrumb = document.getElementById('repoBreadcrumb');
    if (repoBreadcrumb) repoBreadcrumb.href = `detail.html?repo=${encodeURIComponent(info.repository)}`;

    const backBtn = document.getElementById('backToRepoBtn');
    if (backBtn) backBtn.href = `detail.html?repo=${encodeURIComponent(info.repository)}`;

    const branchSelect = document.getElementById('workspaceBranchSelect');
    if (branchSelect) {
      branchSelect.innerHTML = '';
      (info.branches || ['main']).forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b + (b === info.defaultBranch ? ' (default)' : '');
        if (b === currentBranch) opt.selected = true;
        branchSelect.appendChild(opt);
      });
    }

    if (info.permissions?.isReadOnly) {
      document.getElementById('saveBtn')?.setAttribute('disabled', 'true');
      document.getElementById('newFileBtn')?.style.setProperty('display', 'none');
      document.getElementById('newFolderBtn')?.style.setProperty('display', 'none');
      const ind = document.getElementById('saveStatusIndicator');
      if (ind) ind.innerHTML = '<span class="badge badge-secondary" style="font-size:10px;">Read-Only Mode</span>';
    }

    updateDownloadZipUrl();
    updateGitBranchLabels();
    await initMonacoEditor();
    await loadFileTree();
  } catch (err) {
    console.error('Failed to load workspace:', err);
    const tree = document.getElementById('fileTreeContainer');
    if (tree) tree.innerHTML = `<div style="padding:16px; color:#dc2626; font-size:12px;">Failed to load repository workspace: ${escapeHtml(err.message || 'Error')}</div>`;
  }
}

// ─── Monaco initialization ────────────────────────────────────────────────
function initMonacoEditor() {
  return new Promise((resolve) => {
    if (typeof window.require !== 'undefined') {
      window.require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
      });

      window.require(['vs/editor/editor.main'], function (monaco) {
        window.monaco = monaco;

        // Register DevSync light theme
        monaco.editor.defineTheme('devsync-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
            { token: 'keyword', foreground: '0284c7', fontStyle: 'bold' },
            { token: 'string', foreground: '059669' },
            { token: 'number', foreground: 'd97706' }
          ],
          colors: {
            'editor.background': '#ffffff',
            'editor.lineHighlightBackground': '#f8fafc',
            'editorLineNumber.foreground': '#94a3b8',
            'editorLineNumber.activeForeground': '#0284c7',
            'editorIndentGuide.background1': '#e2e8f0',
            'editorIndentGuide.activeBackground1': '#cbd5e1'
          }
        });

        // Register all bundled themes
        registerAllThemes(monaco);

        // Restore saved editor preferences
        const savedFontSize  = ExtensionManager.getSetting('editor', 'fontSize', 13.5);
        const savedTabSize   = ExtensionManager.getSetting('editor', 'tabSize', 4);
        const savedWordWrap  = ExtensionManager.getSetting('editor', 'wordWrap', 'off');
        const savedMinimap   = ExtensionManager.getSetting('editor', 'minimap', 'true') !== 'false';
        const savedLineNums  = ExtensionManager.getSetting('editor', 'lineNumbers', 'on');
        const savedTheme     = ExtensionManager.getSetting('themes-pack', 'activeTheme', 'devsync-light');

        // Update settings UI controls to reflect saved values
        const fsInput = document.getElementById('settingFontSize');
        if (fsInput) { fsInput.value = savedFontSize; document.getElementById('settingFontSizeVal').textContent = Math.round(savedFontSize); }
        const tsInput = document.getElementById('settingTabSize');
        if (tsInput) tsInput.value = savedTabSize;
        const wwInput = document.getElementById('settingWordWrap');
        if (wwInput) wwInput.value = savedWordWrap;
        const mmInput = document.getElementById('settingMinimap');
        if (mmInput) mmInput.value = String(savedMinimap);
        const lnInput = document.getElementById('settingLineNumbers');
        if (lnInput) lnInput.value = savedLineNums;

        const rootEl = document.getElementById('monacoEditorRoot');
        if (rootEl) {
          monacoEditorInstance = monaco.editor.create(rootEl, {
            value: '# Welcome to DevSync Code Workspace\n# Select a file from the explorer to begin editing.\n',
            language: 'python',
            theme: savedTheme,
            fontSize: savedFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
            fontLigatures: true,
            lineNumbers: savedLineNums,
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: savedTabSize,
            wordWrap: savedWordWrap,
            minimap: { enabled: savedMinimap },
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            renderLineHighlight: 'gutter',
            padding: { top: 8, bottom: 8 }
          });

          // Expose editor globally for extensions that need it
          window.__devsyncEditor = monacoEditorInstance;

          // Dirty-state tracking
          monacoEditorInstance.onDidChangeModelContent(() => {
            if (activeTabPath) {
              const tab = openTabs.find(t => t.path === activeTabPath);
              if (tab && !tab.dirty) {
                tab.dirty = true;
                renderTabs();
                setSaveStatus(false);
              }
            }
          });

          // Built-in shortcuts
          monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveActiveFile);
          monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runActiveCode);

          // AI Context Menu actions
          monacoEditorInstance.addAction({
            id: 'devsync.ai.explain',
            label: '✨ Explain Code',
            contextMenuGroupId: 'devsync_ai',
            contextMenuOrder: 1,
            run: () => triggerAiAction('explain')
          });

          monacoEditorInstance.addAction({
            id: 'devsync.ai.tests',
            label: '🧪 Generate Unit Tests',
            contextMenuGroupId: 'devsync_ai',
            contextMenuOrder: 2,
            run: () => triggerAiAction('tests')
          });

          monacoEditorInstance.addAction({
            id: 'devsync.ai.optimize',
            label: '⚡ Optimize / Refactor',
            contextMenuGroupId: 'devsync_ai',
            contextMenuOrder: 3,
            run: () => triggerAiAction('optimize')
          });
        }

        // Build extension context and boot persisted extensions
        const extCtx = {
          monaco,
          editor: monacoEditorInstance,
          getActiveTab: () => openTabs.find(t => t.path === activeTabPath) || null,
          repoId: currentRepoId,
          getBranch: () => currentBranch
        };
        setExtensionContext(extCtx);

        // Boot all previously-enabled extensions
        ExtensionManager.bootPersistedExtensions(extCtx).then(() => {
          // Render theme picker in settings after themes are registered
          renderThemePicker(savedTheme);
          // Render extensions marketplace
          renderExtensionsList('all');
        });

        resolve();
      });
    } else {
      // Fallback textarea editor
      console.warn('Monaco AMD loader not available, falling back to textarea editor.');
      const fallback = document.getElementById('fallbackEditor');
      const monacoRoot = document.getElementById('monacoEditorRoot');
      if (fallback) fallback.style.display = 'block';
      if (monacoRoot) monacoRoot.style.display = 'none';
      fallback?.addEventListener('input', () => {
        if (activeTabPath) {
          const tab = openTabs.find(t => t.path === activeTabPath);
          if (tab && !tab.dirty) { tab.dirty = true; renderTabs(); setSaveStatus(false); }
        }
      });
      resolve();
    }
  });
}

// ─── File tree ────────────────────────────────────────────────────────────
async function loadFileTree() {
  const container = document.getElementById('fileTreeContainer');
  if (!container) return;

  try {
    const data = await WorkspaceService.getTree(currentRepoId, currentBranch);
    container.innerHTML = '';
    flatFileList = data.files || [];

    if (!data.tree || data.tree.length === 0) {
      container.innerHTML = `
        <div style="padding:16px; color:#64748b; font-size:12px; text-align:center;">
          No files on branch <strong>${escapeHtml(currentBranch)}</strong>.<br>
          Click <a href="#" id="createFirstFileLink">Create File</a> to start.
        </div>`;
      document.getElementById('createFirstFileLink')?.addEventListener('click', (e) => {
        e.preventDefault(); showModal('newFileModal');
      });
      return;
    }

    renderTreeNodes(data.tree, container, 0);

    if (openTabs.length === 0 && data.files && data.files.length > 0) {
      const readme = data.files.find(f => f.name.toLowerCase() === 'readme.md');
      const firstFile = readme || data.files[0];
      await openFile(firstFile.path);
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:16px; color:#dc2626; font-size:12px;">Failed to load files: ${escapeHtml(err.message)}</div>`;
  }
}

function renderTreeNodes(nodes, parentEl, depth) {
  nodes.forEach(node => {
    if (node.type === 'directory') {
      const dirEl = document.createElement('div');
      dirEl.className = 'tree-dir-item';

      const row = document.createElement('div');
      row.className = 'tree-node';
      row.style.paddingLeft = `${12 + depth * 14}px`;
      row.innerHTML = `
        <span class="tree-node-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="tree-node-label">${escapeHtml(node.name)}</span>
        <div class="tree-node-actions">
          <button class="tree-action-btn btn-node-rename" title="Rename Folder" data-path="${escapeHtml(node.path)}">&#9998;</button>
          <button class="tree-action-btn btn-node-delete" title="Delete Folder" data-path="${escapeHtml(node.path)}">&times;</button>
        </div>
      `;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-dir-children';

      row.addEventListener('click', (e) => {
        if (e.target.closest('.tree-action-btn')) return;
        childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
      });

      attachNodeActionListeners(row, node.path, true);
      dirEl.appendChild(row);
      dirEl.appendChild(childrenContainer);
      parentEl.appendChild(dirEl);

      if (node.children?.length > 0) renderTreeNodes(node.children, childrenContainer, depth + 1);
    } else {
      const row = document.createElement('div');
      row.className = 'tree-node';
      if (activeTabPath === node.path) row.classList.add('active');
      row.style.paddingLeft = `${12 + depth * 14}px`;

      const iconColor = getFileIconColor(node.extension || '');
      row.innerHTML = `
        <span class="tree-node-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </span>
        <span class="tree-node-label" title="${escapeHtml(node.path)}">${escapeHtml(node.name)}</span>
        <div class="tree-node-actions">
          <button class="tree-action-btn btn-node-rename" title="Rename File" data-path="${escapeHtml(node.path)}">&#9998;</button>
          <button class="tree-action-btn btn-node-delete" title="Delete File" data-path="${escapeHtml(node.path)}">&times;</button>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.tree-action-btn')) return;
        openFile(node.path);
      });

      attachNodeActionListeners(row, node.path, false);
      parentEl.appendChild(row);
    }
  });
}

function attachNodeActionListeners(row, path, isDir) {
  row.querySelector('.btn-node-rename')?.addEventListener('click', (e) => {
    e.stopPropagation(); openRenameModal(path);
  });
  row.querySelector('.btn-node-delete')?.addEventListener('click', (e) => {
    e.stopPropagation(); openDeleteModal(path, isDir);
  });
}

// ─── File open / tab management ──────────────────────────────────────────────
export async function openFile(filePath) {
  let tab = openTabs.find(t => t.path === filePath);

  if (!tab) {
    try {
      const fileData = await WorkspaceService.getFile(currentRepoId, currentBranch, filePath);
      const ext = (fileData.extension || '').toLowerCase();
      const monacoLang = fileData.language || EXT_TO_MONACO_LANG[ext] || 'plaintext';
      tab = {
        path: fileData.path,
        name: fileData.name,
        language: monacoLang,
        content: fileData.content || '',
        dirty: false
      };
      openTabs.push(tab);
      renderTabs();
    } catch (err) {
      alert(`Could not open file ${filePath}: ${err.message}`);
      return;
    }
  }

  activateTab(tab.path);
}

function activateTab(filePath) {
  activeTabPath = filePath;
  const tab = openTabs.find(t => t.path === filePath);
  if (!tab) return;

  // Sync language selector
  const langSelect = document.getElementById('workspaceLangSelect');
  if (langSelect) {
    const hasOpt = Array.from(langSelect.options).some(o => o.value === tab.language);
    if (hasOpt) {
      langSelect.value = tab.language;
    } else {
      const ext = (tab.path || '').split('.').pop().toLowerCase();
      if (['py'].includes(ext)) langSelect.value = 'python';
      else if (['js', 'jsx', 'mjs'].includes(ext)) langSelect.value = 'javascript';
      else if (['ts', 'tsx'].includes(ext)) langSelect.value = 'javascript';
      else if (['c', 'h'].includes(ext)) langSelect.value = 'c';
      else if (['cpp', 'cc', 'cxx'].includes(ext)) langSelect.value = 'cpp';
      else if (['java'].includes(ext)) langSelect.value = 'java';
      else langSelect.value = 'python';
    }
  }

  // Update Monaco model
  if (monacoEditorInstance && window.monaco) {
    let model = monacoModels.get(filePath);
    if (!model) {
      const uri = window.monaco.Uri.parse(`file:///${filePath}`);
      model = window.monaco.editor.getModel(uri)
        || window.monaco.editor.createModel(tab.content, tab.language, uri);
      monacoModels.set(filePath, model);
    }
    monacoEditorInstance.setModel(model);

    // Close diff editor if open
    closeDiffEditor();

    // Show/hide markdown preview button
    const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown');
    const mdBtn = document.getElementById('mdPreviewToggleBtn');
    if (mdBtn) mdBtn.style.display = isMarkdown ? 'flex' : 'none';

    // Update TODO tree if active
    if (ExtensionManager.isEnabled('todo-highlighter')) {
      updateTodoDecorations(monacoEditorInstance, window.monaco);
    }
  } else {
    const fallback = document.getElementById('fallbackEditor');
    if (fallback) fallback.value = tab.content;
  }

  // Highlight active tree node
  document.querySelectorAll('.tree-node').forEach(node => {
    const label = node.querySelector('.tree-node-label')?.getAttribute('title');
    node.classList.toggle('active', label === filePath);
  });

  renderTabs();
  setSaveStatus(!tab.dirty);
}

function renderTabs() {
  const bar = document.getElementById('editorTabsBar');
  if (!bar) return;

  // Preserve the md preview button (always last child)
  const mdBtn = document.getElementById('mdPreviewToggleBtn');

  // Remove all tab elements
  bar.querySelectorAll('.workspace-tab').forEach(el => el.remove());

  openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'workspace-tab' + (tab.path === activeTabPath ? ' active' : '') + (tab.dirty ? ' dirty' : '');
    tabEl.setAttribute('role', 'tab');
    tabEl.innerHTML = `
      <span>${escapeHtml(tab.name)}</span>
      <span class="tab-dirty-indicator"></span>
      <button type="button" class="tab-close-btn" title="Close Tab">&times;</button>
    `;

    tabEl.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close-btn')) return;
      activateTab(tab.path);
    });
    tabEl.querySelector('.tab-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation(); closeTab(tab.path);
    });

    // Insert before mdBtn
    if (mdBtn) {
      bar.insertBefore(tabEl, mdBtn);
    } else {
      bar.appendChild(tabEl);
    }
  });
}

function closeTab(filePath) {
  const idx = openTabs.findIndex(t => t.path === filePath);
  if (idx === -1) return;

  const tab = openTabs[idx];
  if (tab.dirty && !confirm(`File "${tab.name}" has unsaved changes. Close anyway?`)) return;

  openTabs.splice(idx, 1);

  // Dispose Monaco model to free memory
  const model = monacoModels.get(filePath);
  if (model) { model.dispose(); monacoModels.delete(filePath); }

  if (activeTabPath === filePath) {
    if (openTabs.length > 0) {
      activateTab(openTabs[Math.max(0, idx - 1)].path);
    } else {
      activeTabPath = null;
      if (monacoEditorInstance) {
        monacoEditorInstance.setValue('# No files open\n# Select a file from the explorer or create a new one.\n');
      }
    }
  }

  renderTabs();
}

// ─── Save ─────────────────────────────────────────────────────────────────
export async function saveActiveFile() {
  if (!activeTabPath) return;
  const tab = openTabs.find(t => t.path === activeTabPath);
  if (!tab) return;

  const content = getEditorContent();
  const ind = document.getElementById('saveStatusIndicator');
  if (ind) ind.innerHTML = '<span style="color:#d97706;">Saving...</span>';

  // If Prettier is enabled, format before save (for supported languages)
  if (ExtensionManager.isEnabled('prettier') && monacoEditorInstance && window.monaco) {
    await formatDocumentWithPrettier(monacoEditorInstance, window.monaco);
  }

  try {
    await WorkspaceService.saveFile(currentRepoId, {
      branch: currentBranch,
      path: tab.path,
      content: getEditorContent(), // re-read after possible formatting
      commitMessage: `Update ${tab.path}`
    });
    tab.content = getEditorContent();
    tab.dirty = false;
    renderTabs();
    setSaveStatus(true);
  } catch (err) {
    alert(`Failed to save ${tab.path}: ${err.message}`);
    setSaveStatus(false);
  }
}

// ─── Run code ─────────────────────────────────────────────────────────────
export async function runActiveCode(stdinValue = '') {
  const content = getEditorContent();
  if (!content.trim()) { alert('Please enter or open code to execute.'); return; }

  const nonRunnableExts = ['.md', '.markdown', '.json', '.html', '.css', '.txt', '.xml', '.yaml', '.yml'];
  const ext = activeTabPath ? '.' + activeTabPath.split('.').pop().toLowerCase() : '';
  if (nonRunnableExts.includes(ext)) {
    switchBottomPanelView('output');
    const stdout = document.getElementById('stdoutText');
    if (stdout) stdout.textContent = `[Notice] "${activeTabPath}" is a ${ext.replace('.', '').toUpperCase()} document and cannot be directly executed.\n\nSelect a script file (e.g. .py, .js) from the Explorer to run code.`;
    return;
  }

  const langSelect = document.getElementById('workspaceLangSelect');
  const language = langSelect?.value || 'python';
  const filePath = activeTabPath || `main.${language === 'python' ? 'py' : 'js'}`;

  const runBtn = document.getElementById('runBtn');
  if (runBtn) { runBtn.setAttribute('disabled', 'true'); runBtn.innerHTML = '<span>Running...</span>'; }

  switchBottomPanelView('output');
  const stdout = document.getElementById('stdoutText');
  const stderr = document.getElementById('stderrText');
  if (stdout) stdout.textContent = 'Running program in secure sandbox...\n';
  if (stderr) stderr.textContent = '';
  document.getElementById('aiFixBtnContainer').style.display = 'none';

  try {
    const res = await WorkspaceService.executeCode(currentRepoId, {
      branch: currentBranch,
      filePath,
      sourceCode: content,
      language,
      stdin: stdinValue || document.getElementById('stdinInput')?.value || ''
    });

    const metaBar = document.getElementById('consoleMetaBar');
    if (metaBar) metaBar.style.display = 'flex';

    const metaStatus = document.getElementById('metaStatus');
    if (metaStatus) {
      metaStatus.textContent = res.status || (res.exit_code === 0 ? 'Success' : 'Failed');
      metaStatus.style.color = res.exit_code === 0 ? '#10b981' : '#dc2626';
    }

    document.getElementById('metaWallTime').textContent = `${res.wall_time_ms || res.execution_time_ms || 0} ms`;
    document.getElementById('metaMemory').textContent = `${res.memory_kb || res.memory_usage_kb || 0} KB`;
    document.getElementById('metaExitCode').textContent = `Exit ${res.exit_code}`;

    const errText = [res.compile_output, res.stderr].filter(Boolean).join('\n');

    if (stdout) {
      stdout.textContent = res.exit_code !== 0
        ? (res.stdout ? res.stdout + '\n' : '') + (errText ? `[Execution Error — Exit Code ${res.exit_code}]\n${errText}` : `[Program terminated with exit code ${res.exit_code}]`)
        : (res.stdout || '(Program exited cleanly with no output)');
    }
    if (stderr) stderr.textContent = errText || 'No errors reported.';

    const badge = document.getElementById('errorCountBadge');
    if (badge) {
      badge.textContent = errText ? (res.exit_code !== 0 ? 'Error' : '!') : '';
      badge.style.display = errText ? 'inline-block' : 'none';
    }

    // Show AI auto-fix button on errors
    const aiFixContainer = document.getElementById('aiFixBtnContainer');
    if (aiFixContainer) {
      aiFixContainer.style.display = (res.exit_code !== 0 || errText) ? 'block' : 'none';
    }

    // Update execution history in tab
    if (res.exit_code !== 0) switchBottomPanelView('output');

  } catch (err) {
    if (stdout) stdout.textContent = `Execution failed: ${err.message}`;
    if (stderr) stderr.textContent = err.message;
    document.getElementById('aiFixBtnContainer').style.display = 'block';
  } finally {
    if (runBtn) {
      runBtn.removeAttribute('disabled');
      runBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Run</span>`;
    }
  }
}

// ─── Activity Bar switching ───────────────────────────────────────────────
function switchActivityPanel(panelId, clickedBtn) {
  const sidebar = document.getElementById('workspaceSidebar');

  // If clicking the already-active panel → toggle sidebar visibility
  const currentlyActive = document.querySelector('.activity-btn.active');
  const isCurrentlyActive = currentlyActive === clickedBtn;

  document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.workspace-sidebar-panel').forEach(p => p.classList.remove('panel-active'));

  if (isCurrentlyActive) {
    // Toggle sidebar collapse
    sidebar?.classList.toggle('collapsed');
    if (monacoEditorInstance) monacoEditorInstance.layout();
    return;
  }

  // Show panel
  sidebar?.classList.remove('collapsed');
  clickedBtn.classList.add('active');
  const panelEl = document.getElementById(`panel${panelId.charAt(0).toUpperCase() + panelId.slice(1)}`);
  panelEl?.classList.add('panel-active');

  if (monacoEditorInstance) monacoEditorInstance.layout();

  // Lazy-load panel content
  if (panelId === 'git') loadGitSidebarPanel();
  if (panelId === 'extensions') renderExtensionsList('all');
  if (panelId === 'settings') renderThemePicker(ExtensionManager.getSetting('themes-pack', 'activeTheme', 'devsync-light'));
}

// ─── Extensions Marketplace rendering ────────────────────────────────────
function renderExtensionsList(tabFilter = 'all', searchQuery = '') {
  const container = document.getElementById('extListContainer');
  if (!container) return;

  let extensions = ExtensionManager.getInstalledExtensions();

  // Filter by tab
  if (tabFilter === 'installed') {
    extensions = extensions.filter(e => e.enabled);
  } else if (tabFilter !== 'all') {
    extensions = extensions.filter(e => e.manifest.category === tabFilter);
  }

  // Filter by search
  if (searchQuery) {
    extensions = extensions.filter(e =>
      e.manifest.name.toLowerCase().includes(searchQuery) ||
      e.manifest.description.toLowerCase().includes(searchQuery) ||
      (e.manifest.tags || []).some(t => t.includes(searchQuery))
    );
  }

  if (extensions.length === 0) {
    container.innerHTML = '<p style="font-size:12px; color:#94a3b8; text-align:center; padding:24px;">No extensions found.</p>';
    return;
  }

  container.innerHTML = extensions.map(ext => {
    const m = ext.manifest;
    return `
      <div class="ext-card">
        <div class="ext-card-icon">${m.icon || '📦'}</div>
        <div class="ext-card-body">
          <div class="ext-card-title">
            ${escapeHtml(m.name)}
            ${m.bundled ? '<span class="ext-badge ext-badge-bundled">Built-in</span>' : ''}
          </div>
          <div class="ext-card-desc">${escapeHtml(m.description)}</div>
          <div class="ext-card-meta">
            <span class="ext-badge ext-badge-${m.category}">${escapeHtml(m.category)}</span>
            ${m.version ? `<span style="font-size:10px; color:#94a3b8;">v${escapeHtml(m.version)}</span>` : ''}
          </div>
        </div>
        <div class="ext-toggle">
          <label class="toggle-switch" title="${ext.enabled ? 'Disable' : 'Enable'} ${m.name}">
            <input type="checkbox" data-ext-id="${escapeHtml(m.id)}" ${ext.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Attach toggle listeners
  container.querySelectorAll('input[data-ext-id]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-ext-id');
      const ctx = {
        monaco: window.monaco,
        editor: monacoEditorInstance,
        getActiveTab: () => openTabs.find(t => t.path === activeTabPath) || null
      };
      if (e.target.checked) {
        await ExtensionManager.enableExtension(id, ctx);
      } else {
        await ExtensionManager.disableExtension(id, ctx);
      }
      // Re-render to reflect state
      const activeTab = document.querySelector('[data-ext-tab].active')?.getAttribute('data-ext-tab') || 'all';
      renderExtensionsList(activeTab, document.getElementById('extSearchInput')?.value || '');
    });
  });
}

// ─── Theme picker in settings panel ─────────────────────────────────────
function renderThemePicker(activeThemeId) {
  const grid = document.getElementById('themePickerGrid');
  if (!grid) return;

  const themes = getThemeList();
  grid.innerHTML = themes.map(({ id, label }) => `
    <div class="theme-card ${id === activeThemeId ? 'active' : ''}" data-theme-id="${escapeHtml(id)}">
      ${escapeHtml(label)}
    </div>
  `).join('');

  grid.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.getAttribute('data-theme-id');
      if (window.monaco) window.monaco.editor.setTheme(themeId);
      ExtensionManager.setSetting('themes-pack', 'activeTheme', themeId);
      grid.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
}

// ─── Visual Git sidebar panel ─────────────────────────────────────────────
async function loadGitSidebarPanel() {
  const changesEl = document.getElementById('gitSidebarChanges');
  const commitsEl = document.getElementById('gitSidebarCommits');
  if (!changesEl) return;

  try {
    const res = await WorkspaceService.getGitStatus(currentRepoId, currentBranch);

    // Recent commits
    if (commitsEl) {
      if (!res.recentCommits || res.recentCommits.length === 0) {
        commitsEl.innerHTML = '<span style="color:#94a3b8;">No commits yet.</span>';
      } else {
        commitsEl.innerHTML = res.recentCommits.slice(0, 5).map(c => `
          <div style="padding:4px 0; border-bottom:1px solid #f1f5f9; display:flex; gap:8px; align-items:flex-start;">
            <code style="font-size:10px; background:#f1f5f9; padding:1px 4px; border-radius:3px; flex-shrink:0;">${escapeHtml(c.short_sha || c.id || '').substring(0, 7)}</code>
            <span style="font-size:11px; color:#334155; line-height:1.4;">${escapeHtml(c.summary || c.message || 'Commit')}</span>
          </div>
        `).join('');
      }
    }

    // Changed files with staging checkboxes
    const files = res.changedFiles || res.modifiedFiles || [];
    updateGitChangeBadge(files.length);

    if (files.length === 0) {
      changesEl.innerHTML = '<span style="font-size:12px; color:#94a3b8;">No changes detected.</span>';
      return;
    }

    changesEl.innerHTML = files.map(f => {
      const filePath = f.path || f.name || f;
      const fileName = typeof filePath === 'string' ? filePath.split('/').pop() : filePath;
      const status = f.status || 'M';
      const isStaged = stagedFiles.get(filePath) === true;
      return `
        <div class="git-change-item" data-path="${escapeHtml(filePath)}">
          <input type="checkbox" class="git-stage-checkbox" data-path="${escapeHtml(filePath)}" ${isStaged ? 'checked' : ''} title="Stage/Unstage">
          <span class="git-change-status git-status-${status}">${status}</span>
          <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px;" title="${escapeHtml(filePath)}">${escapeHtml(fileName)}</span>
          <button class="git-diff-btn" data-path="${escapeHtml(filePath)}" title="View diff">Diff</button>
        </div>
      `;
    }).join('');

    // Staging checkbox listeners
    changesEl.querySelectorAll('.git-stage-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const path = e.target.getAttribute('data-path');
        stagedFiles.set(path, e.target.checked);
      });
    });

    // Diff viewer listeners
    changesEl.querySelectorAll('.git-diff-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = btn.getAttribute('data-path');
        await openDiffEditor(path);
      });
    });

  } catch (err) {
    changesEl.innerHTML = `<span style="color:#dc2626; font-size:12px;">Failed: ${escapeHtml(err.message)}</span>`;
  }
}

function updateGitChangeBadge(count) {
  const badge = document.getElementById('gitChangeBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

async function handleInlineGitCommit() {
  const msgEl = document.getElementById('gitCommitMsgInline');
  const msg = msgEl?.value?.trim();
  if (!msg) { alert('Please enter a commit message.'); return; }

  const staged = Array.from(stagedFiles.entries())
    .filter(([, isStaged]) => isStaged)
    .map(([path]) => path);

  try {
    await WorkspaceService.commitChanges(currentRepoId, {
      branch: currentBranch,
      message: msg,
      files: staged.length > 0 ? staged : []
    });
    if (msgEl) msgEl.value = '';
    stagedFiles.clear();
    loadGitSidebarPanel();
  } catch (err) {
    alert(`Commit failed: ${err.message}`);
  }
}

// ─── Diff editor ───────────────────────────────────────────────────────────
async function openDiffEditor(filePath) {
  if (!window.monaco || !monacoEditorInstance) return;

  const overlay = document.getElementById('diffEditorOverlay');
  const diffRoot = document.getElementById('diffEditorRoot');
  const diffFileName = document.getElementById('diffFileName');

  if (!overlay || !diffRoot) return;

  try {
    // Fetch original (HEAD) content
    let originalContent = '';
    try {
      const fileData = await WorkspaceService.getFile(currentRepoId, currentBranch, filePath);
      originalContent = fileData.content || '';
    } catch { /* new file — show empty original */ }

    // Get current (modified) content from open tab or editor
    const tab = openTabs.find(t => t.path === filePath);
    const modifiedContent = tab
      ? (activeTabPath === filePath ? getEditorContent() : tab.content)
      : originalContent;

    if (diffFileName) diffFileName.textContent = filePath.split('/').pop();

    // Dispose previous diff editor
    if (monacoDiffEditor) { monacoDiffEditor.dispose(); monacoDiffEditor = null; }
    diffRoot.innerHTML = '';

    const originalModel = window.monaco.editor.createModel(originalContent, detectLang(filePath));
    const modifiedModel = window.monaco.editor.createModel(modifiedContent, detectLang(filePath));

    const savedTheme = ExtensionManager.getSetting('themes-pack', 'activeTheme', 'devsync-light');
    monacoDiffEditor = window.monaco.editor.createDiffEditor(diffRoot, {
      theme: savedTheme,
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      wordWrap: 'off',
      originalEditable: false,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    });

    monacoDiffEditor.setModel({ original: originalModel, modified: modifiedModel });

    overlay.classList.add('visible');
  } catch (err) {
    console.error('Diff editor error:', err);
    alert(`Could not open diff: ${err.message}`);
  }
}

function closeDiffEditor() {
  const overlay = document.getElementById('diffEditorOverlay');
  overlay?.classList.remove('visible');
  if (monacoDiffEditor) {
    monacoDiffEditor.dispose();
    monacoDiffEditor = null;
    document.getElementById('diffEditorRoot').innerHTML = '';
  }
}

function detectLang(filePath) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  return EXT_TO_MONACO_LANG[ext] || 'plaintext';
}

// ─── Quick File Picker (Ctrl+P) ───────────────────────────────────────────
function openQuickPicker() {
  const backdrop = document.getElementById('quickPickerBackdrop');
  const input = document.getElementById('quickPickerInput');
  if (!backdrop) return;
  backdrop.classList.add('visible');
  input?.focus();
  renderQuickPickerResults('');
}

function closeQuickPicker() {
  const backdrop = document.getElementById('quickPickerBackdrop');
  backdrop?.classList.remove('visible');
  const input = document.getElementById('quickPickerInput');
  if (input) input.value = '';
}

function renderQuickPickerResults(query) {
  const container = document.getElementById('quickPickerResults');
  if (!container) return;

  const q = query.toLowerCase().trim();
  let files = flatFileList.filter(f => f.type === 'file' || !f.type);

  if (q) {
    // Fuzzy match: score by how early and how many characters match
    files = files
      .map(f => ({ ...f, score: fuzzyScore(f.path.toLowerCase(), q) }))
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  if (files.length === 0) {
    container.innerHTML = '<div class="quick-picker-empty">No files match your query.</div>';
    return;
  }

  container.innerHTML = files.slice(0, 30).map((f, idx) => {
    const name = f.name || f.path.split('/').pop();
    const dir  = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
    const iconColor = getFileIconColor('.' + name.split('.').pop().toLowerCase());
    return `
      <div class="quick-picker-item ${idx === 0 ? 'focused' : ''}" data-path="${escapeHtml(f.path)}" tabindex="0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${escapeHtml(name)}</span>
        ${dir ? `<span class="qp-path">${escapeHtml(dir)}</span>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.quick-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.getAttribute('data-path');
      closeQuickPicker();
      openFile(path);
    });
    item.addEventListener('mouseover', () => {
      container.querySelectorAll('.quick-picker-item').forEach(i => i.classList.remove('focused'));
      item.classList.add('focused');
    });
  });
}

function handleQuickPickerNavigation(e) {
  const container = document.getElementById('quickPickerResults');
  if (!container) return;
  const items = [...container.querySelectorAll('.quick-picker-item')];
  const focused = container.querySelector('.quick-picker-item.focused');
  const idx = items.indexOf(focused);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = items[Math.min(idx + 1, items.length - 1)];
    if (next) { items.forEach(i => i.classList.remove('focused')); next.classList.add('focused'); next.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = items[Math.max(idx - 1, 0)];
    if (prev) { items.forEach(i => i.classList.remove('focused')); prev.classList.add('focused'); prev.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const path = focused?.getAttribute('data-path');
    if (path) { closeQuickPicker(); openFile(path); }
  } else if (e.key === 'Escape') {
    closeQuickPicker();
  }
}

function fuzzyScore(str, query) {
  let score = 0, si = 0;
  for (let qi = 0; qi < query.length; qi++) {
    const found = str.indexOf(query[qi], si);
    if (found === -1) return 0;
    score += 1 / (found - si + 1);
    si = found + 1;
  }
  return score;
}

// ─── Global Search ────────────────────────────────────────────────────────
async function runGlobalSearch(query) {
  const container = document.getElementById('globalSearchResults');
  if (!container) return;

  const q = query.trim();
  if (!q || q.length < 2) {
    container.innerHTML = '<p style="font-size:12px; color:#94a3b8; text-align:center; padding:16px 0; margin:0;">Type at least 2 characters to search.</p>';
    return;
  }

  container.innerHTML = '<p style="font-size:12px; color:#94a3b8; margin:0; padding:8px 0;">Searching...</p>';

  const caseSensitive = document.getElementById('globalSearchCaseSensitive')?.checked;
  const files = flatFileList.filter(f => f.type === 'file' || !f.type);
  const results = [];

  for (const file of files) {
    try {
      // Check in-memory tab first
      const tab = openTabs.find(t => t.path === file.path);
      let content = tab?.content;

      if (!content) {
        const fileData = await WorkspaceService.getFile(currentRepoId, currentBranch, file.path);
        content = fileData.content || '';
      }

      const lines = content.split('\n');
      const matches = [];
      lines.forEach((line, idx) => {
        const haystack = caseSensitive ? line : line.toLowerCase();
        const needle   = caseSensitive ? q : q.toLowerCase();
        if (haystack.includes(needle)) {
          matches.push({ line: idx + 1, text: line.trim() });
        }
      });

      if (matches.length > 0) results.push({ path: file.path, name: file.name || file.path.split('/').pop(), matches });
      if (results.reduce((s, r) => s + r.matches.length, 0) > 200) break; // limit results
    } catch { /* skip unreadable files */ }
  }

  if (results.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:#94a3b8; text-align:center; padding:16px 0; margin:0;">No results for "<strong>${escapeHtml(q)}</strong>"</p>`;
    return;
  }

  const highlightMatch = (text) => {
    const idx = caseSensitive ? text.indexOf(q) : text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx)) + `<mark>${escapeHtml(text.slice(idx, idx + q.length))}</mark>` + escapeHtml(text.slice(idx + q.length));
  };

  container.innerHTML = results.map(r => `
    <div class="search-result-file">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${getFileIconColor('.' + r.name.split('.').pop())}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${escapeHtml(r.name)}
      <span style="font-size:10px; color:#94a3b8; font-weight:400;">(${r.matches.length})</span>
    </div>
    ${r.matches.map(m => `
      <div class="search-result-match" data-path="${escapeHtml(r.path)}" data-line="${m.line}">
        <span style="color:#94a3b8; margin-right:6px;">${m.line}</span>${highlightMatch(m.text)}
      </div>
    `).join('')}
  `).join('');

  container.querySelectorAll('.search-result-match').forEach(el => {
    el.addEventListener('click', async () => {
      const path = el.getAttribute('data-path');
      const line = parseInt(el.getAttribute('data-line'), 10);
      await openFile(path);
      if (monacoEditorInstance && line) {
        monacoEditorInstance.revealLineInCenter(line);
        monacoEditorInstance.setPosition({ lineNumber: line, column: 1 });
        monacoEditorInstance.focus();
      }
    });
  });
}

// ─── AI Coding Assistant ─────────────────────────────────────────────────
async function triggerAiAction(action) {
  const editor = monacoEditorInstance;
  if (!editor) return;

  const selection = editor.getSelection();
  const model = editor.getModel();
  if (!model) return;

  const selectedCode = selection && !selection.isEmpty()
    ? model.getValueInRange(selection)
    : model.getValue();

  const tab = openTabs.find(t => t.path === activeTabPath);
  const language = tab?.language || 'python';

  openAiDrawer(action, selectedCode, language);
}

async function triggerAiAutoFix() {
  const errorText = document.getElementById('stderrText')?.textContent || '';
  const stdout = document.getElementById('stdoutText')?.textContent || '';
  const errorContent = errorText.trim() || stdout.trim();
  const code = getEditorContent();
  const tab = openTabs.find(t => t.path === activeTabPath);
  const language = tab?.language || 'python';

  openAiDrawer('fix', code, language, errorContent);
}

function openAiDrawer(action, code, language, errorContext = '') {
  const drawer = document.getElementById('aiResponseDrawer');
  const titleEl = document.getElementById('aiDrawerTitle');
  const loadingEl = document.getElementById('aiLoadingState');
  const contentEl = document.getElementById('aiResponseContent');
  const emptyEl = document.getElementById('aiDrawerEmpty');

  if (!drawer) return;

  const actionLabels = {
    explain: '✨ Explain Code',
    tests: '🧪 Generate Unit Tests',
    optimize: '⚡ Optimize / Refactor',
    fix: '🔧 Auto-Fix Error'
  };

  if (titleEl) titleEl.textContent = actionLabels[action] || 'AI Assistant';
  drawer.classList.add('open');

  // Show loading
  if (loadingEl) loadingEl.style.display = 'flex';
  if (contentEl) { contentEl.style.display = 'none'; contentEl.innerHTML = ''; }
  if (emptyEl) emptyEl.style.display = 'none';

  // Build AI prompt
  const promptMap = {
    explain: `Explain the following ${language} code clearly and concisely. Focus on what it does, its logic, and any notable patterns:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    tests: `Generate comprehensive unit tests for the following ${language} code. Return only the test code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    optimize: `Optimize and refactor the following ${language} code for better performance and readability. Return the improved code with a brief explanation:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    fix: `Fix the following ${language} code that produced this error:\n\nError:\n${errorContext}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn the corrected code and briefly explain the fix.`
  };

  callAiEndpoint(promptMap[action] || promptMap.explain, action, code, language, errorContext);
}

async function callAiEndpoint(prompt, action, originalCode, language, errorContext) {
  const loadingEl = document.getElementById('aiLoadingState');
  const contentEl = document.getElementById('aiResponseContent');

  try {
    // Use the existing DevSync AI assistant endpoint
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message: prompt,
        context: {
          page: 'workspace',
          language,
          action,
          code: originalCode.slice(0, 4000)
        }
      })
    });

    let data;
    if (response.ok) {
      data = await response.json();
    } else {
      throw new Error(`AI service returned ${response.status}`);
    }

    const reply = data.response || data.message || data.answer || 'No response from AI.';
    renderAiResponse(reply, action, language);

  } catch (err) {
    // Graceful degradation — show the error with a helpful message
    renderAiResponse(`Could not reach the AI service: ${err.message}\n\nEnsure the DevSync AI Mentor is running and you are authenticated.`, action, language, true);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

function renderAiResponse(text, action, language, isError = false) {
  const contentEl = document.getElementById('aiResponseContent');
  if (!contentEl) return;

  // Parse response: extract code blocks
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let lastIndex = 0;
  let explanationParts = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      explanationParts.push({ type: 'text', content: text.slice(lastIndex, match.index).trim() });
    }
    codeBlocks.push(match[1]);
    explanationParts.push({ type: 'code', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    explanationParts.push({ type: 'text', content: text.slice(lastIndex).trim() });
  }

  if (explanationParts.length === 0) {
    explanationParts = [{ type: 'text', content: text }];
  }

  const mainCode = codeBlocks[0] || '';

  contentEl.innerHTML = explanationParts.map(part => {
    if (part.type === 'code') {
      return `
        <div class="ai-response-section">
          <div class="ai-response-label">Code</div>
          <pre class="ai-response-code">${escapeHtml(part.content)}</pre>
        </div>
      `;
    } else if (part.content) {
      return `
        <div class="ai-response-section">
          <div class="ai-response-label">${action === 'explain' ? 'Explanation' : action === 'fix' ? 'Fix Details' : 'Analysis'}</div>
          <div class="ai-response-text">${escapeHtml(part.content)}</div>
        </div>
      `;
    }
    return '';
  }).join('');

  // Apply to editor button (for tests / optimize / fix actions)
  if (mainCode && ['tests', 'optimize', 'fix'].includes(action)) {
    contentEl.innerHTML += `
      <button class="ai-apply-btn" id="aiApplyCodeBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Apply to Editor
      </button>
    `;

    document.getElementById('aiApplyCodeBtn')?.addEventListener('click', () => {
      if (monacoEditorInstance && window.monaco) {
        const model = monacoEditorInstance.getModel();
        if (model) {
          const fullRange = model.getFullModelRange();
          monacoEditorInstance.executeEdits('ai-apply', [{ range: fullRange, text: mainCode }]);
          closeAiDrawer();
          monacoEditorInstance.focus();
        }
      }
    });
  }

  contentEl.style.display = 'flex';
}

function closeAiDrawer() {
  document.getElementById('aiResponseDrawer')?.classList.remove('open');
}

// ─── Bottom panel tab switching ─────────────────────────────────────────
function switchBottomPanelView(viewKey) {
  const views = ['Output', 'Errors', 'Stdin', 'History', 'Git', 'Todo'];
  views.forEach(v => {
    const el = document.getElementById(`view${v}`);
    if (el) el.style.display = v.toLowerCase() === viewKey.toLowerCase() ? 'block' : 'none';
  });

  document.querySelectorAll('.panel-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab')?.toLowerCase() === viewKey.toLowerCase());
  });

  if (viewKey === 'history') loadExecutionHistory();
  if (viewKey === 'git') loadGitStatus();
  if (viewKey === 'todo' && monacoEditorInstance && window.monaco) {
    import('../services/workspace-extensions.js').then(({ renderTodoTree }) => {
      renderTodoTree(monacoEditorInstance, window.monaco);
    });
  }
}

// ─── Execution history ──────────────────────────────────────────────────
async function loadExecutionHistory() {
  const container = document.getElementById('historyListContainer');
  if (!container) return;
  try {
    const res = await WorkspaceService.getHistory(currentRepoId, 20);
    if (!res.history || res.history.length === 0) {
      container.innerHTML = '<p style="font-size:12px; color:#64748b; margin:0;">No recent executions recorded.</p>';
      return;
    }
    let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
    res.history.forEach(item => {
      const isOk = item.exit_code === 0 && !item.is_error;
      const statusColor = isOk ? '#10b981' : '#dc2626';
      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:700; color:${statusColor};">${isOk ? 'PASS' : 'FAIL'}</span>
            <span><strong>${escapeHtml(item.language || '')}</strong></span>
            <span style="color:#64748b;">${escapeHtml(item.file_path || 'main')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; color:#64748b;">
            <span>${item.wall_time_ms || 0} ms</span>
            <span>${item.memory_kb || 0} KB</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626; font-size:12px;">Failed to load history: ${err.message}</p>`;
  }
}

// ─── Git status (bottom panel) ─────────────────────────────────────────
async function loadGitStatus() {
  const container = document.getElementById('gitStatusList');
  if (!container) return;
  try {
    const res = await WorkspaceService.getGitStatus(currentRepoId, currentBranch);
    let html = `<div><strong>Branch:</strong> ${escapeHtml(res.currentBranch)}</div>`;
    html += '<div style="margin-top:6px;"><strong>Recent Commits:</strong></div>';
    if (!res.recentCommits || res.recentCommits.length === 0) {
      html += '<div style="color:#64748b;">No recent commits recorded.</div>';
    } else {
      html += '<ul style="margin:4px 0; padding-left:18px;">';
      res.recentCommits.forEach(c => {
        html += `<li><code>${escapeHtml(c.short_sha || c.id || '')}</code> - ${escapeHtml(c.summary || c.message || 'Commit')} (${escapeHtml(c.actor || '')})</li>`;
      });
      html += '</ul>';
    }
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:#dc2626;">Failed to load Git status: ${err.message}</div>`;
  }
}

// ─── External IDE modal ────────────────────────────────────────────────
async function openIdeModal() {
  try {
    const config = await WorkspaceService.getIdeConfig(currentRepoId, currentBranch);
    const grid = document.getElementById('ideLinksGrid');
    if (grid) {
      grid.innerHTML = '';
      Object.entries(config.ideLinks || {}).forEach(([k, item]) => {
        const card = document.createElement('a');
        card.className = 'ide-card';
        card.href = item.protocol;
        card.innerHTML = `
          <div class="ide-card-icon">&lt;/&gt;</div>
          <div>
            <div style="font-weight:600; font-size:13px;">${escapeHtml(item.name)}</div>
            <div style="font-size:11px; color:#64748b;">${escapeHtml(item.instructions)}</div>
          </div>
        `;
        grid.appendChild(card);
      });
    }
    const httpsClone = document.getElementById('httpsCloneUrl');
    if (httpsClone) httpsClone.textContent = config.cloneUrls?.https || '';
    const cli = document.getElementById('cliInstructionsText');
    if (cli && config.cliSetup) {
      cli.textContent = [
        '# Clone repository', config.cliSetup.clone,
        '# Enter directory', config.cliSetup.cd,
        '# Setup environment', config.cliSetup.pythonSetup
      ].join('\n');
    }
    showModal('ideModal');
  } catch (err) {
    alert(`Failed to load IDE configuration: ${err.message}`);
  }
}

// ─── File CRUD handlers ─────────────────────────────────────────────────
async function handleCreateFile() {
  const input = document.getElementById('newFilePathInput');
  const pathVal = input?.value?.trim();
  if (!pathVal) { alert('Please enter a file path.'); return; }
  try {
    await WorkspaceService.createFile(currentRepoId, { branch: currentBranch, path: pathVal, type: 'file', content: '' });
    hideModal('newFileModal');
    if (input) input.value = '';
    await loadFileTree();
    await openFile(pathVal);
  } catch (err) { alert(`Failed to create file: ${err.message}`); }
}

async function handleCreateFolder() {
  const input = document.getElementById('newFolderPathInput');
  const pathVal = input?.value?.trim();
  if (!pathVal) { alert('Please enter a folder path.'); return; }
  try {
    await WorkspaceService.createFile(currentRepoId, { branch: currentBranch, path: pathVal, type: 'directory' });
    hideModal('newFolderModal');
    if (input) input.value = '';
    await loadFileTree();
  } catch (err) { alert(`Failed to create folder: ${err.message}`); }
}

function openRenameModal(path) {
  const hidden = document.getElementById('renameOldPath');
  const input  = document.getElementById('renameNewPathInput');
  if (hidden) hidden.value = path;
  if (input)  input.value  = path;
  showModal('renameModal');
}

async function handleRenameConfirm() {
  const oldPath = document.getElementById('renameOldPath')?.value;
  const newPath = document.getElementById('renameNewPathInput')?.value?.trim();
  if (!oldPath || !newPath) return;
  try {
    await WorkspaceService.renameFile(currentRepoId, { branch: currentBranch, oldPath, newPath });
    hideModal('renameModal');
    openTabs.forEach(t => {
      if (t.path === oldPath) { t.path = newPath; t.name = newPath.split('/').pop(); }
    });
    if (activeTabPath === oldPath) activeTabPath = newPath;
    renderTabs();
    await loadFileTree();
  } catch (err) { alert(`Failed to rename: ${err.message}`); }
}

function openDeleteModal(path, isDir) {
  const target  = document.getElementById('deleteTarget');
  const display = document.getElementById('deleteTargetDisplay');
  if (target)  target.value    = path;
  if (display) display.textContent = `${isDir ? 'folder' : 'file'} "${path}"`;
  showModal('deleteModal');
}

async function handleDeleteConfirm() {
  const path = document.getElementById('deleteTarget')?.value;
  if (!path) return;
  try {
    await WorkspaceService.deleteFile(currentRepoId, currentBranch, path);
    hideModal('deleteModal');
    closeTab(path);
    await loadFileTree();
  } catch (err) { alert(`Failed to delete: ${err.message}`); }
}

async function handleGitCommitConfirm() {
  const input = document.getElementById('commitMessageInput');
  const msg = input?.value?.trim();
  if (!msg) { alert('Please enter a commit message.'); return; }
  try {
    await WorkspaceService.commitChanges(currentRepoId, { branch: currentBranch, message: msg });
    hideModal('gitCommitModal');
    if (input) input.value = '';
    alert('Changes committed successfully!');
    loadGitStatus();
    loadGitSidebarPanel();
  } catch (err) { alert(`Failed to commit: ${err.message}`); }
}

// ─── Utility helpers ────────────────────────────────────────────────────
function getEditorContent() {
  if (monacoEditorInstance) return monacoEditorInstance.getValue();
  return document.getElementById('fallbackEditor')?.value || '';
}

function setSaveStatus(saved) {
  const ind = document.getElementById('saveStatusIndicator');
  if (!ind) return;
  if (saved) {
    ind.innerHTML = '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span><span>Saved</span>';
  } else {
    ind.innerHTML = '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#d97706;"></span><span>Unsaved</span>';
  }
}

function updateDownloadZipUrl() {
  const zipBtn = document.getElementById('downloadZipBtn');
  if (zipBtn) zipBtn.href = WorkspaceService.getArchiveUrl(currentRepoId, currentBranch);
}

function updateGitBranchLabels() {
  const label = document.getElementById('gitCommitBranchLabel');
  if (label) label.textContent = currentBranch;
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function initResizeHandle() {
  const handle = document.getElementById('bottomResizeHandle');
  const panel  = document.getElementById('bottomPanel');
  if (!handle || !panel) return;

  let isDragging = false, startY = 0, startH = 240;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true; startY = e.clientY; startH = panel.offsetHeight;
    document.body.style.cursor = 'ns-resize';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dy = startY - e.clientY;
    const newH = Math.max(80, Math.min(window.innerHeight - 200, startH + dy));
    panel.style.height = `${newH}px`;
    panel.classList.remove('collapsed');
  });
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = 'default';
      if (monacoEditorInstance) monacoEditorInstance.layout();
    }
  });
}

function getFileIconColor(ext) {
  switch (ext.toLowerCase()) {
    case '.py': return '#3572A5';
    case '.js': case '.mjs': return '#f7df1e';
    case '.ts': case '.tsx': return '#3178c6';
    case '.c': case '.cpp': case '.cc': return '#00599c';
    case '.java': return '#b07219';
    case '.html': return '#e34c26';
    case '.css': return '#563d7c';
    case '.json': return '#059669';
    case '.md': case '.markdown': return '#0284c7';
    case '.go': return '#00add8';
    case '.rs': return '#dea584';
    case '.rb': return '#cc342d';
    default: return '#64748b';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
