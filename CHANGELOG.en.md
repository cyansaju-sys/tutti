# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.4.11

### Changes

- **Roles that distribute themselves:** the **Run roles** button launches every role with a shared goal, each with its own agent and model, in dependency order. Each agent's tab shows which role it carries and whether it is working or waiting.
- **Agents assign roles through MCP:** they distribute work with Tutti's tools and no longer read the role files.
- **Editor settings:** new searchable dialog for font, word wrap, line numbers, auto save and more.
- **Image viewer** in the editor and improvements to the Markdown preview.

## 1.4.10

### Changes

- **Themes in one place:** Settings → Themes gathers the color theme, the icon variant and the system color, with a preview as you move through the options.
- **Project name in the title bar,** centered in the window.
- **Commit graph side by side:** with enough room, the history sits on the left and the commit detail on the right.
- **Kiro usage:** the usage panel shows the credits Kiro spent today, in 7 days and in total. Kiro is now recognized as an agent (`kiro-cli`) and has its logo.

## 1.4.9

### Changes

- **Opening or switching project reloads the window:** as in VSCode, the window restarts before switching and the new project starts clean, with no intermediate screens.
- **Each project remembers its terminals:** the terminals you left open are opened again (new ones, up to 5) when you return to it.

## 1.4.8

### Changes

- **Resolve merge conflicts from the editor:** opening a file with conflicts marks each one and lets you keep the current version, the incoming one or both; the file is saved after each choice. In Git, files with conflicts (C) open directly and a notice lets you cancel the operation (merge, cherry-pick or revert).
- **Conflicts are no longer undone on their own:** when merging or cherry-picking with conflicts, they are left in the files for you to resolve instead of aborting the operation.
- **Sub-agents open side by side:** when a task is delegated, the delegating agent stays on one side and the sub-agent appears on the other, splitting the view.
- **Cleaner agent tabs:** the tab title is just the agent name, in slightly smaller text with a continuous bottom line.
- **Side preview:** a new option shows a document's preview next to the editor.
- **Faster usage:** the usage tab reads histories skipping what it does not need and queries Claude's limits in the meantime.
- **Documentation screenshots updated.**

## 1.4.7

### Changes

- **Opening a project no longer creates `.tutti`:** the folder appears when you add the first item (a skill, a steering file, a hook, the roadmap…). If the project uses `.agents` and has no `.tutti`, everything is saved in `.agents`, as before.
- **Tidier start screen:** the project list shows one line per project (name and path) and, with more than five, a **Show more** button for the rest. The shortcuts move below the list and the logo is centered.
- **MCP servers at full height:** in the Tutti tab, the MCP servers section uses the available height instead of being cut at a fixed one.
- **The window and the sidebar adapt to the available space:** the window opens at up to 90% of your screen and can shrink down to 560 × 400 px, so it fits in half the screen next to another window. The sidebar width you chose is kept while it fits; in a narrow window it never goes over 40% of its width (minimum 180 px).

## 1.4.6

### Changes

- **New Power structure:** a Power is now described by a `plugin.json` (`name`, `description` and `keywords`) and can bring `mcp.json`, `steering/`, `skills/` and `hooks/`, all optional. `POWER.md` becomes an optional guide, with no header, which `use_power` hands to agents. **Create from what I have** writes the `plugin.json` and a `POWER.md` with the title and description. Earlier Powers (header in `POWER.md`, no `plugin.json`) are still read as before. An unreadable `plugin.json` or a broken `mcp.json` leaves the Power in red with the reason.
- **What is new opens as an editor tab:** after updating, or when you click the version in the footer, the news appears as one more tab next to your files instead of a pop-up window, and closes like any other.
- **Agents look for the Power that fits your request:** on receiving a request, the agent calls `list_powers` with it, and Powers that match (by keywords, name and description) come first, marked. If one fits it loads it with `use_power`; if there are no Powers or none fits, it carries on without loading any. Before, this guidance only applied when splitting up big tasks.
- **The sidebar width is remembered:** the width you pick by dragging the sidebar's edge is saved in the global settings and applied to all your projects and when you reopen the app.

## 1.4.5

### Changes

- **Projects with `.agents`:** if the project already uses `.agents` and has no `.tutti`, Tutti does not create `.tutti` when opening it: the Tutti section points to `.agents` and stores steering, hooks, skills and the rest there, without adding a README.

## 1.4.4

### Functional

- **Worktrees from the branch picker:** the branch picker now has **Worktrees…**. It lists the repository's worktrees (marking the one you have open, the main one, locked ones and those whose folder is gone), opens one as a project, creates a new one for an existing or new branch, and removes the ones you no longer need (with a warning if they have unsaved changes). They are created next to the repository, in `<repo>.worktrees/<branch>`, so the project stays clean. **New worktree with an agent…** creates it and opens an agent of your choice inside it, without switching project.
- **Heads-up when an agent waits for your permission:** if an agent stops asking for authorization or an answer, its tab is marked and you get a notice (in the app, or a system one if Tutti is in the background; clicking it takes you to its panel). It does not notify if you are already looking at it, nor repeat for the same question. It recognizes more ways of asking: trusting the folder, applying changes and Enter/Esc confirmations.
- **Who changed each line:** the editor shows, at the end of the cursor's line, the author, when and the commit subject (`You, 2 days ago • fix…`), or “Uncommitted changes” if it is not in a commit yet.
- **Nicer JSON:** keys are shown in blue and autocompletion offers the word you type in quotes, plus the keys the file already uses.
- **Quick open starts with your recent files:** with an empty box it shows the last files you opened in the project (the ones that still exist); typing searches all of them.
- **Local branches first:** in the branch picker, local branches come before remote ones.
- **Project permissions in `.tutti`:** the `.tutti` folder now includes `settings.json` with the project's permissions.

### Changes

- **The chat with agents is removed:** the chat panel in the title bar (with `/` and `#`) is gone; you talk to agents in their panels, as usual.

## 1.4.3

### Functional

- **Choose which terminal opens:** the settings menu (the gear in the sidebar) now has **Terminal…**, where you enter the path of an executable (for example, Git's `bash.exe` on Windows). If the path does not exist you get a warning and nothing is saved; leaving it empty goes back to the system terminal, and if the file disappears later the system one is used too.

### Thanks

- **davidenriquehm98** proposed choosing the terminal from the settings (PR #1).

## 1.4.2

### Functional

- **Creating a Power no longer touches your `.mcp.json`:** MCP servers are copied into the Power just like steering, skills and hooks, and the originals stay where they were (also in the Antigravity and Codex mirror). Variables and headers are saved empty unless you tick the option to save values. The note saying MCP servers were being moved is gone.
- **The file explorer follows the keyboard:** when you move with ↑↓ the marked row scrolls into view instead of leaving the panel.
- **Root menu in the gap below the tree:** right-clicking the empty space under the files opens the project folder menu.

## 1.4.1

### Functional

- **Powers, bundles of tools and guides:** a new tab in the sidebar (plug icon, `Ctrl+Shift+X`) gathers your Powers. A Power is a folder with a `POWER.md` that can bring MCP servers (`mcp.json`), steering, skills and hooks, and it replaces the old MCP server store. You install them with the **+** button from a folder, in the project (`.tutti/powers`, shared with git) or for all your projects, and remove them with the trash can. If a Power is not valid, it shows in red with the reason.
- **Create a Power from what you already have:** the **Create from what I have** option lets you pick, with checkboxes, your MCP servers, steering, skills and hooks, and bundles them with a name, description and keywords. Steering, skills, hooks and MCP servers are copied. Variables and headers are saved empty unless you ask otherwise, because they often hold tokens.
- **Agents load Powers only when needed:** Tutti's MCP server offers `list_powers` (one line per Power) and `use_power`, which hands over the guide, the steering and skill files and the tools of its MCP servers. That way an installed Power takes almost no context until the task needs it.

## 1.4.0

### Functional

- **Chat with your agents, without opening a terminal:** the chat icon in the title bar opens a panel on the opposite side of the sidebar. You pick an agent (Claude Code, OpenCode, Gemini CLI, Codex or agy) and talk to it; the answer is written as it arrives. It is for conversation only: it does not edit files (enforced for Claude and Codex). The conversation is kept per project and comes back when you reopen it, and with Claude or Gemini you can choose the model.
- **`/` in the chat:** typing it lists the agent commands you keep as files (your project's and your own) and Tutti's: `/review` and `/security-review` review your changes, `/explain` explains a part of the project, `/help` lists them and `/clear` clears the conversation.
- **`#` in the chat, to cite what matters:** you first choose **File**, **Folder** or **Other**. You can cite a file or a folder of the project, what you have uncommitted, a commit, your branch's changes, the open file or what you selected in the editor (even if unsaved), an OpenSpec change, the roadmap, a `.tutti` guide, skill or document, the agents' context, the hooks or the latest output of a terminal. What you cite is attached to the message, and the follow-up questions keep it.
- **You see what you are about to send and what it costs:** each `#` shows as a tag with its approximate size in tokens, and turns red if it is cut or cannot be attached. A line under the conversation shows its weight and, with Claude, what the last answer used and its cost. Files holding secrets (`.env`, keys, credentials) are never attached.
- **The `#` menu is more comfortable:** it finds things even if you do not type the name in a row, puts open and changed files first, and scrolls. Every answer can be copied and shows the project files it mentions, to open them in one click.
- **Proposing a spec change is a text box:** instead of the form, you write what you want and send it to the agent with the paper-plane button. It creates the proposal, specs, design and tasks in `openspec/changes`, and writes no code until you ask.
- **Agent instructions, in Tutti:** the **Agent instructions** section (AGENTS.md) can be collapsed and now lets you **generate the project context with an agent** and see how many tokens each agent will receive when it starts, file by file. It replaces the Context tab, which goes away; the context is the project's only.
- **Move the sidebar and its icons:** from the settings you switch the sidebar to the right or the left (its icons go with it), and you drag the icons to order them as you like. It is remembered.
- **Discarding a new file no longer fails on an external drive:** when there is no trash, the file is deleted and the notice says so.

### Aesthetic

- **A window footer:** at the bottom, on the left, the branch and the commits; on the right, the version (click it to see what is new). They leave the title bar.
- **The MCP section, only in Tutti:** the sidebar tab goes away; MCP servers are managed from the Tutti tab.

### Removed

- **The MCP server store:** you no longer search the registry or install servers from there, because it is going to be replaced by something like Kiro's Powers. In the meantime you can still add your own with the **+** button.
