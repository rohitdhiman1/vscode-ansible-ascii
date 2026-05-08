import type {
  AnsibleFile, AnsibleNode, BlockNode, HandlerNode,
  IncludeNode, PlayNode, RoleRef, TaskNode,
} from '../parser/types';

const BOX_MIN_WIDTH = 20;
const BOX_MAX_WIDTH = 60;

export interface RendererOptions {
  showSummary: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function render(file: AnsibleFile, options: RendererOptions): string {
  const blocks: FlowBlock[] = [];

  if (file.type === 'playbook' && file.plays) {
    for (let i = 0; i < file.plays.length; i++) {
      if (i > 0) blocks.push({ type: 'separator' });
      blocks.push(...buildPlayBlocks(file.plays[i]));
    }
  } else if (file.tasks) {
    blocks.push(makeFlowBox(['▶ Tasks (role task file)']));
    blocks.push(...buildNodeBlocks(file.tasks));
  }

  const lines = layoutVertical(blocks);
  return lines.join('\n');
}

// ─── Flow block types ───────────────────────────────────────────────────────

interface BoxBlock {
  type: 'box';
  lines: string[];
  width: number;
}

interface ConnectorBlock {
  type: 'connector';
}

interface SeparatorBlock {
  type: 'separator';
}

type FlowBlock = BoxBlock | ConnectorBlock | SeparatorBlock;

// ─── Build flow blocks from AST ─────────────────────────────────────────────

function buildPlayBlocks(play: PlayNode): FlowBlock[] {
  const blocks: FlowBlock[] = [];

  const titleLine = `▶ Play: ${play.name ?? '(unnamed)'}`;
  const hostsLine = `hosts: ${play.hosts}${play.become ? ' | become: yes' : ''}`;
  blocks.push(makeFlowBox([titleLine, hostsLine]));

  if (play.tasks.length === 0) {
    blocks.push(makeFlowBox(['(no tasks)']));
    return blocks;
  }

  blocks.push(makeFlowBox(['tasks']));
  blocks.push(...buildNodeBlocks(play.tasks));

  return blocks;
}

function buildNodeBlocks(nodes: AnsibleNode[]): FlowBlock[] {
  const blocks: FlowBlock[] = [];
  for (const node of nodes) {
    blocks.push(...buildNodeBlock(node));
  }
  return blocks;
}

function buildNodeBlock(node: AnsibleNode): FlowBlock[] {
  if (node.kind === 'task')    return buildTaskBlock(node);
  if (node.kind === 'block')   return buildBlockBlock(node);
  if (node.kind === 'include') return buildIncludeBlock(node);
  return [];
}

function arg(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const v = (args as Record<string, unknown>)[key];
  return v == null ? undefined : String(v);
}

function describeOperation(module: string, args: unknown): string[] {
  if (typeof args === 'string') return [args];
  if (!args || typeof args !== 'object') return [];

  if (module === 'shell' || module === 'command' || module === 'raw') {
    const cmd = arg(args, 'cmd') ?? arg(args, '_raw_params');
    return cmd ? [cmd] : [];
  }

  if (module === 'copy' || module === 'template') {
    const src = arg(args, 'src');
    const dest = arg(args, 'dest');
    if (src && dest) return [`${src} → ${dest}`];
  }

  if (module === 'git') {
    const repo = arg(args, 'repo');
    const dest = arg(args, 'dest');
    if (repo && dest) return [`${repo} → ${dest}`];
    if (repo) return [repo];
  }

  if (module === 'debug') {
    const msg = arg(args, 'msg');
    if (msg) return [`"${msg}"`];
  }

  const SKIP_ARGS = new Set([
    'changed_when', 'failed_when', 'no_log', 'ignore_errors',
    'retries', 'delay', 'until', 'async', 'poll',
    'environment', 'vars', 'args', 'timeout',
  ]);

  const SENSITIVE_ARGS = new Set([
    'password', 'login_password', 'secret', 'token',
    'api_key', 'private_key', 'secret_key',
  ]);

  const entries = Object.entries(args as Record<string, unknown>)
    .filter(([k, v]) => {
      if (SKIP_ARGS.has(k)) return false;
      if (k === 'state' && v === 'present') return false;
      const s = String(v);
      if (s.includes('{{ item }}') || s === '{{ item }}') return false;
      return true;
    });
  const argsMap = args as Record<string, unknown>;
  if (argsMap.state && argsMap.enabled !== undefined) {
    const result: string[] = [];
    const enabledStr = argsMap.enabled ? 'enabled' : 'disabled';
    for (const [k, v] of entries) {
      if (k === 'enabled') continue;
      if (k === 'state') {
        result.push(`${String(v)} + ${enabledStr}`);
      } else if (SENSITIVE_ARGS.has(k)) {
        result.push(`${k}: ****`);
      } else if (Array.isArray(v)) {
        for (const item of v) result.push(`- ${String(item)}`);
      } else {
        result.push(`${k}: ${String(v)}`);
      }
    }
    return result;
  }

  const result: string[] = [];
  for (const [k, v] of entries) {
    if (SENSITIVE_ARGS.has(k)) {
      result.push(`${k}: ****`);
    } else if (Array.isArray(v)) {
      for (const item of v) result.push(`- ${String(item)}`);
    } else {
      result.push(`${k}: ${String(v)}`);
    }
  }
  return result;
}

function shortModule(module: string): string {
  const parts = module.split('.');
  return parts[parts.length - 1];
}

function describeTask(task: TaskNode): string {
  if (task.name) return task.name;
  if (task.module && task.moduleArgs) {
    const details = describeOperation(task.module, task.moduleArgs);
    if (details.length > 0) return details[0];
  }
  if (task.module) return task.module;
  return '(task)';
}

function buildTaskBlock(task: TaskNode): FlowBlock[] {
  const name = describeTask(task);
  const lines: string[] = [name];

  if (task.module) {
    const details = task.name ? describeOperation(task.module, task.moduleArgs) : [];
    lines.push(`[${shortModule(task.module)}]`);
    for (const d of details) lines.push(d);
  }
  if (task.when) {
    const whenStr = Array.isArray(task.when) ? task.when.join(' and ') : task.when;
    lines.push(`when: ${whenStr}`);
  }
  if (task.register) lines.push(`register: ${task.register}`);
  if (task.loop !== undefined) {
    if (Array.isArray(task.loop)) {
      const items = task.loop.map(i =>
        typeof i === 'object' && i !== null ? JSON.stringify(i) : String(i)
      );
      lines.push(`loop: [${items.join(', ')}]`);
    } else if (typeof task.loop === 'string') {
      lines.push(`loop: ${task.loop}`);
    } else {
      lines.push('loop');
    }
  }
  if (task.notify?.length) lines.push(`--> notify: ${task.notify.join(', ')}`);

  return [makeFlowBox(lines)];
}

function buildBlockBlock(block: BlockNode): FlowBlock[] {
  const header = `[block]${block.name ? ` ${block.name}` : ''}`;
  return [makeFlowBox([header])];
}

function buildIncludeBlock(node: IncludeNode): FlowBlock[] {
  const target = node.file ?? node.role ?? '?';
  return [makeFlowBox([`[${node.type}] ${target}`])];
}

// ─── Box rendering ──────────────────────────────────────────────────────────

function wrapLine(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];
  const words = text.split(' ');
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      result.push(current);
      current = word;
    }
  }
  if (current.length > 0) result.push(current);
  if (result.length === 0) result.push(text);
  return result;
}

function makeFlowBox(contentLines: string[]): BoxBlock {
  const wrapped = contentLines.flatMap(l => wrapLine(l, BOX_MAX_WIDTH));
  const innerWidth = Math.max(BOX_MIN_WIDTH, ...wrapped.map(l => l.length));
  const halfLeft = Math.floor(innerWidth / 2);
  const halfRight = innerWidth - halfLeft;

  const topBorder = '+' + '-'.repeat(innerWidth + 2) + '+';
  const botBorder = '+' + '-'.repeat(halfLeft) + '+' + '-'.repeat(halfRight + 1) + '+';

  const lines = [topBorder];
  for (const line of wrapped) {
    const pad = innerWidth - line.length;
    const padL = Math.floor(pad / 2);
    const padR = pad - padL;
    lines.push('| ' + ' '.repeat(padL) + line + ' '.repeat(padR) + ' |');
  }
  lines.push(botBorder);

  return { type: 'box', lines, width: innerWidth + 4 };
}

// ─── Layout engine ──────────────────────────────────────────────────────────

function centerColumn(boxBlock: BoxBlock): number {
  const bot = boxBlock.lines[boxBlock.lines.length - 1];
  const lastPlus = bot.lastIndexOf('+');
  const firstPlus = bot.indexOf('+');
  const midPlus = bot.indexOf('+', firstPlus + 1);
  if (midPlus > 0 && midPlus < lastPlus) return midPlus;
  return Math.floor(boxBlock.width / 2);
}

function layoutVertical(blocks: FlowBlock[]): string[] {
  const groups: { lines: string[]; center: number }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'separator') {
      groups.push({ lines: ['', ''], center: 0 });
      continue;
    }

    if (i > 0 && blocks[i - 1].type !== 'separator') {
      groups.push({ lines: ['|', 'v'], center: 0 });
    }

    if (block.type === 'box') {
      groups.push({ lines: block.lines, center: centerColumn(block) });
    }
  }

  const maxCenter = Math.max(...groups.map(g => g.center));

  const lines: string[] = [];
  for (const group of groups) {
    const offset = maxCenter - group.center;
    for (const line of group.lines) {
      lines.push(' '.repeat(offset) + line);
    }
  }

  return lines;
}
