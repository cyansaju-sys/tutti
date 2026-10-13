# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

## 1.3.0

### Functional

- **AGENTS.md from Tutti:** the Tutti tab can create, update and remove the project's `AGENTS.md`, and agents get its context together with `.tutti`.
- **MCPs synced across agents:** test, edit and sync your MCP servers between agents, or standardize them so all use the same configuration.
- **New agents:** Cursor and Qwen join MCP management.

## 1.2.4

### Functional

- **Specs with OpenSpec:** the Specs section of the Tutti tab now uses [OpenSpec](https://openspec.dev) instead of Kiro's flow. With its CLI, it starts `openspec/` in the project and shows the configuration, the changes in progress with their progress and the current specs. Each change is proposed with a form (with templates or written by the agent) and can be implemented with the agent, validated and archived. If you do not have the CLI, Tutti gives you the install command.
- **Hooks are clearer to authorize:** the fixed notice is gone; when you press a hook's switch in an unauthorized project, Tutti asks you to allow hooks. Until they are allowed, their switches look off.
- **No more repeated requests to the agent:** when asking an agent for something from the Tutti tab, it no longer received the same request several times. Agents that receive the task at launch are not sent it again, and the others are sent it at most twice.
- **Fewer notices:** we removed the ones that only confirmed something obvious (sent to the agent, saved, copied, added…). Errors and important results stay.

### Aesthetic

- **Cleaner MCP section in Tutti:** without the “Installed” title and with the same maximum height and scroll as the store.

## 1.2.3

### Functional

- **Copy, cut and paste in the explorer:** in the file and folder menu (and with `Ctrl+C`, `Ctrl+X` and `Ctrl+V`). When copying, if the name already exists it creates "name (2)" without overwriting anything; when cutting, open tabs follow their files.
- **Context with AGENTS.md:** if the project has `AGENTS.md` and `.tutti`, agents also get a note telling them to check `.tutti` (steering, specs, skills and hooks).
- **Sidebar:** clicking the icon of the open tab hides the section, and clicking it again shows it. The tabs are reordered: Files, Tutti, Agents, Context, Search, Git, MCP and Usage.
- **Scroll per subsection in Tutti:** Documentation, Specs, Hooks, Steering and Skills get their own scroll once they pass 5 items.
- **Height adjustable from the divider line:** in MCP and Usage, drag the line under a section to change its height (double-click: back to automatic).

### Aesthetic

- **Hooks with an icon** by action (command or agent), and without the "allowed" notice once authorized.
- **Sections separated by a line** in Tutti and MCP, with fixed height on their headers and rows.
- **No "Installed" title** in the MCP section of Tutti, with the same maximum height and scroll as the store.
- **Divider lines** between the items of the MCP store and the session history.
- **Sidebar icons:** the hover and active-tab box is smaller, and the settings icon is outlined.

## 1.2.2

- **Improvement request addressed — documentation under a methodology:** the `.tutti/docs` folder follows **Diátaxis** (tutorials, how-to guides, reference and explanation) and extends what was already there with the **project's general information**: the overview (`overview.md`, which the agent can fill in) and the foundation steering files (`product.md`, `tech.md` and `structure.md`). Read more: https://cyansaju-sys.github.io/tutti/documentacion.html
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
