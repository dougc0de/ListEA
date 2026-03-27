import { TASK_STATUS } from './tasks';

function normalizeTitle(title) {
  return `${title ?? ''}`.trim().toLowerCase();
}

export class BacklogInsightAnalyzer {
  analyze(tasks, { referenceDate = new Date() } = {}) {
    const activeTasks = tasks.filter(task => task.status !== TASK_STATUS.COMPLETED);
    const insights = [];

    const noDateTasks = activeTasks.filter(task => !task.getRelevantDate());
    if (noDateTasks.length) {
      const message = noDateTasks.length === 1
        ? '1 tarea puede perderse dentro de tu lista ya que no precisa de una fecha.'
        : `${noDateTasks.length} tareas pueden perderse dentro de tu lista ya que no precisan de una fecha.`;
      insights.push({
        id: 'no-date',
        title: 'Hay tareas sin fecha',
        message,
      });
    }

    const staleTasks = activeTasks.filter(task => {
      const createdAt = new Date(task.createdAt);
      const ageMs = referenceDate.getTime() - createdAt.getTime();
      return ageMs > 14 * 24 * 60 * 60 * 1000 && !task.dueAt;
    });
    if (staleTasks.length) {
      insights.push({
        id: 'stale',
        title: 'Hay tareas viejas sin decision',
        message: `${staleTasks.length} tarea(s) llevan mas de 14 dias sin una fecha clara.`,
      });
    }

    const duplicates = new Map();
    activeTasks.forEach(task => {
      const key = normalizeTitle(task.title);
      if (!key) return;
      duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
    });

    const duplicateCount = Array.from(duplicates.values()).filter(count => count > 1).length;
    if (duplicateCount) {
      insights.push({
        id: 'duplicates',
        title: 'Posibles duplicados',
        message: `${duplicateCount} titulo(s) aparecen repetidos y merecen fusionarse o aclararse.`,
      });
    }

    const projectCounts = new Map();
    activeTasks.forEach(task => {
      if (!task.project) return;
      projectCounts.set(task.project, (projectCounts.get(task.project) ?? 0) + 1);
    });

    const saturatedProjects = Array.from(projectCounts.entries()).filter(([, count]) => count >= 5);
    if (saturatedProjects.length) {
      insights.push({
        id: 'saturated-projects',
        title: 'Hay proyectos saturados',
        message: `${saturatedProjects.length} proyecto(s) tienen cinco o mas tareas abiertas.`,
      });
    }

    return insights;
  }
}

export class ExecutionAdvisor {
  suggest(task) {
    if (task.status === TASK_STATUS.BLOCKED) {
      return 'Define que desbloquea esta tarea antes de moverla.';
    }

    if (task.status === TASK_STATUS.WAITING) {
      return 'Programa el siguiente seguimiento para no perder contexto.';
    }

    if (!task.hasSubtasks() && (task.priority === 'high' || task.impact === 'high')) {
      return 'Divide esta tarea en 2 o 3 pasos accionables.';
    }

    if (!task.dueAt) {
      return 'Asigna una fecha o filtro para que no se quede enterrada.';
    }

    if (task.effortMinutes > 60) {
      return 'Bloquea tiempo de enfoque para atacarla sin interrupciones.';
    }

    return 'Tiene suficiente contexto para ejecutarse sin friccion extra.';
  }
}
