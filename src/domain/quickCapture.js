import { es as chronoEs, parse as parseChrono } from 'chrono-node';
import { TASK_DATE_PRECISION, TASK_PRIORITY, TASK_STATUS } from './tasks';

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

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniqueFragments(fragments = []) {
  return Array.from(new Set(
    fragments
      .map(fragment => normalizeText(fragment))
      .filter(Boolean),
  ));
}

function extractTime(value) {
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1] ?? match[4]);
  const minutes = Number(match[2] || 0);
  const meridiem = (match[3] ?? match[5])?.toLowerCase();

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

function splitCaptureText(raw = '') {
  const lines = normalizeText(raw)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return {
    headline: lines[0] ?? '',
    extraNotes: lines.slice(1).join('\n').trim(),
    fullText: lines.join('\n').trim(),
  };
}

function removeFragments(value, fragments = []) {
  return uniqueFragments(fragments).reduce((current, fragment) => {
    if (!fragment) return current;
    const escapedFragment = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current.replace(new RegExp(escapedFragment, 'ig'), ' ');
  }, value);
}

function cleanTitle(value, fragments) {
  return removeFragments(value, fragments)
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEmptyInterpretation() {
  return {
    title: '',
    notes: '',
    dueAt: '',
    dueAtPrecision: '',
    followUpAt: '',
    followUpAtPrecision: '',
    priority: TASK_PRIORITY.MEDIUM,
    status: TASK_STATUS.ACTIVE,
    tags: [],
    project: '',
    area: '',
    effortMinutes: null,
    recurrence: { preset: 'none', interval: 1, mode: 'fixed', resetNotes: true },
  };
}

class CaptureTextDocument {
  constructor(input = '') {
    const raw = normalizeText(input);
    const { headline, extraNotes, fullText } = splitCaptureText(raw);
    this.raw = raw;
    this.headline = headline;
    this.extraNotes = extraNotes;
    this.fullText = fullText;
    this.normalizedHeadline = normalizeSearchText(headline);
    this.normalizedFullText = normalizeSearchText(fullText);
  }

  hasContent() {
    return Boolean(this.raw);
  }
}

class CaptureDateResolver {
  resolve(document, referenceDate, fragments) {
    if (!document?.fullText) return null;

    const manualResult = this.resolveRelativeSpanishDate(document.fullText, referenceDate, fragments);
    if (manualResult) {
      return manualResult;
    }

    return this.resolveChronoDate(document.fullText, referenceDate, fragments);
  }

  resolveRelativeSpanishDate(value, referenceDate, fragments) {
    const time = extractTime(value);
    if (time) {
      fragments.push(time.fragment);
    }

    const todayMatch = value.match(/\bhoy\b/i);
    if (todayMatch) {
      fragments.push(todayMatch[0]);
      return {
        value: setTimeOnDate(referenceDate, time?.hours ?? 23, time?.minutes ?? 59),
        precision: time ? TASK_DATE_PRECISION.DATETIME : TASK_DATE_PRECISION.DATE,
      };
    }

    const tomorrowMatch = value.match(/\b(mañana|manana)\b/i);
    if (tomorrowMatch) {
      fragments.push(tomorrowMatch[0]);
      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + 1);
      return {
        value: setTimeOnDate(nextDate, time?.hours ?? 23, time?.minutes ?? 59),
        precision: time ? TASK_DATE_PRECISION.DATETIME : TASK_DATE_PRECISION.DATE,
      };
    }

    const inDaysMatch = value.match(/\ben\s+(\d+)\s+dias\b/i);
    if (inDaysMatch) {
      fragments.push(inDaysMatch[0]);
      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + Number(inDaysMatch[1]));
      return {
        value: setTimeOnDate(nextDate, time?.hours ?? 23, time?.minutes ?? 59),
        precision: time ? TASK_DATE_PRECISION.DATETIME : TASK_DATE_PRECISION.DATE,
      };
    }

    for (const [name, weekday] of Object.entries(WEEKDAY_MAP)) {
      const weekdayMatch = value.match(new RegExp(`\\b${name}\\b`, 'i'));
      if (weekdayMatch) {
        fragments.push(weekdayMatch[0]);
        return {
          value: setTimeOnDate(nextWeekday(referenceDate, weekday), time?.hours ?? 23, time?.minutes ?? 59),
          precision: time ? TASK_DATE_PRECISION.DATETIME : TASK_DATE_PRECISION.DATE,
        };
      }
    }

    return null;
  }

  resolveChronoDate(value, referenceDate, fragments) {
    const parserOptions = { forwardDate: true };
    const candidates = [
      ...chronoEs.parse(value, referenceDate, parserOptions),
      ...parseChrono(value, referenceDate, parserOptions),
    ];

    if (!candidates.length) {
      return null;
    }

    const [bestCandidate] = candidates
      .filter(candidate => candidate?.start?.date instanceof Function)
      .sort((left, right) => `${right.text ?? ''}`.length - `${left.text ?? ''}`.length);

    if (!bestCandidate) {
      return null;
    }

    const candidateDate = bestCandidate.start.date();
    if (Number.isNaN(candidateDate.getTime())) {
      return null;
    }

    fragments.push(bestCandidate.text);

    const hasExplicitTime = bestCandidate.start.isCertain('hour') || bestCandidate.start.isCertain('minute');
    if (hasExplicitTime) {
      return {
        value: candidateDate,
        precision: TASK_DATE_PRECISION.DATETIME,
      };
    }

    const nextDate = new Date(candidateDate);
    nextDate.setHours(23, 59, 0, 0);
    return {
      value: nextDate,
      precision: TASK_DATE_PRECISION.DATE,
    };
  }
}

class CaptureMetadataExtractor {
  extract(document, fragments) {
    const raw = document.fullText;
    const tags = Array.from(raw.matchAll(/#([\p{L}\p{N}-]+)/gu)).map(match => {
      fragments.push(match[0]);
      return match[1];
    });

    const projectMatch = raw.match(/\+([\p{L}\p{N}-]+)/u);
    let project = projectMatch?.[1] ?? '';
    if (projectMatch) {
      fragments.push(projectMatch[0]);
    }

    const professionalProjectMatch = raw.match(/\b(?:cliente|proyecto|project):\s*([\p{L}\p{N}\s-]+)/iu);
    if (professionalProjectMatch && !project) {
      project = normalizeText(professionalProjectMatch[1]).split(/\s+/)[0] ?? '';
      fragments.push(professionalProjectMatch[0]);
    }

    const areaMatch = raw.match(/\barea:\s*([\p{L}\p{N}\s-]+)/iu);
    const area = areaMatch ? normalizeText(areaMatch[1]).split(/\s+/)[0] ?? '' : '';
    if (areaMatch) {
      fragments.push(areaMatch[0]);
    }

    let priority = TASK_PRIORITY.MEDIUM;
    const highPriorityMatch = raw.match(/\b(urgente|importante|alta prioridad|critico|crítico)\b/i);
    const lowPriorityMatch = raw.match(/\b(baja prioridad|cuando puedas|sin prisa)\b/i);

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

    const blockedMatch = raw.match(/\b(bloquead[ao]|depende de|esperando insumo)\b/i);
    const waitingMatch = raw.match(/\b(seguimiento|follow-?up|esperando respuesta|pendiente de respuesta)\b/i);
    const status = blockedMatch
      ? TASK_STATUS.BLOCKED
      : (waitingMatch ? TASK_STATUS.WAITING : TASK_STATUS.ACTIVE);
    if (blockedMatch) {
      fragments.push(blockedMatch[0]);
    }
    if (waitingMatch) {
      fragments.push(waitingMatch[0]);
    }

    return {
      tags,
      project,
      area,
      priority,
      effortMinutes,
      status,
    };
  }
}

class CaptureRecurrenceExtractor {
  extract(value, fragments) {
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
}

class CaptureTaskBuilder {
  build(document, fragments, metadata, recurrence, detectedDate) {
    const headlineCandidate = cleanTitle(document.headline || document.raw, fragments);
    const title = headlineCandidate || document.headline || document.raw;
    const notes = document.extraNotes || '';
    const dueAt = metadata.status === TASK_STATUS.WAITING ? null : detectedDate;
    const followUpAt = metadata.status === TASK_STATUS.WAITING ? detectedDate : null;

    return {
      title,
      notes,
      dueAt: dueAt?.value ? dueAt.value.toISOString() : '',
      dueAtPrecision: dueAt?.precision ?? '',
      followUpAt: followUpAt?.value ? followUpAt.value.toISOString() : '',
      followUpAtPrecision: followUpAt?.precision ?? '',
      priority: metadata.priority,
      status: metadata.status,
      tags: metadata.tags,
      project: metadata.project,
      area: metadata.area,
      effortMinutes: metadata.effortMinutes,
      recurrence,
    };
  }
}

export class QuickCaptureInterpreter {
  constructor({
    dateResolver = new CaptureDateResolver(),
    metadataExtractor = new CaptureMetadataExtractor(),
    recurrenceExtractor = new CaptureRecurrenceExtractor(),
    taskBuilder = new CaptureTaskBuilder(),
  } = {}) {
    this.dateResolver = dateResolver;
    this.metadataExtractor = metadataExtractor;
    this.recurrenceExtractor = recurrenceExtractor;
    this.taskBuilder = taskBuilder;
  }

  interpret(input, referenceDate = new Date()) {
    const document = new CaptureTextDocument(input);
    if (!document.hasContent()) {
      return buildEmptyInterpretation();
    }

    const fragments = [];
    const metadata = this.metadataExtractor.extract(document, fragments);
    const recurrence = this.recurrenceExtractor.extract(document.fullText, fragments);
    const detectedDate = this.dateResolver.resolve(document, referenceDate, fragments);

    return this.taskBuilder.build(document, fragments, metadata, recurrence, detectedDate);
  }
}
