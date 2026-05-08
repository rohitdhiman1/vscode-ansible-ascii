import * as path from 'path';
import * as fs from 'fs';
import type { AnsibleNode } from '../../parser/types';

export function checkIncludes(nodes: AnsibleNode[], filePath: string): void {
  const dir = path.dirname(filePath);
  for (const node of nodes) {
    if (node.kind === 'include') {
      if (node.file && (node.type === 'include_tasks' || node.type === 'import_tasks')) {
        const resolved = path.resolve(dir, node.file);
        if (!fs.existsSync(resolved)) {
          node.warnings.push({ level: 'error', message: `file '${node.file}' not found` });
        }
      }
    }
    if (node.kind === 'block') {
      checkIncludes([...node.tasks, ...node.rescue, ...node.always], filePath);
    }
  }
}
