# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.5.6

### Changes

- **What you left in each project is picked up again:** when you go back to a project, or open Tutti, its terminals come back, along with the active tab of the bottom panel (Terminal or Problems), its height and the terminal you were using. Open Claude and Codex chats come back too (their tabs and the latest messages), and your next message continues that conversation. It saves by itself whenever something changes.
- **History in the chat box:** with the box empty, **↑** and **↓** go through the messages you already sent in that conversation, like in a terminal; going all the way down brings back what you were typing.
- **"Send to agent" with the chat open:** if the chat is open, the file path (or the selected part of the editor) goes to its box instead of to a terminal agent.
- **Commit with more options:** the Git tab button now has an arrow with **Commit**, **Commit (amend last)**, **Commit and push** and **Commit and sync**. While an agent writes the commit message, a loading bar runs over the box.
- **Branch and sync in the footer:** the branch shows a `*` when there are uncommitted changes and, next to it, a button to sync (pull, push or check the remote) with the pending commits (`↓` and `↑`).
- **Problems panel:** it now also reports **syntax errors in open JSON files** (with their line), groups by file, has a **filter** (text, patterns like `**/*.ts` and `!` to exclude) and no longer counts unsaved changes as problems.
- **Bottom panel redesigned:** joined tabs, a terminal list on one side with an accent bar on the active one, and a trash button to close each.
- **Chat images:** they show as tags with a thumbnail, name and size, both when attaching them and in the sent message.
- **File menu:** "Rename" and "Delete" sit together, and the copy options form a single section.
- **Fix:** on narrow windows the editor no longer spills out of its column or covers the sidebar.

## 1.5.5

### Changes

- **Chat with Codex:** Tutti's chat now also talks to Codex (OpenAI), not just Claude. It uses the models and session of your Codex account and respects your commands, MCP servers and mentions ("@", "#"). With Codex, the Plan and Explorer modes only read; the others can write to the project.
- **Two chats at once:** the **Split chat in 2** button opens a second column, and each chat can run on Claude or on Codex. Each has its own conversation, permissions and questions.
- **Handing tasks between chats:** a chat can assign a task to the chat of the other agent (Claude ↔ Codex) and tells you when it finishes or fails.
- **Accounts:** a new **Accounts** section shows the email you are signed in with on Claude and on Codex.
- **`/init`:** creates an `AGENTS.md` for the repository (the standard both agents read) instead of a `CLAUDE.md`. With Codex you also get `/review` (reviews the uncommitted changes), `/new` and `/clear`.
- **Chat "+" menu:** upload a file from your computer, add context and browse the web.
- **Take the full width:** new editor setting. When on, opening a file splits the width into chat | editor; when off, the chat stays a small panel on the side.
- **Problems panel:** warns about unresolved merge conflicts and unsaved changes in the workspace.
- **Customizable shortcuts:** in the shortcuts view you can change any shortcut with a click (it warns if it is invalid, reserved or already used by another action) and go back to the default.
- **File menu in the title bar:** new window, open file or folder, open recent, save, save all, revert file, close editor, folder or window, and exit.
- **Create .tutti:** if the project has no `.tutti` or `.agents` folder, the Tutti tab offers to create it.

## 1.5.4

### Changes

- **Claude hands out tasks to other agents:** the chat connects to Tutti's MCP server, so Claude can assign work to OpenCode, Codex and the other open agents, and read their notices.
- **Your roles as subagents:** roles from `~/.agents/agents`, `~/.tutti/agents` and the project (if a name repeats, the project's wins) are available to Claude as subagents. Roles that ask for another agent are ignored. The roles list shows which one is working.
- **Subagent progress:** each one shows in its own block, with its tools, tokens and time, and its status (working, done, failed, stopped).
- **Claude's plan:** in Plan mode the plan is shown in full and you can **approve it**, **approve it and accept edits**, or **keep planning** with your changes.
- **Visible reasoning:** when the model supports it, the chat shows its summarized reasoning in a separate block.
- **`/btw` question:** a side question answered without interrupting or changing the conversation, even while Claude is working.
- **Suggested next message:** after each answer Claude proposes a message that shows as a placeholder in the box; **Tab** fills it in.
- **Tab** also picks the highlighted command or file in the "/", "#" and "@" lists.
- **Resume full conversations:** opening one from the history now also shows the reasoning, the tools with their results and what each subagent did, not just the text.
- **`/login` and `/logout` in the chat:** they open a terminal running `claude auth login` or `claude auth logout`, so you can sign in or out of Claude Code without leaving Tutti.
- **Copy code blocks:** hovering a code block (in the chat, plans, `/btw` and subagents) shows a button to copy it.

## 1.5.3

### Changes

- **Internal changes:** part of the code and the project structure was reorganized and simplified.

### Fixes

- The Claude chat finds commands and MCP servers (`npx`, anything installed with nvm or in the usual binary folders…) even when you open Tutti from the desktop launcher instead of a terminal. Before, they could fail to connect.

## 1.5.2

### Changes

- **Chat conversations as tabs:** each open conversation shows as a tab in the chat header, with its own X to close it, and **+** opens a new one. You cannot switch tabs while Claude is answering.
- **Resume Claude conversations:** clicking one in the history asks whether to open it in the Tutti chat (with what was said) or in the terminal.
- **What you ask from Tutti goes to the chat:** filling in AGENTS.md, creating hooks, specs or skills and applying a spec are sent to the chat, with the model, effort and mode you picked. The chat opens if it was closed.
- **The chat knows your project:** it reads its AGENTS.md and already knows the hook and spec formats, so those requests are shorter.

### Fixes

- The Tutti tab no longer rereads hooks, steering, skills, docs and specs from disk every 5 seconds: it reads them when it opens, when the chat finishes and when you come back to the window. AGENTS.md and the roadmap still update on their own.

## 1.5.1

### Fixes

- In the installed app, the Claude chat did not load models or "/" commands and could not send messages. It now works.


## 1.5.0

### Changes

- **Chat with Claude inside Tutti:** a panel next to the editor that uses your subscription, with no terminal needed. Live replies, per-tool permissions (with "Always"), questions with options, pasted or dropped images, and the conversation cost. Manual, Edit, Plan, Explorer and Auto modes, with model and effort to pick. It opens with the project, you can drag to widen it, and it remembers if you close it.
- **Mentions in the chat:** `@` searches files and folders; `#` brings in what your project has (specs, roles, roadmap, docs, hooks, steering, powers, files and git changes with their diff). What is added to the message shows under "Context sent to the AI".
- **Kiro-style specs instead of OpenSpec:** each spec is a `.tutti/specs/<name>` folder with `requirements.md`, `design.md` and `tasks.md`, and progress comes from its checkboxes.
- **More harnesses on the way:** more agents are being integrated into the chat, and Tutti will switch between their CLI and its own interface depending on what works best for each one.
- **AI usage through the SDK:** Claude plan limits and conversation titles come from the SDK.

### Fixes

- Powers that match what you ask for are offered on their own, without going through the MCP server. This only works in the built-in chat.
