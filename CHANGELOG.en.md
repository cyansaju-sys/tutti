# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

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
