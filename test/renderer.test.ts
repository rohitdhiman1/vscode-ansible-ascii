import { describe, it, expect } from 'vitest';
import { parseAnsibleFile } from '../src/parser/parser';
import { render } from '../src/renderer/renderer';

const OPTS = { showSummary: true };
const OPTS_NO_SUMMARY = { showSummary: false };

describe('renderer: play structure', () => {
  it('renders play header with hosts and become', () => {
    const out = render(parseAnsibleFile(`
- hosts: webservers
  name: Deploy App
  become: yes
  tasks:
    - name: Install nginx
      apt:
        name: nginx
`), OPTS_NO_SUMMARY);

    expect(out).toContain('▶ Play: Deploy App');
    expect(out).toContain('hosts: webservers | become: yes');
    expect(out).toContain('tasks');
    expect(out).toContain('+');
    expect(out).toContain('Install nginx');
    expect(out).toContain('[apt]');
  });

  it('renders unnamed play', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  tasks:
    - name: T
      apt:
        name: vim
`), OPTS_NO_SUMMARY);

    expect(out).toContain('▶ Play: (unnamed)');
  });

  it('renders pre_tasks, roles, tasks, handlers, post_tasks sections', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: Full Play
  pre_tasks:
    - name: Pre
      setup:
  roles:
    - common
  tasks:
    - name: Main task
      apt:
        name: vim
  handlers:
    - name: Restart app
      service:
        name: app
        state: restarted
  post_tasks:
    - name: Post
      debug:
        msg: done
`), OPTS_NO_SUMMARY);

    expect(out).toContain('pre_tasks');
    expect(out).toContain('roles');
    expect(out).toContain('tasks');
    expect(out).toContain('handlers');
    expect(out).toContain('post_tasks');
    expect(out).toContain('common');
  });

  it('renders boxes with + corners and centered text', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: T
      apt:
        name: vim
`), OPTS_NO_SUMMARY);

    const lines = out.split('\n');
    const boxLines = lines.filter(l => l.trim().startsWith('+'));
    expect(boxLines.length).toBeGreaterThan(0);
    for (const bl of boxLines) {
      expect(bl.trim()).toMatch(/^\+[-+]+\+$/);
    }
  });

  it('renders vertical connectors between boxes', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: T
      apt:
        name: vim
`), OPTS_NO_SUMMARY);

    const lines = out.split('\n').map(l => l.trim());
    expect(lines).toContain('|');
    expect(lines).toContain('v');
  });
});

describe('renderer: blocks', () => {
  it('renders block with rescue and always', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - block:
        - name: Migrate
          shell: migrate.sh
          changed_when: false
      rescue:
        - name: Rollback
          shell: rollback.sh
          changed_when: false
      always:
        - name: Log
          debug:
            msg: done
`), OPTS_NO_SUMMARY);

    expect(out).toContain('[block]');
    expect(out).toContain('Migrate');
    expect(out).toContain('Rollback');
    expect(out).toContain('Log');
  });

  it('renders conditional block as when:', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - block:
        - name: Firewall
          ufw:
            rule: allow
      when: "env == 'prod'"
`), OPTS_NO_SUMMARY);

    expect(out).toContain("when: env == 'prod'");
  });
});

describe('renderer: summary', () => {
  it('renders summary footer', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: T1
      apt:
        name: vim
    - name: T2
      apt:
        name: curl
  handlers:
    - name: H1
      service:
        name: app
        state: restarted
`), OPTS);

    expect(out).toContain('Summary');
    expect(out).toContain('Tasks: 2');
    expect(out).toContain('Handlers: 1');
  });

  it('omits summary when showSummary is false', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: T
      apt:
        name: vim
`), OPTS_NO_SUMMARY);

    expect(out).not.toContain('Summary');
  });
});

describe('renderer: notify and register', () => {
  it('renders notify arrow', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: Config
      template:
        src: n.j2
        dest: /etc/n
      notify: Restart nginx
  handlers:
    - name: Restart nginx
      service:
        name: nginx
        state: restarted
`), OPTS_NO_SUMMARY);

    expect(out).toContain('--> notify: Restart nginx');
  });

  it('renders register info', () => {
    const out = render(parseAnsibleFile(`
- hosts: all
  name: P
  tasks:
    - name: Health
      uri:
        url: http://localhost/health
      register: result
`), OPTS_NO_SUMMARY);

    expect(out).toContain('register: result');
  });
});
