# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

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
