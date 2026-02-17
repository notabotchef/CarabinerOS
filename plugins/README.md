# Agent Zero Plugins

This directory contains default plugins shipped with Agent Zero.

## Architecture

Agent Zero uses a convention-over-configuration plugin model:

- Runtime capabilities are discovered from directory structure.
- Backend owns discovery, routing, and static asset serving.
- Frontend uses explicit `x-extension` breakpoints plus the standard `x-component` loader.

## Directory Conventions

Each plugin lives in `plugins/<plugin_id>/` (or `usr/plugins/<plugin_id>/` for overrides).

Capability discovery is based on these paths:

- `api/*.py` - API handlers (`ApiHandler` subclasses), exposed under `/api/plugins/<plugin_id>/<handler>`
- `tools/*.py` - agent tools (`Tool` subclasses)
- `helpers/*.py` - shared Python helpers
- `extensions/python/<extension_point>/*.py` - backend lifecycle extensions
- `extensions/webui/<extension_point>/*` - WebUI extension assets (HTML/JS)
- `webui/**` - full plugin-owned UI pages/components (loaded directly by path)
- `prompts/**/*.md` - prompt templates
- `agents/` - agent profiles

## Frontend Extensions

### HTML insertion via breakpoints

Core UI defines insertion points like:

```html
<x-extension id="sidebar-quick-actions-main-start"></x-extension>
```

Current sidebar surfaces:

- `sidebar-start`
- `sidebar-end`
- `sidebar-top-wrapper-start`
- `sidebar-top-wrapper-end`
- `sidebar-quick-actions-main-start`
- `sidebar-quick-actions-main-end`
- `sidebar-quick-actions-dropdown-start`
- `sidebar-quick-actions-dropdown-end`
- `sidebar-chats-list-start`
- `sidebar-chats-list-end`
- `sidebar-tasks-list-start`
- `sidebar-tasks-list-end`
- `sidebar-bottom-wrapper-start`
- `sidebar-bottom-wrapper-end`

Current input surfaces:

- `chat-input-start`
- `chat-input-end`
- `chat-input-progress-start`
- `chat-input-progress-end`
- `chat-input-box-start`
- `chat-input-box-end`
- `chat-input-bottom-actions-start`
- `chat-input-bottom-actions-end`

Current chat surfaces:

- `chat-top-start`
- `chat-top-end`

Current welcome surfaces:

- `welcome-screen-start`
- `welcome-screen-end`

Current modal surfaces:

- `modal-shell-start`
- `modal-shell-end`

Placement pattern:
- keep wrapper-level anchors in parent composition files
- keep section anchors in their owning component files, inside local `x-data` scope

Resolution flow:

1. `webui/js/extensions.js` finds `x-extension` nodes.
2. It calls `/api/load_webui_extensions` with the extension point and HTML filters.
3. Backend returns matching files from `plugins/*/extensions/webui/<extension_point>/`.
4. `extensions.js` injects returned entries as `<x-component path="...">`.
5. `components.js` loads each component using the standard component pipeline.

Baseline extension template (project convention):

```html
<div x-data>
  <button
    x-move-after=".config-button#dashboard"
    class="config-button"
    id="my-plugin-button"
    @click="openModal('../plugins/my-plugin/webui/my-modal.html')"
    title="My Plugin">
    <span class="material-symbols-outlined">extension</span>
  </button>
</div>
```

Required baseline for HTML UI extensions in this repository:
- include a root `x-data` scope
- include one explicit `x-move-*` placement directive

### JS hook extensions

JS hooks are loaded from the same extension point structure:

`plugins/<plugin_id>/extensions/webui/<extension_point>/*.js`

Runtime code calls:

`callJsExtensions("<extension_point>", ...args)`

JS hook convention:
- pass one mutable context object when extensions are expected to influence behavior
- that object is passed by reference, so mutations are visible to subsequent hooks in the same flow

Example:

`set_messages_before_loop` and `set_messages_after_loop` in `webui/js/messages.js`.

### Fine placement helpers

`initFw.js` provides Alpine move directives for plugin markup:

- `x-move-to-start`
- `x-move-to-end`
- `x-move-to`
- `x-move-before`
- `x-move-after`

Placement behavior:
- `x-move-to-start`, `x-move-to-end`, and `x-move-to` resolve a parent selector and insert the extension element as that parent's child.
- `x-move-before` and `x-move-after` resolve a reference selector and insert the extension element as a sibling in the reference element's parent.
- This structural difference can produce different visual results when parent and sibling styling differ (for example dropdown spacing/padding).
- Example anchor selector for placing after the first dropdown item: `x-move-after=".quick-actions-dropdown .dropdown-header + .dropdown-item"`.

## Plugin Author Flow

1. Pick an existing core breakpoint ID (`<x-extension id="...">`).
2. Add an HTML/JS extension under `extensions/webui/<extension_point>/`.
3. For HTML UI entries, use the baseline pattern: root `x-data` plus one explicit `x-move-*` directive.
4. Put complete plugin pages/components in `webui/` and open them directly by path.

## Routes

- Plugin static assets: `GET /plugins/<plugin_id>/<path>`
- Plugin APIs: `POST /api/plugins/<plugin_id>/<handler>`
- WebUI extension discovery: `POST /api/load_webui_extensions`

## Notes

- User plugins in `usr/plugins/` override repo plugins by plugin ID.
- Runtime behavior is fully convention-driven from directory structure.
