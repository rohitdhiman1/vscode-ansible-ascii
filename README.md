# Ansible ASCII Visualiser

[![Version](https://img.shields.io/visual-studio-marketplace/v/rohitdhiman.ansible-ascii-visualiser?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=rohitdhiman.ansible-ascii-visualiser)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/rohitdhiman.ansible-ascii-visualiser?color=green)](https://marketplace.visualstudio.com/items?itemName=rohitdhiman.ansible-ascii-visualiser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen)](https://www.npmjs.com/package/ansible-ascii-visualiser)
[![No Dependencies](https://img.shields.io/badge/runtime%20deps-1%20(yaml)-brightgreen)]()
[![Offline](https://img.shields.io/badge/network-offline%20only-blue)]()

Stop burning AI tokens asking ChatGPT to "turn my playbook into a flowchart." This extension does it in one click — instantly, offline, and for free.

A VS Code extension that renders Ansible YAML playbooks as ASCII flowchart diagrams — right inside your editor. No API keys, no waiting, no copy-pasting YAML into a chat window.

## What it does

Open any Ansible playbook or task file and get an instant ASCII flowchart showing plays, tasks, blocks, roles, handlers, and their relationships.

```
+---------------------------------+
|        ▶ Play: (unnamed)        |
| hosts: webservers | become: yes |
+---------------+-----------------+
                |
                v
     +----------------------+
     |        tasks         |
     +----------+-----------+
                |
                v
     +----------------------+
     |    Install nginx     |
     |        [apt]         |
     |     name: nginx      |
     +----------+-----------+
                |
                v
  +--------------------------------+
  |            [block]             |
  |                                |
  | ├─ Deploy app [copy]           |
  | │  app.tar.gz → /opt/app/      |
  | │                              |
  | └─ Run migrations [shell]      |
  |    cd /opt/app && ./migrate.sh |
  +---------------+----------------+
                  |
                  v
    +----------------------------+
    |          handlers          |
    |                            |
    | └─ Restart nginx [service] |
    +-------------+--------------+
```

## Features

- **Flowchart boxes** with centered text and vertical connectors
- **Smart task names** — unnamed tasks show their operation instead of "(unnamed)"
- **Operation details** — module args, source/dest paths, shell commands displayed inside each box
- **Block rendering** — `block/rescue/always` shown as a single box with an inline tree
- **Roles and handlers** — compact single-box view with tree listing
- **Sensitive arg masking** — passwords, tokens, and secrets display as `****`
- **FQCN shortening** — `community.postgresql.postgresql_db` renders as `postgresql_db`
- **Conditional display** — `when`, `loop`, `register`, `delegate_to`, `notify` shown inline
- **Multi-play support** — plays separated visually with center-aligned connectors
- **Summary footer** — task, handler, role, and variable counts

## Usage

1. Open an Ansible YAML file (`.yml` / `.yaml`)
2. Click the **flowchart icon** in the editor title bar (top-right), or:
   - Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **Ansible Visualiser: Show Tree**
   - Right-click in the editor or explorer → **Ansible Visualiser: Show Tree**
3. The ASCII flowchart opens in a side panel
4. Edit your playbook — the diagram auto-refreshes on save

### Works with any YAML setup

| Your setup | What happens |
|---|---|
| **Red Hat Ansible extension installed** | Files detected as `ansible` get the title bar icon and render immediately |
| **No Ansible extension** | The icon still appears on all `.yml`/`.yaml` files. The extension scans for Ansible markers (`hosts:`, `tasks:`, `roles:`, etc.) and renders automatically if found |
| **Non-Ansible YAML** (Kubernetes, Docker Compose, etc.) | You'll get a quick prompt asking if you want to render anyway — no accidental flowcharts |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `ansibleVisualiser.showSummary` | `true` | Show the summary footer below the diagram |
| `ansibleVisualiser.autoRefresh` | `true` | Auto-refresh when the source file is saved |
| `ansibleVisualiser.includeDepth` | `1` | Max depth to follow `include_tasks`/`import_tasks` (0 = don't follow) |

## Supported Ansible constructs

- Playbooks (single and multi-play)
- Task files (standalone task lists)
- `pre_tasks`, `tasks`, `post_tasks`
- `block` / `rescue` / `always`
- `roles` (simple and with conditions)
- `handlers`
- `include_tasks` / `import_tasks` / `include_role` / `import_role`
- `when`, `loop`, `with_*`, `register`, `notify`, `delegate_to`, `tags`
- `become`, `ignore_errors`, `no_log`, `changed_when`, `failed_when`

## Development

```bash
npm install
npm run bundle     # build the extension
npm test           # run tests
npm run watch      # rebuild on changes
```

## License

MIT
