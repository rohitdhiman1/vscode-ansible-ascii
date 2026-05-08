import type { AnsibleFile, AnsibleNode, PlayNode } from '../parser/types';
import { checkErrorHandling } from './rules/errorHandling';
import { checkHandlers } from './rules/handlers';
import { checkIncludes } from './rules/includes';
import { checkBestPractices, checkPlayBestPractices } from './rules/bestPractices';
import { checkVariables } from './rules/variables';

export function analyse(file: AnsibleFile, filePath: string): AnsibleFile {
  if (file.type === 'playbook' && file.plays) {
    for (const play of file.plays) {
      analysePlay(play, filePath);
    }
  } else if (file.tasks) {
    analyseNodes(file.tasks, false);
    checkVariables(file.tasks);
    checkIncludes(file.tasks, filePath);
  }
  return file;
}

function analysePlay(play: PlayNode, filePath: string): void {
  checkPlayBestPractices(play);
  checkHandlers(play);

  analyseNodes(play.preTasks, play.become);
  analyseNodes(play.tasks, play.become);
  analyseNodes(play.postTasks, play.become);

  const allTasks: AnsibleNode[] = [...play.preTasks, ...play.tasks, ...play.postTasks];
  checkVariables(allTasks);
  checkIncludes(allTasks, filePath);
}

function analyseNodes(nodes: AnsibleNode[], playBecome: boolean): void {
  for (const node of nodes) {
    checkErrorHandling(node);
    checkBestPractices(node, playBecome);
  }
}
