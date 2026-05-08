export type WarningLevel = 'error' | 'warning' | 'info';

export interface Warning {
  level: WarningLevel;
  message: string;
}

export interface TaskNode {
  kind: 'task';
  name?: string;
  module?: string;
  moduleArgs?: unknown;
  notify?: string[];
  when?: string | string[];
  register?: string;
  ignoreErrors: boolean;
  become: boolean;
  noLog: boolean;
  loop?: unknown;
  delegateTo?: string;
  tags?: string[];
  changedWhen?: string | string[];
  failedWhen?: string | string[];
  warnings: Warning[];
}

export interface BlockNode {
  kind: 'block';
  name?: string;
  tasks: AnsibleNode[];
  rescue: AnsibleNode[];
  always: AnsibleNode[];
  when?: string | string[];
  become: boolean;
  warnings: Warning[];
}

export type IncludeType = 'include_tasks' | 'import_tasks' | 'include_role' | 'import_role';

export interface IncludeNode {
  kind: 'include';
  type: IncludeType;
  file?: string;
  role?: string;
  when?: string | string[];
  warnings: Warning[];
}

export type AnsibleNode = TaskNode | BlockNode | IncludeNode;

export interface HandlerNode {
  kind: 'handler';
  name: string;
  module?: string;
  notified: boolean;
  warnings: Warning[];
}

export interface RoleRef {
  name: string;
  when?: string | string[];
}

export interface PlayNode {
  kind: 'play';
  name?: string;
  hosts: string;
  become: boolean;
  preTasks: AnsibleNode[];
  roles: RoleRef[];
  tasks: AnsibleNode[];
  handlers: HandlerNode[];
  postTasks: AnsibleNode[];
  vars?: Record<string, unknown>;
  warnings: Warning[];
}

export interface AnsibleFile {
  type: 'playbook' | 'tasks';
  plays?: PlayNode[];
  tasks?: AnsibleNode[];
  handlers?: HandlerNode[];
}
