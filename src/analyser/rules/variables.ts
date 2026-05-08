import type { AnsibleNode } from '../../parser/types';

export function checkVariables(nodes: AnsibleNode[]): void {
  const registered = new Map<string, AnsibleNode>();
  const used = new Set<string>();

  collectRegistered(nodes, registered);
  collectUsed(nodes, used);

  for (const [varName, node] of registered) {
    if (!used.has(varName) && node.kind === 'task') {
      node.warnings.push({ level: 'info', message: `registered var '${varName}' is never used` });
    }
  }
}

function collectRegistered(nodes: AnsibleNode[], map: Map<string, AnsibleNode>): void {
  for (const node of nodes) {
    if (node.kind === 'task' && node.register) {
      map.set(node.register, node);
    }
    if (node.kind === 'block') {
      collectRegistered([...node.tasks, ...node.rescue, ...node.always], map);
    }
  }
}

function collectUsed(nodes: AnsibleNode[], used: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'task') {
      const sources = [
        node.when, node.changedWhen, node.failedWhen,
        typeof node.moduleArgs === 'string' ? node.moduleArgs : JSON.stringify(node.moduleArgs),
      ];
      for (const s of sources) {
        if (s) extractRefs(Array.isArray(s) ? s.join(' ') : String(s), used);
      }
    }

    if (node.kind === 'block') {
      if (node.when) extractRefs(Array.isArray(node.when) ? node.when.join(' ') : node.when, used);
      collectUsed([...node.tasks, ...node.rescue, ...node.always], used);
    }

    if (node.kind === 'include' && node.when) {
      extractRefs(Array.isArray(node.when) ? node.when.join(' ') : node.when, used);
    }
  }
}

function extractRefs(str: string, used: Set<string>): void {
  for (const match of str.matchAll(/\{\{\s*([\w]+)/g)) {
    used.add(match[1]);
  }
}
