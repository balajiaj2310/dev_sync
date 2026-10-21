/**
 * DevSync Code Workspace & Browser IDE Controller
 * Handles Monaco editor lifecycle, multi-tab file editing, tree navigation,
 * real code execution, Git operations, and external IDE integration.
 */

import { WorkspaceService } from '../services/workspace-service.js';

let currentRepoId = 'devsync-core';
let currentBranch = 'main';
let currentRepoInfo = null;
let monacoEditorInstance = null;
let monacoModels = new Map(); // path -> monaco.editor.ITextModel

// Tab management state
let openTabs = []; // Array of { path, name, language, dirty, content }
let activeTabPath = null;
let isEditorDirty = false;

// Monaco editor language mapping
const EXT_TO_MONACO_LANG = {
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.java': 'java',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml'
};

export async function initWorkspacePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const repoParam = urlParams.get('repo') || urlParams.get('project');
  if (repoParam) {
    currentRepoId = repoParam.trim();
  }

  const branchParam = urlParams.get('branch');
  if (branchParam) {
    currentBranch = branchParam.trim();
  }

  setupEventListeners();
  await loadWorkspace();
}

/**
 * Setup UI interaction handlers, shortcuts, and modal triggers
 */
function setupEventListeners() {
  // Global shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActiveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runActiveCode();
    }
  });

  // Topbar actions
  document.getElementById('saveBtn')?.addEventListener('click', saveActiveFile);
  document.getElementById('runBtn')?.addEventListener('click', runActiveCode);
  document.getElementById('openIdeBtn')?.addEventListener('click', openIdeModal);
  document.getElementById('refreshTreeBtn')?.addEventListener('click', () => loadFileTree());

  // Branch selector change
  const branchSelect = document.getElementById('workspaceBranchSelect');
  branchSelect?.addEventListener('change', async (e) => {
    currentBranch = e.target.value;
    updateDownloadZipUrl();
    await loadFileTree();
  });

  // Language selector change
  const langSelect = document.getElementById('workspaceLangSelect');
  langSelect?.addEventListener('change', (e) => {
    const newLang = e.target.value;
    if (activeTabPath && monacoEditorInstance) {
      const activeTab = openTabs.find(t => t.path === activeTabPath);
      if (activeTab) {
        activeTab.language = newLang;
        const model = monacoEditorInstance.getModel();
        if (model && window.monaco) {
          window.monaco.editor.setModelLanguage(model, newLang);
        }
      }
    }
  });

  // Sidebar collapse toggle
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('workspaceSidebar');
    sidebar?.classList.toggle('collapsed');
  });

  // Bottom panel tabs
  const panelTabs = document.querySelectorAll('.panel-tab');
  panelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      panelTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetView = tab.getAttribute('data-tab');
      switchBottomPanelView(targetView);
    });
  });

  // Bottom panel collapse toggle
  document.getElementById('togglePanelBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('bottomPanel');
    panel?.classList.toggle('collapsed');
  });

  // Clear output
  document.getElementById('clearOutputBtn')?.addEventListener('click', () => {
    const stdout = document.getElementById('stdoutText');
    const stderr = document.getElementById('stderrText');
    if (stdout) stdout.textContent = '';
    if (stderr) stderr.textContent = 'No errors reported.';
    const badge = document.getElementById('errorCountBadge');
    if (badge) badge.style.display = 'none';
  });

  // Run with Stdin button
  document.getElementById('runWithStdinBtn')?.addEventListener('click', () => {
    const stdinVal = document.getElementById('stdinInput')?.value || '';
    runActiveCode(stdinVal);
  });

  // Modal Triggers
  document.getElementById('newFileBtn')?.addEventListener('click', () => showModal('newFileModal'));
  document.getElementById('newFolderBtn')?.addEventListener('click', () => showModal('newFolderModal'));
  document.getElementById('confirmNewFileBtn')?.addEventListener('click', handleCreateFile);
  document.getElementById('confirmNewFolderBtn')?.addEventListener('click', handleCreateFolder);
  document.getElementById('confirmRenameBtn')?.addEventListener('click', handleRenameConfirm);
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDeleteConfirm);
  document.getElementById('confirmGitCommitBtn')?.addEventListener('click', handleGitCommitConfirm);
  document.getElementById('openCommitModalBtn')?.addEventListener('click', () => showModal('gitCommitModal'));

  // Copy Clone URL
  document.getElementById('copyCloneBtn')?.addEventListener('click', () => {
    const text = document.getElementById('httpsCloneUrl')?.textContent || '';
    navigator.clipboard?.writeText(text);
    const btn = document.getElementById('copyCloneBtn');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }
  });

  // Modal dismiss buttons
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // Drag-resizable bottom panel handle
  initResizeHandle();
}

/**
 * Load workspace metadata, repository permissions, branches, and initialize editor
 */
async function loadWorkspace() {
  try {
    const info = await WorkspaceService.getInfo(currentRepoId);
    currentRepoInfo = info;

    // Update Topbar
    const repoNameDisplay = document.getElementById('repoNameDisplay');
    if (repoNameDisplay) repoNameDisplay.textContent = info.repository;

    const repoBreadcrumb = document.getElementById('repoBreadcrumb');
    if (repoBreadcrumb) repoBreadcrumb.href = `detail.html?repo=${encodeURIComponent(info.repository)}`;

    const backBtn = document.getElementById('backToRepoBtn');
    if (backBtn) backBtn.href = `detail.html?repo=${encodeURIComponent(info.repository)}`;

    // Populate branches dropdown
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

    // Permission checks
    if (info.permissions && info.permissions.isReadOnly) {
      document.getElementById('saveBtn')?.setAttribute('disabled', 'true');
      document.getElementById('newFileBtn')?.style.setProperty('display', 'none');
      document.getElementById('newFolderBtn')?.style.setProperty('display', 'none');
      const ind = document.getElementById('saveStatusIndicator');
      if (ind) ind.innerHTML = '<span class="badge badge-secondary" style="font-size:10px;">Read-Only Mode</span>';
    }

    updateDownloadZipUrl();
    await initMonacoEditor();
    await loadFileTree();
  } catch (err) {
    console.error('Failed to load workspace:', err);
    const tree = document.getElementById('fileTreeContainer');
    if (tree) {
      tree.innerHTML = `<div style="padding:16px; color:#dc2626; font-size:12px;">Failed to load repository workspace: ${escapeHtml(err.message || 'Error')}</div>`;
    }
  }
}

/**
 * Initialize Monaco Editor or fallback to lightweight textarea
 */
function initMonacoEditor() {
  return new Promise((resolve) => {
    if (typeof window.require !== 'undefined') {
      window.require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
      });

      window.require(['vs/editor/editor.main'], function (monaco) {
        window.monaco = monaco;

        // Custom DevSync Light Theme
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
            'editorIndentGuide.background': '#e2e8f0',
            'editorIndentGuide.activeBackground': '#cbd5e1'
          }
        });

        const rootEl = document.getElementById('monacoEditorRoot');
        if (rootEl) {
          monacoEditorInstance = monaco.editor.create(rootEl, {
            value: '# Welcome to DevSync Code Workspace\n# Select a file from the explorer to begin editing.\n',
            language: 'python',
            theme: 'devsync-light',
            fontSize: 13.5,
            fontFamily: "'Consolas', 'Fira Code', 'Monaco', monospace",
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 4
          });

          // Change listener to track dirty state
          monacoEditorInstance.onDidChangeModelContent(() => {
            if (activeTabPath) {
              const tab = openTabs.find(t => t.path === activeTabPath);
              if (tab && !tab.dirty) {
                tab.dirty = true;
                updateTabHeader(tab);
                setSaveStatus(false);
              }
            }
          });

          // Shortcuts inside Monaco
          monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            saveActiveFile();
          });
          monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            runActiveCode();
          });
        }
        resolve();
      });
    } else {
      // Fallback to text area if Monaco CDN failed
      console.warn('Monaco AMD loader not available, falling back to textarea editor.');
      const fallback = document.getElementById('fallbackEditor');
      const monacoRoot = document.getElementById('monacoEditorRoot');
      if (fallback) fallback.style.display = 'block';
      if (monacoRoot) monacoRoot.style.display = 'none';

      fallback?.addEventListener('input', () => {
        if (activeTabPath) {
          const tab = openTabs.find(t => t.path === activeTabPath);
          if (tab && !tab.dirty) {
            tab.dirty = true;
            updateTabHeader(tab);
            setSaveStatus(false);
          }
        }
      });
      resolve();
    }
  });
}

/**
 * Fetch and render the branch file tree in the sidebar
 */
async function loadFileTree() {
  const container = document.getElementById('fileTreeContainer');
  if (!container) return;

  try {
    const data = await WorkspaceService.getTree(currentRepoId, currentBranch);
    container.innerHTML = '';

    if (!data.tree || data.tree.length === 0) {
      container.innerHTML = `
        <div style="padding:16px; color:#64748b; font-size:12px; text-align:center;">
          No files on branch <strong>${escapeHtml(currentBranch)}</strong>.<br>
          Click <a href="#" id="createFirstFileLink">Create File</a> to start.
        </div>`;
      document.getElementById('createFirstFileLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showModal('newFileModal');
      });
      return;
    }

    renderTreeNodes(data.tree, container, 0);

    // If no tab is open and files exist, open the first file or README.md
    if (openTabs.length === 0 && data.files && data.files.length > 0) {
      const readme = data.files.find(f => f.name.toLowerCase() === 'readme.md');
      const firstFile = readme || data.files[0];
      await openFile(firstFile.path);
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:16px; color:#dc2626; font-size:12px;">Failed to load files: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Recursive tree node renderer
 */
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

      if (node.children && node.children.length > 0) {
        renderTreeNodes(node.children, childrenContainer, depth + 1);
      }
    } else {
      // File Node
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
    e.stopPropagation();
    openRenameModal(path);
  });
  row.querySelector('.btn-node-delete')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(path, isDir);
  });
}

/**
 * Open a file in the Monaco editor / tab list
 */
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

/**
 * Switch active editor document tab
 */
function activateTab(filePath) {
  activeTabPath = filePath;
  const tab = openTabs.find(t => t.path === filePath);
  if (!tab) return;

  // Sync Language selector
  const langSelect = document.getElementById('workspaceLangSelect');
  if (langSelect) {
    const hasOpt = Array.from(langSelect.options).some(o => o.value === tab.language);
    if (hasOpt) {
      langSelect.value = tab.language;
    } else {
      const ext = (tab.path || '').split('.').pop().toLowerCase();
      if (['py'].includes(ext)) langSelect.value = 'python';
      else if (['js', 'jsx', 'ts'].includes(ext)) langSelect.value = 'javascript';
      else if (['c', 'h'].includes(ext)) langSelect.value = 'c';
      else if (['cpp', 'cc', 'cxx'].includes(ext)) langSelect.value = 'cpp';
      else if (['java'].includes(ext)) langSelect.value = 'java';
      else langSelect.value = 'python';
    }
  }

  // Update Monaco Editor Model
  if (monacoEditorInstance && window.monaco) {
    let model = monacoModels.get(filePath);
    if (!model) {
      const uri = window.monaco.Uri.parse(`file:///${filePath}`);
      model = window.monaco.editor.getModel(uri) || window.monaco.editor.createModel(tab.content, tab.language, uri);
      monacoModels.set(filePath, model);
    }
    monacoEditorInstance.setModel(model);
  } else {
    const fallback = document.getElementById('fallbackEditor');
    if (fallback) fallback.value = tab.content;
  }

  // Highlight active tree node
  document.querySelectorAll('.tree-node').forEach(node => {
    const label = node.querySelector('.tree-node-label')?.getAttribute('title');
    if (label === filePath) {
      node.classList.add('active');
    } else {
      node.classList.remove('active');
    }
  });

  renderTabs();
  setSaveStatus(!tab.dirty);
}

/**
 * Render editor tabs bar
 */
function renderTabs() {
  const bar = document.getElementById('editorTabsBar');
  if (!bar) return;
  bar.innerHTML = '';

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
      e.stopPropagation();
      closeTab(tab.path);
    });

    bar.appendChild(tabEl);
  });
}

function updateTabHeader(tab) {
  renderTabs();
}

/**
 * Close an editor tab
 */
function closeTab(filePath) {
  const idx = openTabs.findIndex(t => t.path === filePath);
  if (idx === -1) return;

  const tab = openTabs[idx];
  if (tab.dirty) {
    if (!confirm(`File "${tab.name}" has unsaved changes. Close anyway?`)) {
      return;
    }
  }

  openTabs.splice(idx, 1);

  if (activeTabPath === filePath) {
    if (openTabs.length > 0) {
      const nextTab = openTabs[Math.max(0, idx - 1)];
      activateTab(nextTab.path);
    } else {
      activeTabPath = null;
      if (monacoEditorInstance) {
        monacoEditorInstance.setValue('# No files open\n# Select a file from the explorer or create a new one.\n');
      }
    }
  }

  renderTabs();
}

/**
 * Save active file to backend
 */
export async function saveActiveFile() {
  if (!activeTabPath) return;
  const tab = openTabs.find(t => t.path === activeTabPath);
  if (!tab) return;

  const content = getEditorContent();
  const ind = document.getElementById('saveStatusIndicator');
  if (ind) ind.innerHTML = '<span style="color:#d97706;">Saving...</span>';

  try {
    await WorkspaceService.saveFile(currentRepoId, {
      branch: currentBranch,
      path: tab.path,
      content,
      commitMessage: `Update ${tab.path}`
    });

    tab.content = content;
    tab.dirty = false;
    renderTabs();
    setSaveStatus(true);
  } catch (err) {
    alert(`Failed to save ${tab.path}: ${err.message}`);
    setSaveStatus(false);
  }
}

/**
 * Execute current code in sandbox runner
 */
export async function runActiveCode(stdinValue = '') {
  const content = getEditorContent();
  if (!content.trim()) {
    alert('Please enter or open code to execute.');
    return;
  }

  // Handle document / non-code files (e.g. README.md, json, html)
  const nonRunnableExts = ['.md', '.markdown', '.json', '.html', '.css', '.txt', '.xml', '.yaml', '.yml'];
  const ext = activeTabPath ? '.' + activeTabPath.split('.').pop().toLowerCase() : '';
  if (nonRunnableExts.includes(ext)) {
    switchBottomPanelView('output');
    const stdout = document.getElementById('stdoutText');
    const stderr = document.getElementById('stderrText');
    if (stdout) {
      stdout.textContent = `[Notice] "${activeTabPath}" is a ${ext.replace('.', '').toUpperCase()} document and cannot be directly executed.\n\nTo execute code:\n1. Click any script file in the Explorer on the left (e.g., Python or JavaScript).\n2. Or create a new script file (e.g., main.py) and click "Run".`;
    }
    if (stderr) stderr.textContent = '';
    return;
  }

  const langSelect = document.getElementById('workspaceLangSelect');
  const language = langSelect?.value || 'python';
  const filePath = activeTabPath || `main.${language === 'python' ? 'py' : 'js'}`;

  const runBtn = document.getElementById('runBtn');
  if (runBtn) {
    runBtn.setAttribute('disabled', 'true');
    runBtn.innerHTML = '<span>Running...</span>';
  }

  // Switch to Output view
  switchBottomPanelView('output');
  const stdout = document.getElementById('stdoutText');
  const stderr = document.getElementById('stderrText');
  if (stdout) stdout.textContent = 'Running program in secure sandbox...\n';
  if (stderr) stderr.textContent = '';

  try {
    const res = await WorkspaceService.executeCode(currentRepoId, {
      branch: currentBranch,
      filePath,
      sourceCode: content,
      language,
      stdin: stdinValue || document.getElementById('stdinInput')?.value || ''
    });

    // Update Console Meta Bar
    const metaBar = document.getElementById('consoleMetaBar');
    if (metaBar) metaBar.style.display = 'flex';

    const metaStatus = document.getElementById('metaStatus');
    if (metaStatus) {
      metaStatus.textContent = res.status || (res.exit_code === 0 ? 'Success' : 'Failed');
      metaStatus.style.color = res.exit_code === 0 ? '#10b981' : '#dc2626';
    }

    const metaWallTime = document.getElementById('metaWallTime');
    if (metaWallTime) metaWallTime.textContent = `${res.wall_time_ms || res.execution_time_ms || 0} ms`;

    const metaMemory = document.getElementById('metaMemory');
    if (metaMemory) metaMemory.textContent = `${res.memory_kb || res.memory_usage_kb || 0} KB`;

    const metaExitCode = document.getElementById('metaExitCode');
    if (metaExitCode) metaExitCode.textContent = `Exit ${res.exit_code}`;

    const errText = [res.compile_output, res.stderr].filter(Boolean).join('\n');

    // Render Stdout & Stderr clearly
    if (stdout) {
      if (res.exit_code !== 0) {
        stdout.textContent = (res.stdout ? res.stdout + '\n' : '') + (errText ? `[Execution Error — Exit Code ${res.exit_code}]\n${errText}` : `[Program terminated with exit code ${res.exit_code}]`);
      } else {
        stdout.textContent = res.stdout || '(Program exited cleanly with no output)';
      }
    }

    if (stderr) {
      stderr.textContent = errText || 'No errors reported.';
      const badge = document.getElementById('errorCountBadge');
      if (badge) {
        if (errText) {
          badge.textContent = res.exit_code !== 0 ? 'Error' : '!';
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    if (stdout) stdout.textContent = `Execution failed: ${err.message}`;
    if (stderr) stderr.textContent = err.message;
  } finally {
    if (runBtn) {
      runBtn.removeAttribute('disabled');
      runBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Run</span>
      `;
    }
  }
}

/**
 * Switch bottom console tabs (output, errors, stdin, history, git)
 */
function switchBottomPanelView(viewKey) {
  const views = ['Output', 'Errors', 'Stdin', 'History', 'Git'];
  views.forEach(v => {
    const el = document.getElementById(`view${v}`);
    if (el) {
      el.style.display = v.toLowerCase() === viewKey.toLowerCase() ? 'block' : 'none';
    }
  });

  const panelTabs = document.querySelectorAll('.panel-tab');
  panelTabs.forEach(t => {
    if (t.getAttribute('data-tab')?.toLowerCase() === viewKey.toLowerCase()) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  if (viewKey === 'history') loadExecutionHistory();
  if (viewKey === 'git') loadGitStatus();
}

/**
 * Load execution history
 */
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

/**
 * Load Git status
 */
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

/**
 * External IDE Modal setup
 */
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

    const cliInstructions = document.getElementById('cliInstructionsText');
    if (cliInstructions && config.cliSetup) {
      cliInstructions.textContent = [
        `# Clone repository`,
        config.cliSetup.clone,
        `# Enter directory`,
        config.cliSetup.cd,
        `# Setup environment`,
        config.cliSetup.pythonSetup
      ].join('\n');
    }

    showModal('ideModal');
  } catch (err) {
    alert(`Failed to load IDE configuration: ${err.message}`);
  }
}

/**
 * Handle new file creation
 */
async function handleCreateFile() {
  const input = document.getElementById('newFilePathInput');
  const pathVal = input?.value?.trim();
  if (!pathVal) {
    alert('Please enter a file path.');
    return;
  }

  try {
    await WorkspaceService.createFile(currentRepoId, {
      branch: currentBranch,
      path: pathVal,
      type: 'file',
      content: ''
    });
    hideModal('newFileModal');
    if (input) input.value = '';
    await loadFileTree();
    await openFile(pathVal);
  } catch (err) {
    alert(`Failed to create file: ${err.message}`);
  }
}

/**
 * Handle new folder creation
 */
async function handleCreateFolder() {
  const input = document.getElementById('newFolderPathInput');
  const pathVal = input?.value?.trim();
  if (!pathVal) {
    alert('Please enter a folder path.');
    return;
  }

  try {
    await WorkspaceService.createFile(currentRepoId, {
      branch: currentBranch,
      path: pathVal,
      type: 'directory'
    });
    hideModal('newFolderModal');
    if (input) input.value = '';
    await loadFileTree();
  } catch (err) {
    alert(`Failed to create folder: ${err.message}`);
  }
}

/**
 * Open rename modal
 */
function openRenameModal(path) {
  const hidden = document.getElementById('renameOldPath');
  const input = document.getElementById('renameNewPathInput');
  if (hidden) hidden.value = path;
  if (input) input.value = path;
  showModal('renameModal');
}

async function handleRenameConfirm() {
  const oldPath = document.getElementById('renameOldPath')?.value;
  const newPath = document.getElementById('renameNewPathInput')?.value?.trim();
  if (!oldPath || !newPath) return;

  try {
    await WorkspaceService.renameFile(currentRepoId, {
      branch: currentBranch,
      oldPath,
      newPath
    });

    hideModal('renameModal');
    // Update open tabs if renamed
    openTabs.forEach(t => {
      if (t.path === oldPath) {
        t.path = newPath;
        t.name = newPath.split('/').pop();
      }
    });
    if (activeTabPath === oldPath) activeTabPath = newPath;
    renderTabs();
    await loadFileTree();
  } catch (err) {
    alert(`Failed to rename: ${err.message}`);
  }
}

/**
 * Open delete modal
 */
function openDeleteModal(path, isDir) {
  const target = document.getElementById('deleteTarget');
  const display = document.getElementById('deleteTargetDisplay');
  if (target) target.value = path;
  if (display) display.textContent = `${isDir ? 'folder' : 'file'} "${path}"`;
  showModal('deleteModal');
}

async function handleDeleteConfirm() {
  const path = document.getElementById('deleteTarget')?.value;
  if (!path) return;

  try {
    await WorkspaceService.deleteFile(currentRepoId, currentBranch, path);
    hideModal('deleteModal');
    // Close tab if open
    closeTab(path);
    await loadFileTree();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

/**
 * Handle Git commit
 */
async function handleGitCommitConfirm() {
  const input = document.getElementById('commitMessageInput');
  const msg = input?.value?.trim();
  if (!msg) {
    alert('Please enter a commit message.');
    return;
  }

  try {
    await WorkspaceService.commitChanges(currentRepoId, {
      branch: currentBranch,
      message: msg
    });
    hideModal('gitCommitModal');
    if (input) input.value = '';
    alert('Changes committed successfully!');
    loadGitStatus();
  } catch (err) {
    alert(`Failed to commit: ${err.message}`);
  }
}

/**
 * Helpers
 */
function getEditorContent() {
  if (monacoEditorInstance) {
    return monacoEditorInstance.getValue();
  }
  const fallback = document.getElementById('fallbackEditor');
  return fallback?.value || '';
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
  if (zipBtn) {
    zipBtn.href = WorkspaceService.getArchiveUrl(currentRepoId, currentBranch);
  }
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
  const panel = document.getElementById('bottomPanel');
  if (!handle || !panel) return;

  let isDragging = false;
  let startY = 0;
  let startH = 240;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startH = panel.offsetHeight;
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
    case '.js': return '#f7df1e';
    case '.ts': return '#3178c6';
    case '.c':
    case '.cpp': return '#00599c';
    case '.java': return '#b07219';
    case '.html': return '#e34c26';
    case '.css': return '#563d7c';
    case '.json': return '#059669';
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
