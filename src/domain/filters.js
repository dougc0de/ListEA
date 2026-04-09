import { TASK_STATUS } from './tasks';

export const FILTER_IDS = Object.freeze({
  TODAY: 'today',
  THIS_WEEK: 'this-week',
  OVERDUE: 'overdue',
  NO_DATE: 'no-date',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  WAITING: 'waiting',
  QUICK: 'quick',
  HIGH_IMPACT: 'high-impact',
});

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isSameWeek(left, right) {
  const start = new Date(right);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return left >= start && left < end;
}

export class TaskFilterCatalog {
  getPrimaryFilters() {
    return [
      { id: FILTER_IDS.TODAY, label: 'Hoy' },
      { id: FILTER_IDS.THIS_WEEK, label: 'Esta semana' },
      { id: FILTER_IDS.OVERDUE, label: 'Vencidas' },
      { id: FILTER_IDS.NO_DATE, label: 'Sin fecha' },
      { id: FILTER_IDS.COMPLETED, label: 'Completadas' },
      { id: FILTER_IDS.BLOCKED, label: 'Bloqueadas' },
      { id: FILTER_IDS.WAITING, label: 'En espera' },
      { id: FILTER_IDS.QUICK, label: 'Rapidas' },
      { id: FILTER_IDS.HIGH_IMPACT, label: 'Alto impacto' },
    ];
  }

  getDynamicFilters(tasks) {
    const projects = new Set();
    const areas = new Set();
    const energies = new Set();

    tasks.forEach(task => {
      if (task.project) projects.add(task.project);
      if (task.area) areas.add(task.area);
      if (task.energy) energies.add(task.energy);
    });

    return [
      ...Array.from(projects).map(project => ({ id: `project:${project}`, label: project })),
      ...Array.from(areas).map(area => ({ id: `area:${area}`, label: area })),
      ...Array.from(energies).map(energy => ({ id: `energy:${energy}`, label: `Energia ${energy}` })),
    ];
  }
}

export class TaskFilterService {
  apply(tasks, filterId, { referenceDate = new Date() } = {}) {
    if (filterId === FILTER_IDS.COMPLETED) {
      return tasks.filter(task => task.status === TASK_STATUS.COMPLETED);
    }

    const baseTasks = tasks.filter(task => task.status !== TASK_STATUS.COMPLETED);

    if (!filterId || filterId === FILTER_IDS.TODAY) {
      return baseTasks.filter(task => {
        const relevant = task.getRelevantDate();
        if (!relevant) return false;
        return isSameDay(new Date(relevant), referenceDate);
      });
    }

    if (filterId === FILTER_IDS.THIS_WEEK) {
      return baseTasks.filter(task => {
        const relevant = task.getRelevantDate();
        if (!relevant) return false;
        return isSameWeek(new Date(relevant), referenceDate);
      });
    }

    if (filterId === FILTER_IDS.OVERDUE) {
      return baseTasks.filter(task => task.dueAt && new Date(task.dueAt) < referenceDate);
    }

    if (filterId === FILTER_IDS.NO_DATE) {
      return baseTasks.filter(task => !task.getRelevantDate());
    }

    if (filterId === FILTER_IDS.BLOCKED) {
      return baseTasks.filter(task => task.status === TASK_STATUS.BLOCKED);
    }

    if (filterId === FILTER_IDS.WAITING) {
      return baseTasks.filter(task => task.status === TASK_STATUS.WAITING);
    }

    if (filterId === FILTER_IDS.QUICK) {
      return baseTasks.filter(task => task.effortMinutes <= 15);
    }

    if (filterId === FILTER_IDS.HIGH_IMPACT) {
      return baseTasks.filter(task => task.priority === 'high' || task.impact === 'high');
    }

    if (filterId.startsWith('project:')) {
      return baseTasks.filter(task => task.project === filterId.slice(8));
    }

    if (filterId.startsWith('area:')) {
      return baseTasks.filter(task => task.area === filterId.slice(5));
    }

    if (filterId.startsWith('energy:')) {
      return baseTasks.filter(task => task.energy === filterId.slice(7));
    }

    return baseTasks;
  }
}

export class TaskVisibilityPlanner {
  constructor(service = new TaskFilterService()) {
    this.service = service;
  }

  isVisible(task, filterId, options = {}) {
    return this.service.apply([task], filterId, options).length > 0;
  }

  getPreferredFilter(task, { referenceDate = new Date() } = {}) {
    if (!task) return FILTER_IDS.TODAY;

    if (task.status === TASK_STATUS.COMPLETED || task.isCompleted?.()) {
      return FILTER_IDS.COMPLETED;
    }

    const relevantDate = task.getRelevantDate?.();
    if (!relevantDate) {
      return FILTER_IDS.NO_DATE;
    }

    const parsedDate = new Date(relevantDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return FILTER_IDS.NO_DATE;
    }

    if (task.dueAt && new Date(task.dueAt) < referenceDate) {
      return FILTER_IDS.OVERDUE;
    }

    if (isSameDay(parsedDate, referenceDate)) {
      return FILTER_IDS.TODAY;
    }

    if (isSameWeek(parsedDate, referenceDate)) {
      return FILTER_IDS.THIS_WEEK;
    }

    return null;
  }

  resolveVisibleFilter(task, currentFilterId, options = {}) {
    if (currentFilterId && this.isVisible(task, currentFilterId, options)) {
      return currentFilterId;
    }

    return this.getPreferredFilter(task, options);
  }
}
