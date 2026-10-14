# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.3.2

### Functional

- **Remote MCP servers over SSE:** when adding or editing a remote you pick HTTP or SSE, and registry entries bring their own. Claude Code, Gemini CLI and Qwen Code install them with that transport (before, all went as HTTP and SSE ones did not connect). Codex, which only speaks HTTP, warns instead of installing it wrong.
- **“Test” behaves like the agent:** it starts local servers from the project folder, expands `${VARIABLE}` and `${VARIABLE:-value}` like `.mcp.json`, tests SSE servers and, if a server asks you to sign in (OAuth), tells you so instead of failing.
- **Codex MCPs are read in full:** a `config.toml` with `env = { ... }`, multi-line lists or comments no longer shows as “different” when syncing.
- **Editing a `.mcp.json` server** changes it in place: it is no longer removed and added back, and Antigravity and Codex do not lose it in between.
- **Copying a Gemini CLI or Antigravity remote to another agent** keeps its URL.
- **Windows:** adding and removing MCPs works with CLIs installed through npm (`claude.cmd`, `gemini.cmd`…).
- **Keys of disabled MCPs, encrypted:** their variables and headers are stored with the system keyring, not in plain text in the settings. If they cannot be decrypted (on another computer, for example), Tutti does not half-enable it: it asks you to edit it and type them again.
- **Safer configuration files:** Tutti writes each agent’s files in one go, so an agent or another window never reads a half-written one. It keeps their permissions and, if the file is a link, writes to the original.
- **The MCP list and sync load faster:** each configuration file is read only once.
- **MCP messages show in your language** (some were always in Spanish before).

## 1.3.1

### Functional

- **`.mcp.json`, the single source of project MCPs:** adding or editing a project server only touches `.mcp.json`. OpenCode gets it when opened from Tutti, and Gemini CLI, Qwen Code and Cursor Agent catch up with “Add what is missing”.
- **Project MCPs for Antigravity and Codex:** they follow `.mcp.json` on their own. Antigravity through a plugin in `.tutti/plugins/` (declared in `.agents/plugins.json`); Codex through the project’s `.codex/config.toml`, if the project is trusted. Their local servers start with `.tutti/mcp/launch.mjs`, which reads `.mcp.json` every time: changing a server does not touch their files.
- **Remove MCP servers:** a bin in the list and “Remove” in its card, with confirmation. If it is in `.mcp.json`, Antigravity and Codex lose it along with it.
- **Codex opens from Tutti again:** if its configuration had a copy of Antigravity’s “tutti” server (error “url is not supported for stdio”), Tutti removes it when opening it.
- **The app’s “tutti” server** is no longer copied between agents when syncing and no longer shows in the MCP list.
- **A newly opened agent’s cursor blinks:** the terminal gets keyboard focus as soon as it is created. Before, what you typed sometimes went to the editor or to the bottom terminal.

### Aesthetic

- **A single MCP list:** what each server is missing in other agents shows under its name, and “Add what is missing” and the other actions sit at the end of the list.
- **Clearer server card:** if it is in `.mcp.json`, it shows a single source and how each agent gets it, as chips in a row with their state and actions.

## 1.3.0

### Functional

- **AGENTS.md from Tutti:** the Tutti tab can create, update and remove the project's `AGENTS.md`, and agents get its context together with `.tutti`.
- **MCPs synced across agents:** test, edit and sync your MCP servers between agents, or standardize them so all use the same configuration.
- **New agents:** Cursor and Qwen join MCP management.
