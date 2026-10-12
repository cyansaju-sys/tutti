# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.2.2

- **Specs like Kiro's:** a guided form in an editor tab (feature or bug, requirements or design first, or **Quick**), with `bugfix.md` for bugs. You can ask the agent to write each phase waiting for your approval, and from the editor bar **analyze** the requirements, **update** the design and the tasks, and **run the tasks** (the next one or all).
- **Hooks:** JSON files in `.tutti/hooks` in Kiro's format. `PostFileSave` runs a command or types a prompt into the agent; the **+** offers a guided form or describing it to the agent, they are **edited** with the same form and only run if you allow hooks in that project.
- **Steering with Kiro's modes:** always, by files, manual or automatic, with `#[[file:path]]` references, the foundation files (`product`, `tech`, `structure`) and **global** steering for all your projects. `fileMatch` also counts the files open in the editor.
- **Skills and documentation:** a form to create a skill (name, when to use it and instructions), with the option to have the agent write them or to **import** one you already have; and the documentation overview that the agent fills in.
- **Tutti, in depth in the documentation:** the landing page and the documentation explain every part of the Tutti tab and of the `.tutti` folder, with new screenshots.
- **Landing page in Kiro's style:** a header with central links, quick guides, frequently asked questions and a footer in columns.

## 1.2.1

- **The `.tutti` folder in every project:** Tutti creates `.tutti/` with a `README.md` when you open a project; subfolders only appear when you add something. It is versioned with git and shared by the team.
- **Tutti tab:** shows and creates Kiro-style **specs** (`requirements.md` in EARS format, `design.md` and `tasks.md` with checkboxes and their progress), **documentation** following Diátaxis (tutorials, how-to guides, reference and explanation), **steering**, **hooks**, **skills** and the installed MCP servers. Shortcut `Ctrl+Shift+J`.
- **`.md` files are viewed as Markdown:** a *Preview / Source* button in the editor; those in `.tutti` open already rendered, with the task checkboxes and the steering header as tags.
- **A single context file per project:** the project's `AGENTS.md` if it already has one (edited right there, with no copies) or, if not, `.tutti/steering/contexto.md`.
- **What agents receive:** the Context panel shows where each part comes from and how many tokens it weighs. A steering file with `inclusion: always` in its header is handed to the agents; new ones start with `inclusion: manual`.
- **Explorer:** multiple selection (`Shift+↑/↓`, `Shift`+click, `Ctrl`+click), **drag to move** files and folders (with confirmation), renaming on the row itself, arrows to fold folders, a foldable project root and folders tinted when they hold new or modified files. The `.tutti` folder carries the Tutti logo.
- **Tidier MCP and Usage:** every section has its own scroll and a height you can adjust by dragging; lists follow the extensions panel style, “Available” only shows up when searching and the clear-history button stays fixed. The “tutti” card is hidden from the MCP list.
- **A title on every sidebar tab**, with the tabs reordered.

## 1.1.0

- **Cleaner quick open:** the quick-open dialog no longer lists hidden files and folders.

## 1.0.9

- **Send code to the agent:** select code in the editor and press `Ctrl+L` (or right click → *Send selection to agent*) to type the reference `@file:12-30` and the snippet into the active agent's prompt, without sending it; with no selection it sends the cursor's line. If the snippet is over 200 lines, only the reference goes. The editor's right-click menu also offers copy, cut, paste and select all.
- **The project context lives in the repository:** it is now stored in `AGENTS.md` inside the project folder, the standard file that Codex, OpenCode, Cursor and others also read, so it is versioned with git and shared with the team. It is not created until you write and save; if you already had an `AGENTS.md`, it opens as is. Contexts you had stored in Tutti's configuration keep being used until you save them in the project.
- **Global context:** a second tab with your preferences for **all** projects (how you work, your style, what you do not want agents to do). It is handed to every agent before the project's context.
- **The context is shown as Markdown:** headings, lists, code and links with formatting instead of plain text; press *Edit* (or double-click) to change it.
- **Codex usage and history:** the usage tab shows Codex's tokens for today, 7 days and total, the percentage of its limit (and when it resets) and the history of its sessions, which can be resumed, renamed or deleted. It is read from the local records in `~/.codex`, without connecting to anything.
- **Discard changes in Git:** an ↶ button on each file under *changes* (and another in the section header) undoes unstaged changes, asking for confirmation. New files go to the trash, so they can be recovered; staged work is left alone.
- **Agent changes to an open file:** if an agent modifies a file you have open, Tutti detects it and marks the old lines (red) and the new ones (green) in the editor. You can accept or undo each chunk, or all at once; what you accept stays as a local modification for you to review and save. While you decide, the file is read-only.
- **More languages in the editor:** highlighting for Rust, Go, Java, C/C++, PHP, shell, YAML and TOML.
- **A more polished editor:** Material icons in the autocomplete suggestions and in code folding, indentation guides and zoom with `Ctrl` + wheel (or `Ctrl` + `+` / `-`).
- **Icons in “Open file”:** the quick picker shows the same icon for each file as the tree.

## 1.0.8

- **Codex now connects to task delegation:** when opened from Tutti it sees `list_agents`, `delegate_task`, `wait_agent` and `read_agent_output`, without touching its `config.toml`.
- **Tutti's MCP, in plain sight:** the MCP tab has a global “tutti” card showing which agents it applies to and warning if Antigravity's one points to a path that no longer exists (it is repaired when Tutti opens).
- **Spanish and English:** the gear menu has a *Language* submenu (Automatic, Spanish, English). It switches the whole interface instantly and is remembered on reopening.
- **MCP server store:** in the MCP tab you can search the official registry, see a server's page (what it is, who publishes it and the exact command) and install it in your agents. The best-known ones come first, under *Recommended*.
- **One server, one card:** installed MCP servers are no longer split by agent; opening a card shows which ones it is applied to, and you can remove it from one or from all. Sections can be collapsed.
- **Copy and paste in terminals and agents:** `Ctrl+C` (with text selected), `Ctrl+V`, `Ctrl+Shift+V` and `Shift+Insert`, plus a right-click menu. Clipboard images still reach Claude Code.
- **Softer light theme:** no pure white, so it is easier on the eyes.
- **Better menus:** submenus open on hover, with the current value, separators and no gaps; the highlight in the file tree follows the mouse and the menu key opens the menu of the marked row.
- **Opens where you look:** the window appears on the monitor where the cursor is.

## 1.0.7

- **Orches is now called Tutti.** Your settings and project context are kept. If you installed it with the script, run it again so the command becomes `tutti`; otherwise the app updates itself.
- **Search in the project (Ctrl+Shift+F):** like in VS Code: match case, whole word and regular expressions, with include and exclude file filters. Results are grouped by file and clicking one opens it at that line. It respects .gitignore.
- **Find and replace:** `Ctrl+Shift+H` adds the replace field across the whole project (per file or all at once; files with unsaved changes are skipped) and `Ctrl+H` opens replace inside the open file. The editor's find box is new: floating, smaller and translated.
- **New empty window:** a button in the title bar and an option in the launcher menu to open another Tutti window with no project, with its own agents.
- **Antigravity now connects to task delegation:** it used to open without Tutti's tools. Now, when opened from Tutti, it sees `list_agents`, `delegate_task`, `wait_agent` and `read_agent_output`. Tutti registers a “tutti” server in Antigravity's MCP configuration (`~/.gemini/config/mcp_config.json`); outside Tutti that server offers no tools.
- **Light and dark theme:** the gear at the bottom of the sidebar opens a menu to choose *Dark theme*, *Light theme* or *Automatic* (follows the system). The editor, code colors and terminals change too, and it is remembered on reopening.
- **New icon:** three overlapping circles, in the app's colors. The agents' start screen uses the same style.

## 1.0.6

- **A fuller explorer:** the tree header has buttons for new file, new folder, refresh, collapse all and open another project. You can also create at the root by clicking an empty space.
- **Name inside the tree:** when creating a file or folder, the name is typed in the tree itself, like in VS Code (Enter creates, Esc cancels).
- **Each project remembers its own:** when you return to a project, the sidebar tab and the files you had open are restored. Switching project closes agents, terminals and files, and asks first if there are unsaved changes.
- **A single Git button:** with a message it does Commit; afterwards it becomes Push, or Pull if the remote has new changes, with a progress animation. Without a remote repository it only offers commit.
- **New branch picker:** VS Code style, with the date and last commit of each branch. It lets you create a branch, create it from another one, and check out detached to go to a branch or commit without creating a branch.
- **Newly created repositories:** Git now works in a repository with no commits at all.
- **Custom tooltips** that show the keyboard shortcut as a key.
- **Cleaner text fields:** no border or focus highlight, looking the same across the whole app.

## 1.0.4

- **Project context:** new section in the sidebar (Ctrl+Shift+K). What you write there is read by the agents you open in that project (Claude Code and OpenCode). It is stored outside the repository.
- **Generate with AI:** a button writes the context from a small summary of the project, using very few tokens. If you switch sections meanwhile, it is cancelled.
- **Recent projects:** when no agents are open you will see the project history to go back to them with one click, open another or remove one with the X.
- **Collapsible sidebar:** when hidden only the icons remain; double-clicking an icon hides or shows it.
- **Files without agents:** if there are no agents, the file you open takes all the space.
- **Version in sight:** the version number appears next to the app name.
- **Centered dialogs** in the window.
