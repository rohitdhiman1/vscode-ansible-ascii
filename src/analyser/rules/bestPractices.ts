import type { AnsibleNode, PlayNode } from '../../parser/types';

const SHELL_PATTERNS: Array<[RegExp, string]> = [
  [/^apt(-get)?\s+(install|remove|purge|update|upgrade)/i, 'use the `apt` module instead'],
  [/^yum\s+(install|remove|update)/i, 'use the `yum` module instead'],
  [/^dnf\s+(install|remove|update)/i, 'use the `dnf` module instead'],
  [/^pip\d*\s+install/i, 'use the `pip` module instead'],
  [/^systemctl\s+(start|stop|restart|enable|disable|reload)/i, 'use the `service` module instead'],
  [/^cp\s+/i, 'use the `copy` module instead'],
  [/^rm\s+/i, 'use the `file` module with state=absent instead'],
  [/^mkdir\s+/i, 'use the `file` module with state=directory instead'],
  [/^chmod\s+/i, 'use the `file` module instead'],
  [/^chown\s+/i, 'use the `file` module instead'],
  [/^(wget|curl)\s+/i, 'use the `get_url` or `uri` module instead'],
  [/^git\s+clone/i, 'use the `git` module instead'],
  [/^(useradd|adduser)\s+/i, 'use the `user` module instead'],
  [/^groupadd\s+/i, 'use the `group` module instead'],
];

export function checkBestPractices(node: AnsibleNode, playBecome: boolean): void {
  if (node.kind === 'task') {
    if (!node.name) {
      node.warnings.push({ level: 'warning', message: 'task has no name — harder to debug in output' });
    }

    if (node.become && playBecome) {
      node.warnings.push({ level: 'warning', message: 'become: yes is redundant — already set at play level' });
    }

    if (node.noLog) {
      node.warnings.push({ level: 'warning', message: 'no_log: true may hide debugging information' });
    }

    if (node.module === 'shell' || node.module === 'command') {
      const cmd = resolveCmd(node.moduleArgs);
      for (const [pattern, suggestion] of SHELL_PATTERNS) {
        if (pattern.test(cmd.trim())) {
          node.warnings.push({ level: 'warning', message: suggestion });
          break;
        }
      }
    }
  }

  if (node.kind === 'block') {
    for (const child of [...node.tasks, ...node.rescue, ...node.always]) {
      checkBestPractices(child, playBecome);
    }
  }
}

export function checkPlayBestPractices(play: PlayNode): void {
  if (!play.name) {
    play.warnings.push({ level: 'info', message: 'play has no name' });
  }

  const total = countTasks([...play.preTasks, ...play.tasks, ...play.postTasks]);
  if (total > 20) {
    play.warnings.push({
      level: 'info',
      message: `${total} tasks in a single play — consider splitting into roles`,
    });
  }
}

function resolveCmd(args: unknown): string {
  if (typeof args === 'string') return args;
  if (args && typeof args === 'object') {
    const a = args as Record<string, unknown>;
    return String(a.cmd ?? a._raw_params ?? a.argv ?? '');
  }
  return '';
}

function countTasks(nodes: AnsibleNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === 'task' || node.kind === 'include') count++;
    if (node.kind === 'block') count += countTasks([...node.tasks, ...node.rescue, ...node.always]);
  }
  return count;
}
