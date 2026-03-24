import { TASK_PRIORITY } from './tasks';

const WEEKDAY_MAP = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function setTimeOnDate(date, hours, minutes) {
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

function extractTime(value) {
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  }

  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  return { hours, minutes, fragment: match[0] };
}

function nextWeekday(referenceDate, weekday) {
  const nextDate = new Date(referenceDate);
  const currentDay = nextDate.getDay();
  let delta = (weekday - currentDay + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }

  nextDate.setDate(nextDate.getDate() + delta);
  return nextDate;
}

function cleanTitle(value, fragments) {
  return fragments
    .reduce((current, fragment) => current.replace(fragment, ' '), value)
    .replace(/\s+/g, ' ')
    .trim();
}

export class QuickCaptureInterpreter {
  interpret(input, referenceDate = new Date()) {
    const raw = `${input ?? ''}`.trim();
    if (!raw) {
      return {
        title: '',
        dueAt: '',
        priority: TASK_PRIORITY.MEDIUM,
        tags: [],
        project: '',
        area: '',
        effortMinutes: null,
        recurrence: { preset: 'none', mode: 'fixed', resetNotes: true },
      };
    }

    const fragments = [];
    const tags = Array.from(raw.matchAll(/#([\p{L}\p{N}-]+)/gu)).map(match => {
      fragments.push(match[0]);
      return match[1];
    });

    const projectMatch = raw.match(/\+([\p{L}\p{N}-]+)/u);
    const project = projectMatch?.[1] ?? '';
    if (projectMatch) {
      fragments.push(projectMatch[0]);
    }

    const areaMatch = raw.match(/area:([\p{L}\p{N}-]+)/iu);
    const area = areaMatch?.[1] ?? '';
    if (areaMatch) {
      fragments.push(areaMatch[0]);
    }

    let priority = TASK_PRIORITY.MEDIUM;
    const highPriorityMatch = raw.match(/\b(urgente|importante|alta prioridad)\b/i);
    const lowPriorityMatch = raw.match(/\b(baja prioridad|cuando puedas)\b/i);

    if (highPriorityMatch) {
      priority = TASK_PRIORITY.HIGH;
      fragments.push(highPriorityMatch[0]);
    } else if (lowPriorityMatch) {
      priority = TASK_PRIORITY.LOW;
      fragments.push(lowPriorityMatch[0]);
    }

    let effortMinutes = null;
    const effortMatch = raw.match(/\b(\d{1,3})\s*(m|min)\b/i);
    if (effortMatch) {
      effortMinutes = Number(effortMatch[1]);
      fragments.push(effortMatch[0]);
    } else if (/\b(rapida|rapido|rápida|rápido)\b/i.test(raw)) {
      effortMinutes = 10;
    }

    const recurrence = this.extractRecurrence(raw, fragments);
    const dueAt = this.extractDueDate(raw, referenceDate, fragments);
    const title = cleanTitle(raw, fragments) || raw;

    return {
      title,
      dueAt: dueAt ? dueAt.toISOString() : '',
      priority,
      tags,
      project,
      area,
      effortMinutes,
      recurrence,
    };
  }

  extractRecurrence(value, fragments) {
    const everyXDays = value.match(/\bcada\s+(\d+)\s+dias\b/i);
    if (everyXDays) {
      fragments.push(everyXDays[0]);
      return {
        preset: 'every-x-days',
        interval: Number(everyXDays[1]),
        mode: /\bdespues de completar\b/i.test(value) ? 'after-completion' : 'fixed',
        resetNotes: true,
      };
    }

    const presets = [
      ['weekdays', /\bdias laborables\b/i],
      ['weekends', /\bfines de semana\b/i],
      ['daily', /\bcada dia\b/i],
      ['weekly', /\bcada semana\b/i],
      ['monthly', /\bcada mes\b/i],
      ['yearly', /\bcada año\b|\bcada ano\b/i],
    ];

    for (const [preset, matcher] of presets) {
      const match = value.match(matcher);
      if (match) {
        fragments.push(match[0]);
        return {
          preset,
          interval: 1,
          mode: /\bdespues de completar\b/i.test(value) ? 'after-completion' : 'fixed',
          resetNotes: true,
        };
      }
    }

    return {
      preset: 'none',
      interval: 1,
      mode: 'fixed',
      resetNotes: true,
    };
  }

  extractDueDate(value, referenceDate, fragments) {
    const time = extractTime(value);
    if (time) {
      fragments.push(time.fragment);
    }

    const todayMatch = value.match(/\bhoy\b/i);
    if (todayMatch) {
      fragments.push(todayMatch[0]);
      return setTimeOnDate(referenceDate, time?.hours ?? 9, time?.minutes ?? 0);
    }

    const tomorrowMatch = value.match(/\b(mañana|manana)\b/i);
    if (tomorrowMatch) {
      fragments.push(tomorrowMatch[0]);
      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + 1);
      return setTimeOnDate(nextDate, time?.hours ?? 9, time?.minutes ?? 0);
    }

    const inDaysMatch = value.match(/\ben\s+(\d+)\s+dias\b/i);
    if (inDaysMatch) {
      fragments.push(inDaysMatch[0]);
      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + Number(inDaysMatch[1]));
      return setTimeOnDate(nextDate, time?.hours ?? 9, time?.minutes ?? 0);
    }

    for (const [name, weekday] of Object.entries(WEEKDAY_MAP)) {
      const weekdayMatch = value.match(new RegExp(`\\b${name}\\b`, 'i'));
      if (weekdayMatch) {
        fragments.push(weekdayMatch[0]);
        return setTimeOnDate(nextWeekday(referenceDate, weekday), time?.hours ?? 9, time?.minutes ?? 0);
      }
    }

    return null;
  }
}
