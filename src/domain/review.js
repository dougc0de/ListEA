import { TASK_STATUS } from './tasks';

function normalizeTitle(title) {
  return `${title ?? ''}`.trim().toLowerCase();
}

function ageInDays(fromDate, referenceDate) {
  return Math.floor((referenceDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

export class ProfessionalReviewAnalyzer {
  analyze(tasks = [], { referenceDate = new Date() } = {}) {
    const openTasks = tasks.filter(task => task.status !== TASK_STATUS.COMPLETED);
    const reviewItems = [];

    const noDateTasks = openTasks.filter(task => !task.getRelevantDate());
    if (noDateTasks.length) {
      reviewItems.push({
        id: 'no-date',
        title: 'Capturas sin fecha',
        message: `${noDateTasks.length} tarea(s) siguen sin fecha y merecen una decision rapida.`,
        count: noDateTasks.length,
        actionLabel: 'Ver capturas',
        targetView: 'inbox',
      });
    }

    const overdueFollowUps = openTasks.filter(task =>
      task.status === TASK_STATUS.WAITING
      && task.followUpAt
      && new Date(task.followUpAt) < referenceDate,
    );
    if (overdueFollowUps.length) {
      reviewItems.push({
        id: 'overdue-follow-up',
        title: 'Seguimientos vencidos',
        message: `${overdueFollowUps.length} seguimiento(s) ya necesitan respuesta o una nueva fecha.`,
        count: overdueFollowUps.length,
        actionLabel: 'Ver seguimiento',
        targetView: 'follow-up',
      });
    }

    const staleBlocked = openTasks.filter(task => {
      if (task.status !== TASK_STATUS.BLOCKED) return false;
      const updatedAt = new Date(task.updatedAt || task.createdAt);
      if (Number.isNaN(updatedAt.getTime())) return false;
      return ageInDays(updatedAt, referenceDate) >= 3;
    });
    if (staleBlocked.length) {
      reviewItems.push({
        id: 'blocked-stale',
        title: 'Bloqueadas sin mover',
        message: `${staleBlocked.length} tarea(s) bloqueadas llevan al menos 3 dias sin siguiente paso claro.`,
        count: staleBlocked.length,
        actionLabel: 'Revisar bloqueadas',
        targetView: 'follow-up',
      });
    }

    const duplicateGroups = new Map();
    openTasks.forEach(task => {
      const key = normalizeTitle(task.title);
      if (!key) return;
      duplicateGroups.set(key, (duplicateGroups.get(key) ?? 0) + 1);
    });
    const duplicateCount = Array.from(duplicateGroups.values()).filter(count => count > 1).length;
    if (duplicateCount) {
      reviewItems.push({
        id: 'duplicates',
        title: 'Posibles duplicados',
        message: `${duplicateCount} titulo(s) repetidos conviene fusionarlos o aclararlos para evitar ruido.`,
        count: duplicateCount,
        actionLabel: 'Ver agenda',
        targetView: 'backlog',
      });
    }

    return reviewItems;
  }
}
