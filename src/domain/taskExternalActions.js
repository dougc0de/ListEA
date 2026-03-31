const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/i;

const KNOWN_LINK_ACTIONS = [
  { id: 'meeting-link', host: 'meet.google.com', label: 'Abrir Meet', priority: 10 },
  { id: 'meeting-link', host: 'zoom.us', label: 'Abrir Zoom', priority: 10 },
  { id: 'meeting-link', host: 'teams.microsoft.com', label: 'Abrir Teams', priority: 10 },
  { id: 'whatsapp', host: 'wa.me', label: 'WhatsApp', priority: 20 },
  { id: 'whatsapp', host: 'web.whatsapp.com', label: 'WhatsApp', priority: 20 },
];

const KEYWORDS = Object.freeze({
  whatsapp: /\b(whatsapp|wsp|wa)\b/i,
  email: /\b(correo|email|gmail|mail)\b/i,
  sms: /\b(sms|texto)\b/i,
  phone: /\b(llamar|telefono|call)\b/i,
  calendar: /\b(calendario|calendar|gcal|google calendar|reunion|meeting)\b/i,
});

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function extractFirstMatch(pattern, text) {
  const match = normalizeText(text).match(pattern);
  return match?.[0] ?? '';
}

function extractUrls(text) {
  return (normalizeText(text).match(URL_PATTERN) ?? []).map(url => url.replace(/[),.;]+$/, ''));
}

function normalizePhone(rawPhone = '') {
  const trimmed = normalizeText(rawPhone);
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  return `${hasPlus ? '+' : ''}${digits}`;
}

function buildTaskMessage(task = {}) {
  const fragments = [normalizeText(task.title)];

  if (task.project) {
    fragments.push(`Proyecto: ${normalizeText(task.project)}`);
  }

  if (task.dueAt) {
    fragments.push(`Fecha: ${normalizeText(task.dueAt)}`);
  } else if (task.followUpAt) {
    fragments.push(`Seguimiento: ${normalizeText(task.followUpAt)}`);
  }

  if (task.notes) {
    fragments.push(normalizeText(task.notes));
  }

  return fragments.filter(Boolean).join('\n');
}

function buildCalendarDates(task = {}) {
  const startValue = task.dueAt || task.followUpAt;
  if (!startValue) return '';

  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) return '';

  const durationMinutes = Number(task.effortMinutes) > 0 ? Number(task.effortMinutes) : 30;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const format = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${format(startDate)}/${format(endDate)}`;
}

function hasKeyword(text, pattern) {
  return pattern.test(normalizeText(text));
}

function getKnownLinkAction(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const knownLink = KNOWN_LINK_ACTIONS.find(item => host.includes(item.host));
    if (!knownLink) return null;

    return {
      id: knownLink.id,
      label: knownLink.label,
      url,
      priority: knownLink.priority,
    };
  } catch {
    return null;
  }
}

function isCompletedTask(task = {}) {
  if (typeof task.isCompleted === 'function') {
    return task.isCompleted();
  }

  return Boolean(task.completedAt) || task.status === 'completed';
}

export class TaskExternalActionResolver {
  resolve(task = {}) {
    if (isCompletedTask(task)) {
      return [];
    }

    const title = normalizeText(task.title);
    const notes = normalizeText(task.notes);
    const tags = Array.isArray(task.tags) ? task.tags.join(' ') : normalizeText(task.tags);
    const combinedText = `${title}\n${notes}\n${tags}`;
    const message = buildTaskMessage(task);
    const email = extractFirstMatch(EMAIL_PATTERN, combinedText);
    const phone = normalizePhone(extractFirstMatch(PHONE_PATTERN, combinedText));
    const urls = extractUrls(combinedText);
    const actions = [];

    for (const url of urls) {
      const knownAction = getKnownLinkAction(url);
      if (knownAction) {
        actions.push(knownAction);
      }
    }

    if (!actions.length && urls[0]) {
      actions.push({
        id: 'generic-link',
        label: 'Abrir enlace',
        url: urls[0],
        priority: 70,
      });
    }

    if (phone && hasKeyword(combinedText, KEYWORDS.whatsapp)) {
      const baseUrl = phone
        ? `https://wa.me/${phone.replace(/^\+/, '')}`
        : 'https://wa.me/';
      actions.push({
        id: 'whatsapp',
        label: 'WhatsApp',
        url: `${baseUrl}?text=${encodeURIComponent(message)}`,
        priority: 20,
      });
    }

    if (email || hasKeyword(combinedText, KEYWORDS.email)) {
      actions.push({
        id: 'email',
        label: 'Correo',
        url: `mailto:${email}?subject=${encodeURIComponent(title || 'Pendiente desde ListEA')}&body=${encodeURIComponent(message)}`,
        priority: 30,
      });
    }

    if (phone && hasKeyword(combinedText, KEYWORDS.sms)) {
      actions.push({
        id: 'sms',
        label: 'SMS',
        url: `sms:${phone}?body=${encodeURIComponent(message)}`,
        priority: 40,
      });
    }

    if (phone && hasKeyword(combinedText, KEYWORDS.phone)) {
      actions.push({
        id: 'call',
        label: 'Llamar',
        url: `tel:${phone}`,
        priority: 50,
      });
    }

    if ((task.dueAt || task.followUpAt) && hasKeyword(combinedText, KEYWORDS.calendar)) {
      const calendarDates = buildCalendarDates(task);
      if (calendarDates) {
        actions.push({
          id: 'calendar',
          label: 'Calendario',
          url: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || 'Evento desde ListEA')}&details=${encodeURIComponent(message)}&dates=${encodeURIComponent(calendarDates)}`,
          priority: 60,
        });
      }
    }

    return actions
      .sort((left, right) => left.priority - right.priority)
      .filter((action, index, collection) => collection.findIndex(item => item.id === action.id) === index)
      .slice(0, 4);
  }
}
