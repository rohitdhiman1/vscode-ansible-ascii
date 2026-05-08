import type { AnsibleNode, HandlerNode, PlayNode } from '../../parser/types';

export function checkHandlers(play: PlayNode): void {
  const notified = new Set<string>();
  collectNotified(play.preTasks, notified);
  collectNotified(play.tasks, notified);
  collectNotified(play.postTasks, notified);

  const defined = new Map<string, HandlerNode>();
  for (const h of play.handlers) {
    defined.set(h.name, h);
  }

  for (const name of notified) {
    const handler = defined.get(name);
    if (handler) {
      handler.notified = true;
    } else {
      markMissingHandler(play.preTasks, name);
      markMissingHandler(play.tasks, name);
      markMissingHandler(play.postTasks, name);
    }
  }

  for (const handler of play.handlers) {
    if (!handler.notified) {
      handler.warnings.push({ level: 'warning', message: `handler '${handler.name}' is defined but never notified` });
    }
  }
}

function collectNotified(nodes: AnsibleNode[], notified: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'task' && node.notify) {
      for (const n of node.notify) notified.add(n);
    }
    if (node.kind === 'block') {
      collectNotified(node.tasks, notified);
      collectNotified(node.rescue, notified);
      collectNotified(node.always, notified);
    }
  }
}

function markMissingHandler(nodes: AnsibleNode[], name: string): void {
  for (const node of nodes) {
    if (node.kind === 'task' && node.notify?.includes(name)) {
      node.warnings.push({ level: 'error', message: `notifies handler '${name}' which is not defined` });
    }
    if (node.kind === 'block') {
      markMissingHandler(node.tasks, name);
      markMissingHandler(node.rescue, name);
      markMissingHandler(node.always, name);
    }
  }
}
