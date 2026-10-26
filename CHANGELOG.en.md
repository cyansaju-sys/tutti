# What is new

Each version has its own `## x.y.z` section with sentences written for people who use the app. Tutti shows them once, the first time it opens after updating. This file is the English version of CHANGELOG.md.

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
