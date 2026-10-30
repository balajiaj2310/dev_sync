/**
 * DevSync Workspace Extensions Pack
 * Built-in starter extensions: Themes, Vim Mode, Prettier formatter,
 * Bracket Pair Colorizer, Markdown Preview, and TODO Highlighter.
 *
 * All extensions are lazy-loaded — heavy CDN deps only fetched when enabled.
 */

import { ExtensionManager } from '../core/extension-manager.js';

// ─── Shared extension context (set by workspace.js after Monaco init) ─────────
let _ctx = {};

export function setExtensionContext(ctx) {
  _ctx = ctx;
}

export function getExtensionContext() {
  return _ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lazily load a script from CDN and resolve when ready. */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
}

// ─── FEATURE 1 : Themes Pack ──────────────────────────────────────────────────

const THEMES = {
  'devsync-light': {
    label: 'DevSync Light (Default)',
    base: 'vs',
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
  },
  'dracula': {
    label: 'Dracula Official',
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'operator', foreground: 'ff79c6' }
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a',
      'editor.selectionBackground': '#44475a',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f2',
      'editorIndentGuide.background1': '#3a3c4e',
      'editorIndentGuide.activeBackground1': '#6272a4',
      'editorGutter.background': '#282a36',
      'scrollbarSlider.background': '#44475a88'
    }
  },
  'one-dark-pro': {
    label: 'One Dark Pro',
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b', fontStyle: 'italic' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'operator', foreground: '56b6c2' }
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313a',
      'editor.selectionBackground': '#3e4451',
      'editorLineNumber.foreground': '#495162',
      'editorLineNumber.activeForeground': '#abb2bf',
      'editorCursor.foreground': '#528bff',
      'editorIndentGuide.background1': '#3b4048',
      'editorIndentGuide.activeBackground1': '#4b5263',
      'editorGutter.background': '#282c34',
      'scrollbarSlider.background': '#3e445188'
    }
  },
  'nord': {
    label: 'Nord Theme',
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'keyword', foreground: '81a1c1' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'function', foreground: '88c0d0' },
      { token: 'variable', foreground: 'd8dee9' },
      { token: 'operator', foreground: '81a1c1' }
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editor.selectionBackground': '#434c5e',
      'editorLineNumber.foreground': '#4c566a',
      'editorLineNumber.activeForeground': '#d8dee9',
      'editorCursor.foreground': '#d8dee9',
      'editorIndentGuide.background1': '#3b4252',
      'editorIndentGuide.activeBackground1': '#4c566a',
      'editorGutter.background': '#2e3440'
    }
  },
  'github-dark': {
    label: 'GitHub Dark Modern',
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'ffa657' },
      { token: 'operator', foreground: 'ff7b72' }
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#e6edf3',
      'editor.lineHighlightBackground': '#161b22',
      'editor.selectionBackground': '#388bfd33',
      'editorLineNumber.foreground': '#6e7681',
      'editorLineNumber.activeForeground': '#e6edf3',
      'editorCursor.foreground': '#58a6ff',
      'editorIndentGuide.background1': '#21262d',
      'editorIndentGuide.activeBackground1': '#30363d'
    }
  },
  'github-light': {
    label: 'GitHub Light Modern',
    base: 'vs',
    rules: [
      { token: 'comment', foreground: '6e7781', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'cf222e' },
      { token: 'string', foreground: '0a3069' },
      { token: 'number', foreground: '0550ae' },
      { token: 'type', foreground: '953800' },
      { token: 'function', foreground: '8250df' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24292f',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editor.selectionBackground': '#0969da33',
      'editorLineNumber.foreground': '#6e7781',
      'editorLineNumber.activeForeground': '#24292f'
    }
  }
};

export function registerAllThemes(monaco) {
  Object.entries(THEMES).forEach(([id, def]) => {
    if (id === 'devsync-light') return; // Already registered by workspace.js
    monaco.editor.defineTheme(id, {
      base: def.base,
      inherit: true,
      rules: def.rules,
      colors: def.colors
    });
  });
}

export function getThemeList() {
  return Object.entries(THEMES).map(([id, def]) => ({ id, label: def.label }));
}

// Register the themes extension
ExtensionManager.registerExtension(
  {
    id: 'themes-pack',
    name: 'Popular Themes Pack',
    description: 'Dracula, One Dark Pro, Nord, GitHub Dark/Light, and DevSync Light — 6 premium themes with instant switching.',
    category: 'theme',
    version: '1.0.0',
    icon: '🎨',
    bundled: true,
    enabledByDefault: true,
    tags: ['theme', 'color', 'dracula', 'nord', 'github', 'one dark']
  },
  async (ctx) => {
    const monaco = ctx.monaco || window.monaco;
    if (!monaco) return;
    registerAllThemes(monaco);
    // Apply saved theme preference
    const saved = ExtensionManager.getSetting('themes-pack', 'activeTheme', 'devsync-light');
    monaco.editor.setTheme(saved);
    return { monaco };
  },
  async (ctx) => {
    const monaco = ctx.monaco || window.monaco;
    if (monaco) monaco.editor.setTheme('devsync-light');
  }
);

// ─── FEATURE 2 : Vim Mode ─────────────────────────────────────────────────────

let _vimStatusBar = null;
let _vimMode = null;

ExtensionManager.registerExtension(
  {
    id: 'vim-mode',
    name: 'Vim Mode',
    description: 'Full modal Vim key bindings for Monaco. Shows mode indicator (NORMAL / INSERT / VISUAL) in the status bar.',
    category: 'keybinding',
    version: '1.0.0',
    icon: '🔤',
    bundled: true,
    enabledByDefault: false,
    tags: ['vim', 'keybindings', 'modal', 'editing']
  },
  async (ctx) => {
    const editor = ctx.editor || window.__devsyncEditor;
    if (!editor) throw new Error('Editor not ready');

    // Lazy-load monaco-vim from CDN
    await loadScript('https://unpkg.com/monaco-vim@0.4.1/dist/monaco-vim.js');

    // Create status bar element
    _vimStatusBar = document.createElement('div');
    _vimStatusBar.id = 'vimStatusBar';
    _vimStatusBar.className = 'vim-status-bar';
    _vimStatusBar.textContent = '-- NORMAL --';

    const panel = document.getElementById('bottomPanel');
    if (panel) panel.prepend(_vimStatusBar);

    // Initialise vim mode (window.MonacoVim set by CDN script)
    if (window.MonacoVim) {
      _vimMode = window.MonacoVim.initVimMode(editor, _vimStatusBar);
    }
    return { vimMode: _vimMode, statusBar: _vimStatusBar };
  },
  async () => {
    if (_vimMode) {
      _vimMode.dispose();
      _vimMode = null;
    }
    if (_vimStatusBar) {
      _vimStatusBar.remove();
      _vimStatusBar = null;
    }
  }
);

// ─── FEATURE 3 : Prettier Formatter ──────────────────────────────────────────

const PRETTIER_CDN = 'https://unpkg.com/prettier@3.3.3/standalone.js';
const PRETTIER_PLUGINS = {
  babel:    'https://unpkg.com/prettier@3.3.3/plugins/babel.js',
  html:     'https://unpkg.com/prettier@3.3.3/plugins/html.js',
  css:      'https://unpkg.com/prettier@3.3.3/plugins/postcss.js',
  markdown: 'https://unpkg.com/prettier@3.3.3/plugins/markdown.js',
  typescript: 'https://unpkg.com/prettier@3.3.3/plugins/typescript.js',
  estree:   'https://unpkg.com/prettier@3.3.3/plugins/estree.js'
};

let _prettierDisposables = [];

async function formatDocumentWithPrettier(editor, monaco) {
  const model = editor.getModel();
  if (!model) return;
  const lang = model.getLanguageId();

  // Map Monaco lang to Prettier parser
  const parserMap = {
    javascript: 'babel',
    typescript: 'typescript',
    html:       'html',
    css:        'css',
    markdown:   'markdown',
    json:       'json'
  };
  const parser = parserMap[lang];
  if (!parser) return; // Unsupported language — skip silently

  try {
    await loadScript(PRETTIER_CDN);
    // Load required plugins
    const pluginsToLoad = ['estree'];
    if (parser === 'babel' || parser === 'typescript') pluginsToLoad.push('babel');
    if (parser === 'typescript') pluginsToLoad.push('typescript');
    if (parser === 'html') pluginsToLoad.push('html');
    if (parser === 'css') pluginsToLoad.push('css');
    if (parser === 'markdown') pluginsToLoad.push('markdown');

    await Promise.all(pluginsToLoad.map(k => loadScript(PRETTIER_PLUGINS[k])));

    const prettier = window.prettier;
    const plugins  = window.prettierPlugins;
    if (!prettier || !plugins) return;

    const pluginList = pluginsToLoad.map(k => plugins[k]).filter(Boolean);
    const source = model.getValue();
    const tabSize = ExtensionManager.getSetting('prettier', 'tabWidth', editor.getOption(monaco.editor.EditorOption.tabSize));

    const formatted = await prettier.format(source, {
      parser,
      plugins: pluginList,
      tabWidth: tabSize,
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'es5'
    });

    if (formatted !== source) {
      const fullRange = model.getFullModelRange();
      editor.executeEdits('prettier', [{ range: fullRange, text: formatted }]);
    }
  } catch (err) {
    console.warn('[Prettier] Format failed:', err.message);
  }
}

ExtensionManager.registerExtension(
  {
    id: 'prettier',
    name: 'Prettier – Code Formatter',
    description: 'Auto-format JavaScript, TypeScript, HTML, CSS, Markdown and JSON with Prettier on Ctrl+Shift+F or via right-click.',
    category: 'formatter',
    version: '3.3.3',
    icon: '✨',
    bundled: true,
    enabledByDefault: false,
    tags: ['format', 'prettier', 'lint', 'style']
  },
  async (ctx) => {
    const { editor, monaco } = ctx;
    if (!editor || !monaco) return;

    // Register format document provider
    const disposables = [];

    // Right-click → Format Document
    const actionDisposable = editor.addAction({
      id: 'devsync.prettier.format',
      label: 'Format Document (Prettier)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      contextMenuGroupId: 'modification',
      contextMenuOrder: 1.5,
      run: () => formatDocumentWithPrettier(editor, monaco)
    });
    disposables.push(actionDisposable);
    _prettierDisposables = disposables;
    return { disposables };
  },
  async () => {
    _prettierDisposables.forEach(d => { try { d.dispose(); } catch {} });
    _prettierDisposables = [];
  }
);

// ─── FEATURE 4 : Bracket Pair Colorizer & Indent Guides ─────────────────────

ExtensionManager.registerExtension(
  {
    id: 'bracket-colorizer',
    name: 'Bracket Pair Colorizer & Indent Guides',
    description: 'Colorizes matching bracket pairs and renders active indent guide lines using Monaco\'s native engine.',
    category: 'productivity',
    version: '1.0.0',
    icon: '🎯',
    bundled: true,
    enabledByDefault: true,
    tags: ['brackets', 'indent', 'colorizer', 'guides']
  },
  async (ctx) => {
    const { editor } = ctx;
    if (!editor) return;
    editor.updateOptions({
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveBracketPair: true,
        indentation: true,
        highlightActiveIndentation: true
      }
    });
  },
  async (ctx) => {
    const { editor } = ctx;
    if (!editor) return;
    editor.updateOptions({
      bracketPairColorization: { enabled: false },
      guides: { bracketPairs: false, indentation: false }
    });
  }
);

// ─── FEATURE 5 : Markdown Live Preview ───────────────────────────────────────

let _markdownPreviewDisposable = null;

function renderMarkdown(source) {
  // Lightweight GFM renderer (no CDN needed — handles headings, code, links, tables, bold/italic)
  return source
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings
    .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    // Bold / Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Unordered lists
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Blockquotes
    .replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Paragraphs (double newlines)
    .replace(/\n\n([^<\n])/g, '\n\n<p>$1')
    .replace(/([^>\n])\n\n/g, '$1</p>\n\n')
    // Line breaks
    .replace(/\n/g, '<br>');
}

ExtensionManager.registerExtension(
  {
    id: 'markdown-preview',
    name: 'Markdown Live Preview',
    description: 'Shows a live side-by-side rendered preview when editing .md files. Updates in real-time as you type.',
    category: 'preview',
    version: '1.0.0',
    icon: '📄',
    bundled: true,
    enabledByDefault: true,
    tags: ['markdown', 'preview', 'readme', 'documentation']
  },
  async (ctx) => {
    const { editor, getActiveTab } = ctx;
    if (!editor) return;

    // Listen for model changes & tab switches to show/hide preview button
    const updatePreviewBtn = () => {
      const tab = getActiveTab?.();
      const isMarkdown = tab && (tab.path.endsWith('.md') || tab.path.endsWith('.markdown'));
      const btn = document.getElementById('mdPreviewToggleBtn');
      if (btn) btn.style.display = isMarkdown ? 'flex' : 'none';
    };

    const changeDisposable = editor.onDidChangeModel(() => updatePreviewBtn());
    _markdownPreviewDisposable = changeDisposable;
    updatePreviewBtn();

    return { changeDisposable };
  },
  async (ctx) => {
    if (_markdownPreviewDisposable) {
      _markdownPreviewDisposable.dispose();
      _markdownPreviewDisposable = null;
    }
    closeMdPreview();
  }
);

export function openMdPreview(editor) {
  const container = document.getElementById('monacoEditorRoot');
  if (!container) return;

  let panel = document.getElementById('mdPreviewPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'mdPreviewPanel';
    panel.className = 'md-preview-panel';
    panel.innerHTML = '<div class="md-preview-header"><span>Preview</span><button class="sidebar-icon-btn" id="closeMdPreview" title="Close Preview">✕</button></div><div class="md-preview-body" id="mdPreviewBody"></div>';
    container.parentElement.appendChild(panel);
    document.getElementById('closeMdPreview')?.addEventListener('click', closeMdPreview);
    container.style.width = '50%';
    if (window.__devsyncEditor) window.__devsyncEditor.layout();
  }

  const render = () => {
    const body = document.getElementById('mdPreviewBody');
    if (body) body.innerHTML = renderMarkdown(editor.getValue());
  };

  render();
  const disposable = editor.onDidChangeModelContent(render);
  panel._disposable = disposable;
}

export function closeMdPreview() {
  const panel = document.getElementById('mdPreviewPanel');
  if (panel) {
    if (panel._disposable) panel._disposable.dispose();
    panel.remove();
    const container = document.getElementById('monacoEditorRoot');
    if (container) container.style.width = '';
    if (window.__devsyncEditor) window.__devsyncEditor.layout();
  }
  const btn = document.getElementById('mdPreviewToggleBtn');
  if (btn) btn.setAttribute('data-open', 'false');
}

// ─── FEATURE 6 : TODO Highlighter & Task Tree ─────────────────────────────────

const TODO_PATTERNS = [
  { tag: 'TODO',  color: '#0284c7', bg: '#e0f2fe' },
  { tag: 'FIXME', color: '#dc2626', bg: '#fee2e2' },
  { tag: 'NOTE',  color: '#059669', bg: '#dcfce7' },
  { tag: 'HACK',  color: '#d97706', bg: '#fef9c3' }
];

let _todoDecorations = [];
let _todoModelDisposable = null;

function updateTodoDecorations(editor, monaco) {
  const model = editor.getModel();
  if (!model) return;

  const text = model.getValue();
  const lines = text.split('\n');
  const newDecorations = [];

  lines.forEach((line, idx) => {
    TODO_PATTERNS.forEach(({ tag, color }) => {
      const re = new RegExp(`\\b${tag}\\b`, 'gi');
      let match;
      while ((match = re.exec(line)) !== null) {
        newDecorations.push({
          range: new monaco.Range(idx + 1, match.index + 1, idx + 1, match.index + tag.length + 1),
          options: {
            inlineClassName: `todo-highlight-${tag.toLowerCase()}`,
            glyphMarginClassName: `glyph-todo-${tag.toLowerCase()}`,
            overviewRuler: { color, position: monaco.editor.OverviewRulerLane.Right },
            minimap: { color, position: monaco.editor.MinimapPosition.Inline }
          }
        });
      }
    });
  });

  _todoDecorations = editor.deltaDecorations(_todoDecorations, newDecorations);
  renderTodoTree(editor, monaco);
}

function renderTodoTree(editor, monaco) {
  const container = document.getElementById('todoTreeContainer');
  if (!container) return;

  const model = editor.getModel();
  if (!model) { container.innerHTML = '<p class="todo-empty">No file open.</p>'; return; }

  const lines = model.getValue().split('\n');
  const items = [];

  lines.forEach((line, idx) => {
    TODO_PATTERNS.forEach(({ tag, color, bg }) => {
      const re = new RegExp(`\\b${tag}[:\\s]+(.*)`, 'i');
      const match = re.exec(line);
      if (match) {
        items.push({ tag, text: match[1].trim(), line: idx + 1, color, bg });
      }
    });
  });

  if (items.length === 0) {
    container.innerHTML = '<p class="todo-empty">No TODOs, FIXMEs, or NOTEs found.</p>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="todo-item" data-line="${item.line}" style="--todo-color:${item.color}; --todo-bg:${item.bg}">
      <span class="todo-tag">${item.tag}</span>
      <span class="todo-text">${item.text || ''}</span>
      <span class="todo-line">L${item.line}</span>
    </div>
  `).join('');

  container.querySelectorAll('.todo-item').forEach(el => {
    el.addEventListener('click', () => {
      const line = parseInt(el.dataset.line, 10);
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    });
  });
}

ExtensionManager.registerExtension(
  {
    id: 'todo-highlighter',
    name: 'TODO Highlighter & Task Tree',
    description: 'Highlights TODO, FIXME, NOTE, HACK comments with colors and lists them in a collapsible task panel.',
    category: 'productivity',
    version: '1.0.0',
    icon: '✅',
    bundled: true,
    enabledByDefault: true,
    tags: ['todo', 'fixme', 'note', 'tasks', 'comments']
  },
  async (ctx) => {
    const { editor, monaco } = ctx;
    if (!editor || !monaco) return;

    updateTodoDecorations(editor, monaco);
    _todoModelDisposable = editor.onDidChangeModelContent(() => {
      updateTodoDecorations(editor, monaco);
    });

    return { disposable: _todoModelDisposable };
  },
  async (ctx) => {
    if (_todoModelDisposable) {
      _todoModelDisposable.dispose();
      _todoModelDisposable = null;
    }
    const { editor } = ctx;
    if (editor) {
      editor.deltaDecorations(_todoDecorations, []);
      _todoDecorations = [];
    }
    const container = document.getElementById('todoTreeContainer');
    if (container) container.innerHTML = '<p class="todo-empty">TODO Highlighter disabled.</p>';
  }
);

// ─── Export public API ────────────────────────────────────────────────────────

export { renderMarkdown, updateTodoDecorations, renderTodoTree, formatDocumentWithPrettier };
