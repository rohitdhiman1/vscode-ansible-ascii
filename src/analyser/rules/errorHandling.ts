import type { AnsibleNode } from '../../parser/types';

export function checkErrorHandling(node: AnsibleNode): void {
  if (node.kind === 'block') {
    if (node.rescue.length === 0 && node.always.length === 0) {
      node.warnings.push({ level: 'warning', message: 'block has no rescue or always — failures are unhandled' });
    }
    for (const child of [...node.tasks, ...node.rescue, ...node.always]) {
      checkErrorHandling(child);
    }
  }

  if (node.kind === 'task') {
    if (node.ignoreErrors) {
      node.warnings.push({ level: 'warning', message: 'ignore_errors: yes — failures are silently swallowed' });
    }
    if ((node.module === 'shell' || node.module === 'command') && !node.changedWhen && !node.failedWhen) {
      node.warnings.push({ level: 'info', message: 'add changed_when / failed_when for idempotency' });
    }
  }
}
