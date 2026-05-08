# Ansible ASCII Visualiser

A VS Code extension that renders Ansible YAML playbooks as ASCII flowchart diagrams — right inside your editor.

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
2. Run **Ansible Visualiser: Show Tree** from:
   - Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Right-click context menu (editor or explorer)
3. The ASCII flowchart opens in a side panel
4. Edit your playbook — the diagram auto-refreshes on save

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
