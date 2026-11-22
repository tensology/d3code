const icons = {
  workspace: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4zM8 9h8M8 13h5"/>',
  editor: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  terminal: '<path d="m4 7 5 5-5 5m8 1h8"/>',
  assistant: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M6 8h6M6 12h4"/>',
  settings: '<path d="M4 7h1m6 0h9M4 17h9m6 0h1"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
}

export function workspaceToolbarHtml(): string {
  const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`
  return `<header class="workspace-toolbar" aria-label="D3Code workspace">
    <div class="workspace-identity">
      <button id="mobilePanelButton" class="workspace-tool workspace-drawer" type="button" title="Open sessions" aria-label="Open sessions" aria-controls="workspaceSessions" aria-expanded="false">${icon("workspace")}</button>
      <span class="workspace-brand">D3Code</span>
    </div>
    <nav class="workspace-modes" aria-label="D3Code views">
      <button id="chatModeButton" class="workspace-tool workspace-mode active" type="button" aria-pressed="true" aria-controls="chatView">${icon("chat")}<span>Chat</span></button>
      <button id="editorModeButton" class="workspace-tool workspace-mode" type="button" aria-pressed="false" aria-controls="editorView">${icon("editor")}<span>Editor</span></button>
      <button id="terminalModeButton" class="workspace-tool workspace-mode" type="button" aria-pressed="false" aria-controls="terminalView">${icon("terminal")}<span>Terminal</span></button>
    </nav>
    <span class="workspace-context" id="meta"></span>
    <div class="workspace-actions">
      <button id="agentPanelToggle" class="workspace-tool workspace-utility" type="button" aria-pressed="false" aria-label="Show chat panel" title="Show chat panel">${icon("assistant")}</button>
      <button id="workspaceSettings" class="workspace-tool workspace-utility" type="button" aria-label="Settings" aria-haspopup="dialog" title="Settings">${icon("settings")}</button>
    </div>
  </header>`
}

export const workspaceToolbarStyles = `
@font-face {
  font-family: "Portal Quicksand";
  src: url("/static/main/fonts/brand/Quicksand.ttf") format("truetype");
  font-weight: 300 700;
  font-display: swap;
}
.workspace-toolbar {
  --workspace-accent: var(--accent);
  --workspace-ink: color-mix(in srgb, var(--workspace-accent) 48%, var(--text));
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: 44px;
  padding: 0 12px;
  background: var(--chrome);
  box-shadow: inset 0 -1px var(--line);
  color: var(--text);
}
.embedded .workspace-toolbar {
  --workspace-accent: var(--portal-workspace-accent, #2563eb);
  background: var(--panel);
  font-family: "Portal Quicksand", system-ui, sans-serif;
}
.workspace-identity, .workspace-modes, .workspace-actions { display: flex; align-items: stretch; }
.workspace-brand, .workspace-context { align-self: center; white-space: nowrap; }
.workspace-brand { font-size: 14px; font-weight: 700; }
.workspace-context {
  margin-inline-start: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--soft);
  font-size: 12px;
  font-weight: 600;
}
.workspace-context:empty, .embedded .workspace-brand, .workspace-toolbar [hidden] { display: none; }
.workspace-toolbar .workspace-tool {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: auto;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--soft);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.workspace-toolbar .workspace-tool:hover { color: var(--text); background: var(--panel2); }
.workspace-toolbar .workspace-tool.active {
  color: var(--workspace-ink);
  background: color-mix(in srgb, var(--workspace-accent) 9%, var(--panel));
  font-weight: 700;
}
.workspace-mode.active::after {
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: var(--workspace-ink);
  content: "";
}
.workspace-toolbar .workspace-tool:focus-visible { outline: 2px solid var(--workspace-ink); outline-offset: -3px; }
.workspace-tool svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.workspace-toolbar .workspace-utility { width: 44px; padding: 0; }
.workspace-toolbar .workspace-drawer, .embedded .workspace-identity { display: none; }
@media (max-width: 760px) {
  .workspace-toolbar { gap: 4px; padding: 0 4px; }
  .workspace-toolbar .workspace-brand, .workspace-toolbar .workspace-context { display: none; }
  .workspace-toolbar .workspace-identity { display: flex; }
  .workspace-toolbar .workspace-drawer:not([hidden]) { display: inline-flex; width: 44px; padding: 0; }
  .workspace-identity:not(:has(.workspace-drawer:not([hidden]))) { display: none; }
  .workspace-modes { flex: 1; min-width: 0; }
  .workspace-toolbar .workspace-mode { flex: 1 0 auto; min-width: 44px; padding: 0 4px; font-size: 12px; }
  .workspace-mode svg { display: none; }
}
`
