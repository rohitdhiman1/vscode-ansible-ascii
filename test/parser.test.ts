import { describe, it, expect } from 'vitest';
import { parseAnsibleFile } from '../src/parser/parser';

describe('parseAnsibleFile', () => {
  it('detects a playbook by hosts key', () => {
    const yaml = `
- hosts: webservers
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
`;
    const result = parseAnsibleFile(yaml);
    expect(result.type).toBe('playbook');
    expect(result.plays).toHaveLength(1);
    expect(result.plays![0].hosts).toBe('webservers');
  });

  it('parses tasks and handlers', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Task one
      apt:
        name: vim
    - name: Task two
      shell: echo hello
      notify: My Handler
  handlers:
    - name: My Handler
      service:
        name: nginx
        state: restarted
`;
    const result = parseAnsibleFile(yaml);
    const play = result.plays![0];
    expect(play.tasks).toHaveLength(2);
    expect(play.tasks[0].kind).toBe('task');
    if (play.tasks[0].kind === 'task') {
      expect(play.tasks[0].module).toBe('apt');
    }
    expect(play.handlers).toHaveLength(1);
    expect(play.handlers[0].name).toBe('My Handler');
  });

  it('parses become, when, register', () => {
    const yaml = `
- hosts: all
  become: yes
  tasks:
    - name: Check health
      uri:
        url: http://localhost/health
      register: health
      when: env == 'prod'
      become: yes
`;
    const result = parseAnsibleFile(yaml);
    const play = result.plays![0];
    expect(play.become).toBe(true);
    const task = play.tasks[0];
    if (task.kind === 'task') {
      expect(task.register).toBe('health');
      expect(task.when).toBe("env == 'prod'");
      expect(task.become).toBe(true);
    }
  });

  it('parses blocks with rescue and always', () => {
    const yaml = `
- hosts: all
  tasks:
    - block:
        - name: Risky
          command: risky
      rescue:
        - name: Rollback
          command: rollback
      always:
        - name: Cleanup
          debug:
            msg: done
`;
    const result = parseAnsibleFile(yaml);
    const block = result.plays![0].tasks[0];
    expect(block.kind).toBe('block');
    if (block.kind === 'block') {
      expect(block.tasks).toHaveLength(1);
      expect(block.rescue).toHaveLength(1);
      expect(block.always).toHaveLength(1);
    }
  });

  it('detects a role task file (no hosts)', () => {
    const yaml = `
- name: Install packages
  apt:
    name: nginx
`;
    const result = parseAnsibleFile(yaml);
    expect(result.type).toBe('tasks');
    expect(result.tasks).toHaveLength(1);
  });

  it('parses include_tasks', () => {
    const yaml = `
- hosts: all
  tasks:
    - include_tasks: setup.yml
      when: setup_needed
`;
    const result = parseAnsibleFile(yaml);
    const node = result.plays![0].tasks[0];
    expect(node.kind).toBe('include');
    if (node.kind === 'include') {
      expect(node.type).toBe('include_tasks');
      expect(node.file).toBe('setup.yml');
      expect(node.when).toBe('setup_needed');
    }
  });

  it('parses import_role', () => {
    const yaml = `
- hosts: all
  tasks:
    - import_role:
        name: myrole
`;
    const result = parseAnsibleFile(yaml);
    const node = result.plays![0].tasks[0];
    expect(node.kind).toBe('include');
    if (node.kind === 'include') {
      expect(node.type).toBe('import_role');
      expect(node.role).toBe('myrole');
    }
  });

  it('parses roles section', () => {
    const yaml = `
- hosts: all
  roles:
    - common
    - role: nginx
      when: setup_nginx
`;
    const result = parseAnsibleFile(yaml);
    const play = result.plays![0];
    expect(play.roles).toHaveLength(2);
    expect(play.roles[0].name).toBe('common');
    expect(play.roles[1].name).toBe('nginx');
    expect(play.roles[1].when).toBe('setup_nginx');
  });

  it('parses multi-play playbook', () => {
    const yaml = `
- hosts: webservers
  tasks:
    - name: Task A
      apt:
        name: nginx

- hosts: dbservers
  tasks:
    - name: Task B
      apt:
        name: postgresql
`;
    const result = parseAnsibleFile(yaml);
    expect(result.plays).toHaveLength(2);
    expect(result.plays![0].hosts).toBe('webservers');
    expect(result.plays![1].hosts).toBe('dbservers');
  });

  it('returns empty tasks for invalid YAML', () => {
    const result = parseAnsibleFile('{ broken: yaml: here');
    expect(result.type).toBe('tasks');
    expect(result.tasks).toHaveLength(0);
  });

  it('parses loop and tags', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Install packages
      apt:
        name: "{{ item }}"
      loop: [nginx, vim]
      tags: [setup, packages]
`;
    const result = parseAnsibleFile(yaml);
    const task = result.plays![0].tasks[0];
    if (task.kind === 'task') {
      expect(task.loop).toEqual(['nginx', 'vim']);
      expect(task.tags).toEqual(['setup', 'packages']);
    }
  });
});
