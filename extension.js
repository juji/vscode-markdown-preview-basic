const path = require('path');
const vscode = require('vscode');
const MarkdownIt = require('markdown-it');
const { createHighlighter } = require('shiki');

const COMMON_LANGS = [
  'javascript', 'typescript', 'jsx', 'tsx', 'json', 'html', 'css', 'scss',
  'markdown', 'bash', 'shell', 'python', 'rust', 'go', 'java', 'c', 'cpp',
  'csharp', 'ruby', 'php', 'sql', 'yaml', 'toml', 'xml', 'dockerfile',
  'diff', 'graphql', 'vue', 'svelte',
];

let highlighterPromise = null;
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: COMMON_LANGS,
    });
  }
  return highlighterPromise;
}

function makeMarkdownIt(highlighter, shikiTheme) {
  return new MarkdownIt({
    html: true,
    linkify: true,
    highlight(codeStr, lang) {
      if (!lang || lang === 'mermaid' || !highlighter.getLoadedLanguages().includes(lang)) {
        return '';
      }
      return highlighter.codeToHtml(codeStr, { lang, theme: shikiTheme });
    },
  });
}

function renderWithMath(md, source) {
  const blocks = [];
  const placeheld = source.replace(/\$\$[\s\S]+?\$\$|\$[^\n$]+?\$/g, (match) => {
    blocks.push(match);
    return `@@MATH${blocks.length - 1}@@`;
  });
  const html = md.render(placeheld);
  return html.replace(/@@MATH(\d+)@@/g, (_, i) => blocks[Number(i)]);
}

function shikiThemeFor(kind) {
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? 'github-light'
    : 'github-dark';
}

function resolveImageSrcs(html, docDir, webview) {
  return html.replace(/(<img[^>]+src=")([^"]+)(")/g, (match, pre, src, post) => {
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith('data:')) return match;
    const uri = webview.asWebviewUri(vscode.Uri.file(path.resolve(docDir, src)));
    return pre + uri.toString() + post;
  });
}

class MarkdownPreviewProvider {
  static viewType = 'markdownPreviewBasic.preview';

  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, webviewPanel) {
    const docDir = path.dirname(document.uri.fsPath);
    const mathjaxDir = vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'mathjax');
    const mermaidDir = vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'mermaid', 'dist');
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(docDir), mathjaxDir, mermaidDir],
    };
    const mathjaxUri = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(mathjaxDir, 'es5', 'tex-svg.js'));
    const mermaidUri = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(mermaidDir, 'mermaid.min.js'));
    webviewPanel.webview.html = this.getShellHtml(this.context.globalState.get('zoom', 1), webviewPanel.webview, mathjaxUri, mermaidUri);

    const render = async () => {
      const highlighter = await getHighlighter();
      const shikiTheme = shikiThemeFor(vscode.window.activeColorTheme.kind);
      const md = makeMarkdownIt(highlighter, shikiTheme);
      const html = resolveImageSrcs(renderWithMath(md, document.getText()), docDir, webviewPanel.webview);
      webviewPanel.webview.postMessage({ type: 'update', body: html });
    };

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) render();
    });
    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => render());
    const readySub = webviewPanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') render();
      if (msg.type === 'zoom') this.context.globalState.update('zoom', msg.value);
    });
    webviewPanel.onDidDispose(() => {
      changeSub.dispose();
      themeSub.dispose();
      readySub.dispose();
    });
  }

  getShellHtml(initialZoom, webview, mathjaxUri, mermaidUri) {
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' ${cspSource}; img-src ${cspSource} https: data:;">
<script>
  window.MathJax = {
    tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
    startup: { typeset: false }
  };
</script>
<script src="${mathjaxUri}"></script>
<script src="${mermaidUri}"></script>
<style>
  html { --zoom: 1; }
  body {
    font-family: var(--vscode-font-family, sans-serif);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    max-width: 860px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    font-size: calc(1rem * var(--zoom));
  }
  h1, h2, h3 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
  code { background: var(--vscode-textCodeBlock-background); padding: 0.15em 0.4em; border-radius: 4px; }
  pre code { display: block; padding: 1em; overflow-x: auto; }
  pre.shiki { position: relative; padding: 1em; overflow-x: auto; border-radius: 8px; font-size: 0.85em; }
  pre.shiki code { background: none; padding: 0; }
  .copy-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    opacity: 0;
    padding: 0.5em 0.8em;
    font-size: 0.8em;
    border: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.1s;
  }
  pre.shiki:hover .copy-button { opacity: 1; }
  .copy-button:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-panel-border)); }
  blockquote { border-left: 4px solid var(--vscode-textLink-foreground); margin: 0; padding: 0.2em 1em; opacity: 0.85; }
  table { display: block; overflow-x: auto; border-collapse: collapse; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 0.4em 0.8em; }
  thead th { position: sticky; top: 0; background: var(--vscode-editor-background); }
  tbody tr:nth-child(even) { background: var(--vscode-textCodeBlock-background); }
  tbody tr:hover { background: var(--vscode-list-hoverBackground, var(--vscode-textCodeBlock-background)); }
  a { color: var(--vscode-textLink-foreground); }
  #zoom-controls {
    position: fixed;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0.25rem;
    z-index: 1;
  }
  #zoom-controls button {
    width: 2.4rem;
    height: 2.4rem;
    border: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.4rem;
    line-height: 1;
  }
  #zoom-controls button:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-panel-border)); }
</style>
</head>
<body>
<div id="zoom-controls">
  <button id="zoom-out" title="Zoom out">-</button>
  <button id="zoom-in" title="Zoom in">+</button>
</div>
<div id="content"></div>
<script>
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  let zoom = ${JSON.stringify(initialZoom)};

  const cs = getComputedStyle(document.documentElement);
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      background: cs.getPropertyValue('--vscode-editor-background'),
      primaryColor: cs.getPropertyValue('--vscode-editor-background'),
      primaryTextColor: cs.getPropertyValue('--vscode-editor-foreground'),
      primaryBorderColor: cs.getPropertyValue('--vscode-panel-border'),
      lineColor: cs.getPropertyValue('--vscode-panel-border'),
      textColor: cs.getPropertyValue('--vscode-editor-foreground'),
      fontFamily: cs.getPropertyValue('--vscode-font-family'),
    },
  });

  function applyZoom() {
    document.documentElement.style.setProperty('--zoom', zoom);
    vscode.setState({ zoom });
    vscode.postMessage({ type: 'zoom', value: zoom });
  }
  applyZoom();

  document.getElementById('zoom-in').addEventListener('click', () => {
    zoom = Math.min(zoom + 0.1, 3);
    applyZoom();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    zoom = Math.max(zoom - 0.1, 0.5);
    applyZoom();
  });

  window.addEventListener('message', (event) => {
    if (event.data.type === 'update') {
      content.innerHTML = event.data.body;
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([content]);
      }
      const mermaidBlocks = content.querySelectorAll('code.language-mermaid');
      mermaidBlocks.forEach((block) => {
        const pre = block.closest('pre');
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = block.textContent;
        pre.replaceWith(div);
      });
      if (mermaidBlocks.length) mermaid.run({ nodes: content.querySelectorAll('.mermaid') });

      content.querySelectorAll('pre.shiki').forEach((pre) => {
        const code = pre.textContent;
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = 'Copy';
        button.addEventListener('click', () => {
          navigator.clipboard.writeText(code).then(() => {
            button.textContent = 'Copied';
            setTimeout(() => { button.textContent = 'Copy'; }, 1500);
          });
        });
        pre.prepend(button);
      });
    }
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MarkdownPreviewProvider.viewType,
      new MarkdownPreviewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
