import { parse } from 'yaml';
import type {
  AnsibleFile, AnsibleNode, BlockNode, HandlerNode,
  IncludeNode, IncludeType, PlayNode, RoleRef, TaskNode
} from './types';

const RESERVED_TASK_KEYS = new Set([
  'name', 'when', 'register', 'notify', 'ignore_errors', 'become',
  'no_log', 'loop', 'with_items', 'with_list', 'with_dict', 'with_sequence',
  'with_fileglob', 'with_first_found', 'with_subelements', 'with_nested',
  'with_cartesian', 'with_indexed_items', 'with_flattened', 'with_together',
  'with_random_choice', 'with_lines', 'with_inventory_hostnames',
  'tags', 'changed_when', 'failed_when', 'vars', 'environment', 'args',
  'listen', 'delegate_to', 'run_once', 'any_errors_fatal',
  'diff', 'check_mode', 'debugger', 'block', 'rescue', 'always',
  'include_tasks', 'import_tasks', 'include_role', 'import_role',
  'include', 'import_playbook',
]);

const INCLUDE_TYPES: IncludeType[] = ['include_tasks', 'import_tasks', 'include_role', 'import_role'];

export function parseAnsibleFile(content: string): AnsibleFile {
  let doc: unknown;
  try {
    doc = parse(content);
  } catch {
    return { type: 'tasks', tasks: [], handlers: [] };
  }

  if (!Array.isArray(doc) || doc.length === 0) {
    return { type: 'tasks', tasks: [], handlers: [] };
  }

  const first = doc[0];
  if (first && typeof first === 'object' && 'hosts' in (first as object)) {
    return {
      type: 'playbook',
      plays: (doc as Record<string, unknown>[]).map(parsePlay),
    };
  }

  return {
    type: 'tasks',
    tasks: parseTaskList(doc as Record<string, unknown>[]),
  };
}

function parsePlay(data: Record<string, unknown>): PlayNode {
  return {
    kind: 'play',
    name: typeof data.name === 'string' ? data.name : undefined,
    hosts: String(data.hosts ?? 'all'),
    become: isTruthy(data.become),
    preTasks: parseTaskList(asArray(data.pre_tasks)),
    roles: parseRoles(asArray(data.roles)),
    tasks: parseTaskList(asArray(data.tasks)),
    handlers: parseHandlers(asArray(data.handlers)),
    postTasks: parseTaskList(asArray(data.post_tasks)),
    vars: data.vars as Record<string, unknown> | undefined,
    warnings: [],
  };
}

function parseRoles(roles: unknown[]): RoleRef[] {
  return roles.map(r => {
    if (typeof r === 'string') return { name: r };
    if (r && typeof r === 'object') {
      const ro = r as Record<string, unknown>;
      return {
        name: String(ro.role ?? ro.name ?? '?'),
        when: ro.when as string | string[] | undefined,
      };
    }
    return { name: String(r) };
  });
}

function parseTaskList(items: Record<string, unknown>[]): AnsibleNode[] {
  if (!Array.isArray(items)) return [];
  return items.map(parseTaskOrBlock).filter((n): n is AnsibleNode => n !== null);
}

function parseTaskOrBlock(data: Record<string, unknown>): AnsibleNode | null {
  if (!data || typeof data !== 'object') return null;

  if ('block' in data) return parseBlock(data);

  for (const type of INCLUDE_TYPES) {
    if (type in data) return parseInclude(data, type);
  }

  return parseTask(data);
}

function parseBlock(data: Record<string, unknown>): BlockNode {
  return {
    kind: 'block',
    name: typeof data.name === 'string' ? data.name : undefined,
    tasks: parseTaskList(asArray(data.block)),
    rescue: parseTaskList(asArray(data.rescue)),
    always: parseTaskList(asArray(data.always)),
    when: data.when as string | string[] | undefined,
    become: isTruthy(data.become),
    warnings: [],
  };
}

function parseInclude(data: Record<string, unknown>, type: IncludeType): IncludeNode {
  const value = data[type];
  const isRole = type === 'include_role' || type === 'import_role';
  let file: string | undefined;
  let role: string | undefined;

  if (isRole) {
    role = typeof value === 'string' ? value
      : value && typeof value === 'object' ? String((value as Record<string, unknown>).name ?? '') : undefined;
  } else {
    file = typeof value === 'string' ? value
      : value && typeof value === 'object' ? String((value as Record<string, unknown>).file ?? '') : undefined;
  }

  return {
    kind: 'include',
    type,
    file,
    role,
    when: data.when as string | string[] | undefined,
    warnings: [],
  };
}

function parseTask(data: Record<string, unknown>): TaskNode {
  let module: string | undefined;
  let moduleArgs: unknown;

  for (const key of Object.keys(data)) {
    if (!RESERVED_TASK_KEYS.has(key)) {
      module = key;
      moduleArgs = data[key];
      break;
    }
  }

  const notifyRaw = data.notify;
  let notify: string[] | undefined;
  if (Array.isArray(notifyRaw)) {
    notify = notifyRaw.map(String);
  } else if (notifyRaw !== undefined && notifyRaw !== null) {
    notify = [String(notifyRaw)];
  }

  return {
    kind: 'task',
    name: typeof data.name === 'string' ? data.name : undefined,
    module,
    moduleArgs,
    notify,
    when: data.when as string | string[] | undefined,
    register: typeof data.register === 'string' ? data.register : undefined,
    ignoreErrors: isTruthy(data.ignore_errors),
    become: isTruthy(data.become),
    noLog: data.no_log === true,
    loop: data.loop ?? data.with_items,
    delegateTo: typeof data.delegate_to === 'string' ? data.delegate_to : undefined,
    tags: parseTags(data.tags),
    changedWhen: data.changed_when as string | string[] | undefined,
    failedWhen: data.failed_when as string | string[] | undefined,
    warnings: [],
  };
}

function parseHandlers(items: Record<string, unknown>[]): HandlerNode[] {
  if (!Array.isArray(items)) return [];
  return items.map(data => {
    let module: string | undefined;
    for (const key of Object.keys(data)) {
      if (!RESERVED_TASK_KEYS.has(key) && key !== 'listen') {
        module = key;
        break;
      }
    }
    return {
      kind: 'handler' as const,
      name: typeof data.name === 'string' ? data.name : String(data.name ?? ''),
      module,
      notified: false,
      warnings: [],
    };
  });
}

function asArray(val: unknown): Record<string, unknown>[] {
  return Array.isArray(val) ? (val as Record<string, unknown>[]) : [];
}

function isTruthy(val: unknown): boolean {
  return val === true || val === 'yes' || val === 'true';
}

function parseTags(val: unknown): string[] | undefined {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return undefined;
}
