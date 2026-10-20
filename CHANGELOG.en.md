# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.3.8

### Security

- **Electron 44:** Tutti moves from Electron 33 to 44 and picks up more than 30 Electron and Chromium security fixes, including flaws that let a page get around the isolation from the system or around the iframe sandbox.
- **No known vulnerabilities in the dependencies:** the tools the app is built with (Vite 8, electron-builder 26, Vitest 4) were also updated, as they had critical alerts.


## 1.3.7

### Functional

- **Review each role before accepting it:** when a role finishes it stays **in review**. From the Role plan (or the leader) you **accept** it, and the roles that depend on it start, or you **reject** it with what must be fixed: its agent carries on with its context and reports back. If its agent has already closed, the role is relaunched with another one, carrying your feedback.
- **Automatic check per role:** you can give each role a command (for example `npm test -- api`) that Tutti runs when it finishes. If it fails, the output goes back to the agent so it can fix it. Tutti also warns if a role touched files that are not its own.
- **Blocked or failed roles in plain sight:** the plan marks roles that got blocked, failed or whose agent closed, and you can **relaunch** or **cancel** them. You can also **pause handing out** (running roles go on) and resume it.
- **See the whole plan:** **View the plan** shows the **dependencies** between roles and a **timeline** of each one's progress.
- **Reusable roles and plan templates:** save a role (for example "tests" or "reviewer") to use in any plan and project, or save a whole plan as a template. One comes built in, **Implement → tests → review**. When you create a plan from a template you write what needs doing and every role reads it. With **+** you add roles to the plan (blank or reusable) and remove them whenever you like.
- **Agents can ask instead of guessing:** an agent with a delegated task can ask the leader without marking it done, and carries on as soon as it gets the answer. When it finishes, it leaves a summary of what it did and the files it changed, which the leader reviews without reading its screen.
- **Shared notes:** agents leave in `.tutti/notes.md` the decisions that affect the others (names, API contracts, conventions) and read them before working.
- **Notices that do not interrupt you:** Tutti's notices for an agent wait until it is free and you stop typing in its panel, and arrive together. If an agent is waiting for your permission or an answer, Tutti tells you.
- **Choose the leader:** from an agent's header you make it the **leader**: it hands out tasks, gets the notices and runs the role plan. Each panel also shows the role it is working on.
- **Assignment that learns:** on automatic, Tutti remembers which agent and model finished well or failed at each difficulty and avoids the ones that tend to fail.

## 1.3.6

### Functional

- **Open projects from the terminal:** `tutti .` opens the current folder as the project and `tutti ~/path/to/project` opens that one, like `code .` in VS Code. With a file (`tutti src/main.ts`) it opens its git repository (or its folder, if it is not in one) and the file comes up front in the editor. The folder becomes the last project and goes into the recent ones; if you had opened it before, its tab and files come back. `tutti` on its own still opens the last project.
- **The `tutti` command no longer holds the terminal:** the app opens on its own and you can keep using the terminal. If the path you give it does not exist, it tells you and opens nothing.
- **The `tutti` command on Windows too:** the installer adds it to your user's `PATH` (terminals you open after installing see it) and removes it when uninstalling.
- **On Linux the command creates itself:** if you downloaded the AppImage by hand, the first time you open it creates `~/.local/bin/tutti`, and keeps it up to date if you move the AppImage. If you already have your own `tutti` at that path, it leaves it alone.
- **`Ctrl+Q` closes the application**, just like the ✕ button in the title bar. It is in the shortcuts list (`F1`).

## 1.3.5

### Functional

- **Roles for big tasks:** an agent can now prepare a plan, review it and split it into **roles**, each with its responsibility, deliverables, definition of done and the files only it edits. **You choose each role's agent and model** (the plan cannot be approved until every role has an agent). If you would rather Tutti assign them according to difficulty, each model's capability and usage limits, set `"roles_assignment": "auto"` in `settings.json`. An agent does one role at a time: if the chosen one is busy, the role waits (on automatic it goes to another, opening a new one if needed). Roles that depend on others start when those finish, and the leader is notified as each one ends and when all are done.
- **You approve the plan before it is handed out:** the leader leaves it reviewed and the **Explorer**, under the file tree, shows the **Role plan** (collapsible, like the project root) with each role, its agent and its model, and the **Approve and start** button. While you wait, the leader cannot hand out other tasks. You can also **discard the plan**, and if you close the app with an approved plan, **Start handing out** appears when you come back to resume it. If a role does not start, the panel says why. If you would rather it be handed out without asking, set `"roles_approval": false` in `settings.json`. The plan is saved in `.tutti/roles.json`.
- **Edit roles and pick their agent and model by hand:** click a role of the plan that has not started to change its name, responsibility, deliverables, definition of done, files, difficulty and dependencies, and to assign it an agent (open or installed) and one of the models it offers. What you pick by hand is respected: if that agent is busy, the role waits instead of going to another. On automatic, Tutti still chooses.
- **Delegated tasks show which role they come from.**

## 1.3.4

### Funcional

- **You can type to the agent again after closing an unsaved file:** *Bug:* when closing a file with unsaved changes (or switching project, replacing across the project or replacing the context), the warning was the system `window.confirm`. On Linux, once that dialog closed, Chromium’s focus was left half-done: the terminal lost its blinking cursor and did not receive Space or text typed with composition. *Fix:* the warning is now a Tutti dialog (`confirmAsk`, in `shared/lib/confirm.ts`). “Cancel” is focused so a stray Enter or Space does not discard anything, and when you answer, focus returns to the element that had it (the terminal or the editor).

## 1.3.3

### Functional

- **The keyboard goes to the agent you pick:** after closing a file or a panel, clicking an agent’s header, jumping to it from the delegated tasks or sending it something from the Tutti tab, the tree or the editor, you can keep typing without clicking its terminal (if you close a file and others remain, focus goes to the editor). Before, focus was lost and you could not type.

## 1.3.2

### Functional

- **Project roadmap:** the Tutti tab has a new section with the plan in phases (`.tutti/roadmap.md` or the `ROADMAP.md` you already have at the root). Each phase shows its progress, the current one is open and the **next** item is marked; each item is matched with its OpenSpec change (done, in progress with its tasks, no spec yet or unverified). **Where did we leave off?** asks the agent to review the roadmap, the tasks and git, check in the code what is done and propose the next steps without touching anything. From an item you create its spec with the form already filled in, archiving a change ticks its box, and if you have no roadmap yet you create it from a template or let the agent draft it.
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
- **Each agent’s real models when sharing out tasks:** for Claude Code, Codex, Gemini CLI, Qwen Code and Copilot CLI, Tutti reads the list from their `/model` (it opens it out of sight, in the project folder, and leaves without picking anything) instead of a fixed list that went out of date. It is kept for a day. If the agent asks to trust the folder or to sign in, Tutti does not answer for you and uses the fixed list.

### Aesthetic

- **New logo:** the app icon, the Tutti tab icon, the `.tutti` folder icon and the one shown when no agents are open. The interface accent takes the logo’s blue; the dark backgrounds stay the same.

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
