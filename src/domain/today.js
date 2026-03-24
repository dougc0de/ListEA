import { TASK_STATUS } from './tasks';

function isOverdue(task, referenceDate) {
  return task.dueAt && new Date(task.dueAt) < referenceDate;
}

function isDueSoon(task, referenceDate) {
  if (!task.dueAt) return false;
  const dueAt = new Date(task.dueAt).getTime();
  const now = referenceDate.getTime();
  return dueAt >= now && dueAt - now <= 2 * 60 * 60 * 1000;
}

export class TodayBoardBuilder {
  build(tasks, { referenceDate = new Date() } = {}) {
    const lanes = {
      now: [],
      later: [],
      quickWins: [],
      important: [],
      waiting: [],
      overdue: [],
      suggested: [],
    };

    tasks
      .filter(task => task.status !== TASK_STATUS.COMPLETED)
      .forEach(task => {
        if (isOverdue(task, referenceDate)) {
          lanes.overdue.push(task);
          return;
        }

        if (task.status === TASK_STATUS.WAITING) {
          lanes.waiting.push(task);
          return;
        }

        if (isDueSoon(task, referenceDate)) {
          lanes.now.push(task);
          return;
        }

        if (task.effortMinutes <= 15) {
          lanes.quickWins.push(task);
          return;
        }

        if (task.priority === 'high' || task.impact === 'high' || task.status === TASK_STATUS.BLOCKED) {
          lanes.important.push(task);
          return;
        }

        lanes.later.push(task);
      });

    lanes.suggested = tasks
      .filter(task =>
        task.status !== TASK_STATUS.COMPLETED
        && !task.hasSubtasks()
        && (task.priority === 'high' || task.impact === 'high' || !task.dueAt),
      )
      .slice(0, 3);

    return [
      { id: 'now', title: 'Ahora', items: lanes.now },
      { id: 'later', title: 'Luego', items: lanes.later },
      { id: 'quickWins', title: 'Rapidas', items: lanes.quickWins },
      { id: 'important', title: 'Importantes', items: lanes.important },
      { id: 'waiting', title: 'En espera', items: lanes.waiting },
      { id: 'overdue', title: 'Vencidas', items: lanes.overdue },
      { id: 'suggested', title: 'Sugeridas', items: lanes.suggested },
    ];
  }
}
