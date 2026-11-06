import content from './operatorGuides.json';
import modules from '../policies/modules.json';

export interface GuideTask {
  id: string; title: string; needs: string;
  steps: { title: string; body: string }[];
  result: string; stop: string;
}
export interface OperatorGuide {
  key: string; title: string; group: string; path: string; summary: string; access: string;
  tasks: GuideTask[];
  terms: { term: string; meaning: string }[];
  problems: { symptom: string; action: string }[];
  sources: string[];
}
export const guideEdition = content.edition;
export const guidePrinciples = content.principles;
export const operatorGuides: OperatorGuide[] = content.guides.map(guide => {
  const module = modules.find(entry => entry.module_key === guide.key);
  return { ...guide, title: module?.name || guide.key, group: module?.page_key || 'Operations' };
});
export const guidePdf = (key: string) => `/manual/modules/${key}.pdf`;
export const guideGroups: Record<string, string[]> = {
  checklist: ['checklists.execution'], checklists: ['checklists.execution'], templateManager: ['checklists.templates'],
  taskCenter: ['task_manager.tasks'], databaseStats: ['database.statistics'], performance: ['performance.dashboard'],
  advancedTeamManagement: ['team.scheduling'], teamManagement: ['team.scheduling'],
  revampedTeamManagement: ['team.scheduling'], revolutionaryTeam: ['team.scheduling'], teamManagementCalendar: ['team.scheduling'],
  userScheduleDashboard: ['team.schedule'], networkSentinel: modules.filter(m => m.module_key.startsWith('network_sentinel.')).map(m => m.module_key),
  trustlinkOperations: modules.filter(m => m.module_key.startsWith('trustlink.')).map(m => m.module_key),
  nexus: modules.filter(m => m.module_key.startsWith('nexus.')).map(m => m.module_key),
  clearing: ['funds_custody.workspace'], reports: modules.filter(m => m.module_key.startsWith('reports.')).map(m => m.module_key),
};
