import { describe, it, expect } from 'vitest';
import { parseAnsibleFile } from '../src/parser/parser';
import { analyse } from '../src/analyser/analyser';

const FILE = '/tmp/test.yml';

describe('handler rules', () => {
  it('flags handler notified but not defined as error on the task', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Start nginx
      service:
        name: nginx
        state: started
      notify: Reload nginx
  handlers:
    - name: Restart nginx
      service:
        name: nginx
        state: restarted
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    if (task.kind === 'task') {
      expect(task.warnings.some(w => w.level === 'error' && w.message.includes('Reload nginx'))).toBe(true);
    }
  });

  it('flags handler defined but never notified', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Do something
      apt:
        name: vim
  handlers:
    - name: Restart nginx
      service:
        name: nginx
        state: restarted
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const handler = file.plays![0].handlers[0];
    expect(handler.warnings.some(w => w.level === 'warning' && w.message.includes('never notified'))).toBe(true);
  });

  it('does not flag a handler that is correctly notified', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Config
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: Restart nginx
  handlers:
    - name: Restart nginx
      service:
        name: nginx
        state: restarted
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const handler = file.plays![0].handlers[0];
    expect(handler.warnings.filter(w => w.level === 'error' || w.level === 'warning')).toHaveLength(0);
    expect(handler.notified).toBe(true);
  });
});

describe('error handling rules', () => {
  it('flags block without rescue or always', () => {
    const yaml = `
- hosts: all
  tasks:
    - block:
        - name: Risky
          command: risky.sh
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const block = file.plays![0].tasks[0];
    expect(block.warnings.some(w => w.level === 'warning' && w.message.includes('no rescue'))).toBe(true);
  });

  it('does not flag block with rescue', () => {
    const yaml = `
- hosts: all
  tasks:
    - block:
        - name: Risky
          command: risky.sh
      rescue:
        - name: Fix it
          command: fix.sh
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const block = file.plays![0].tasks[0];
    expect(block.warnings.filter(w => w.message.includes('no rescue'))).toHaveLength(0);
  });

  it('flags ignore_errors: yes', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Might fail
      shell: risky.sh
      ignore_errors: yes
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'warning' && w.message.includes('ignore_errors'))).toBe(true);
  });

  it('flags shell/command without changed_when/failed_when as info', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Run script
      shell: my_script.sh
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'info' && w.message.includes('changed_when'))).toBe(true);
  });
});

describe('best practice rules', () => {
  it('flags task without a name', () => {
    const yaml = `
- hosts: all
  tasks:
    - apt:
        name: vim
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'warning' && w.message.includes('no name'))).toBe(true);
  });

  it('flags redundant become at task level', () => {
    const yaml = `
- hosts: all
  become: yes
  tasks:
    - name: Install nginx
      apt:
        name: nginx
      become: yes
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'warning' && w.message.includes('redundant'))).toBe(true);
  });

  it('flags shell: apt install as warning', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Install
      shell: apt install nginx
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'warning' && w.message.includes('`apt` module'))).toBe(true);
  });

  it('flags unnamed play as info', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Task
      apt:
        name: vim
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const play = file.plays![0];
    expect(play.warnings.some(w => w.level === 'info' && w.message.includes('no name'))).toBe(true);
  });
});

describe('variable rules', () => {
  it('flags unused registered variable', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Health check
      uri:
        url: http://localhost/health
      register: health_result
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.some(w => w.level === 'info' && w.message.includes('health_result'))).toBe(true);
  });

  it('does not flag used registered variable', () => {
    const yaml = `
- hosts: all
  tasks:
    - name: Health check
      uri:
        url: http://localhost/health
      register: health_result

    - name: Assert
      assert:
        that: "{{ health_result.status == 200 }}"
`;
    const file = parseAnsibleFile(yaml);
    analyse(file, FILE);
    const task = file.plays![0].tasks[0];
    expect(task.warnings.filter(w => w.message.includes('health_result'))).toHaveLength(0);
  });
});
