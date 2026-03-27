import { FILTER_IDS, TaskFilterService } from '../domain/filters';
import { BacklogInsightAnalyzer } from '../domain/insights';
import logoUrl from '../assets/logo.png';

const filterService = new TaskFilterService();
const insightAnalyzer = new BacklogInsightAnalyzer();

const PAGE_MARGIN = 28;
const SECTION_GAP = 16;
const MAX_VISIBLE_ITEMS = 10;

const COLORS = Object.freeze({
  page: '#eaf4fb',
  panel: '#f7fbfe',
  panelAlt: '#edf5fb',
  stroke: '#a8c5db',
  brand: '#ff5a4f',
  title: '#0a4e82',
  text: '#173d5b',
  muted: '#607d96',
  soft: '#dcebf6',
  white: '#ffffff',
  completed: '#1f6f9d',
  deleted: '#d97d50',
  overdue: '#b34b3b',
  incomplete: '#4c7d60',
});

const CATEGORY_DEFINITIONS = Object.freeze([
  {
    id: 'completed',
    label: 'Completadas',
    description: 'Tareas que fueron hechas con exito.',
    color: COLORS.completed,
  },
  {
    id: 'deleted',
    label: 'Eliminadas',
    description: 'Tareas eliminadas antes de ejecutarse, por lo que no llegaron a cumplirse.',
    color: COLORS.deleted,
  },
  {
    id: 'overdue',
    label: 'Vencidas',
    description: 'Tareas con fecha que quedaron pendientes despues del momento previsto.',
    color: COLORS.overdue,
  },
  {
    id: 'incomplete',
    label: 'Incompletas',
    description: 'Tareas activas que siguen abiertas dentro del rango observado.',
    color: COLORS.incomplete,
  },
]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hexToRgb(value) {
  const normalized = `${value}`.replace('#', '');
  if (normalized.length !== 6) return [0, 0, 0];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function paint(doc, method, color) {
  const [r, g, b] = hexToRgb(color);
  doc[method](r, g, b);
}

function fillColor(doc, color) {
  paint(doc, 'setFillColor', color);
}

function drawColor(doc, color) {
  paint(doc, 'setDrawColor', color);
}

function textColor(doc, color) {
  paint(doc, 'setTextColor', color);
}

function mixHex(base, target, ratio = 0.5) {
  const amount = clamp(ratio, 0, 1);
  const start = hexToRgb(base);
  const end = hexToRgb(target);
  const mixed = start.map((value, index) => Math.round(value + ((end[index] - value) * amount)));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date);
}

function formatTaskCountLabel(value, suffix = 'activas') {
  return `${value} ${value === 1 ? 'tarea' : 'tareas'} ${suffix}`.trim();
}

function parseSafeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isCompletedTask(task) {
  return task?.isCompleted?.() || task?.status === 'completed';
}

function getActiveTasks(tasks = []) {
  return tasks.filter(task => !isCompletedTask(task));
}

function getCompletedTasks(tasks = []) {
  return tasks
    .filter(task => isCompletedTask(task))
    .slice()
    .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt));
}

function getVisibleAnalyticsEvents(analytics, types = []) {
  const events = Array.isArray(analytics?.events) ? analytics.events : [];
  return types.length ? events.filter(event => types.includes(event.type)) : events;
}

function resolveTaskDate(task) {
  const rawValue = task?.getRelevantDate?.() || task?.dueAt || task?.followUpAt || task?.createdAt;
  if (!rawValue) return null;
  return parseSafeDate(rawValue);
}

function resolveDueDate(task) {
  return task?.dueAt ? parseSafeDate(task.dueAt) : null;
}

function isDateInRange(date, range) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (!range?.start || !range?.end) return true;
  return date >= range.start && date <= range.end;
}

function formatHourRange(hour) {
  if (!Number.isFinite(hour)) return 'Sin datos suficientes';
  return `${`${hour}`.padStart(2, '0')}:00 - ${`${(hour + 1) % 24}`.padStart(2, '0')}:00`;
}

function getBestHourRange(analytics) {
  const hourMap = new Map();
  getVisibleAnalyticsEvents(analytics, ['completed', 'deleted_after_completion']).forEach(event => {
    const date = parseSafeDate(event.happenedAt);
    if (!date) return;
    const hour = date.getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  });

  const bestHour = Array.from(hourMap.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  return formatHourRange(bestHour);
}

function getMostPostponedCategory(tasks = [], analytics) {
  const labels = new Map();

  getActiveTasks(tasks)
    .filter(task => task?.dueAt && new Date(task.dueAt) < new Date())
    .forEach(task => {
      const label = task.project || task.area || task.tags?.[0] || 'General';
      labels.set(label, (labels.get(label) ?? 0) + 1);
    });

  if (!labels.size) {
    getVisibleAnalyticsEvents(analytics, ['deleted']).forEach(event => {
      const label = event.project || event.area || 'General';
      labels.set(label, (labels.get(label) ?? 0) + 1);
    });
  }

  return Array.from(labels.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Sin categoria dominante';
}

function getWeekStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function buildWeeklyBars(tasks = [], analytics, referenceDate = new Date()) {
  const lastWeekStart = getWeekStart(referenceDate);
  return Array.from({ length: 6 }, (_, index) => {
    const weekStart = new Date(lastWeekStart);
    weekStart.setDate(weekStart.getDate() - (5 - index) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const completed = getVisibleAnalyticsEvents(analytics, ['completed', 'deleted_after_completion'])
      .filter(event => {
        const date = parseSafeDate(event.happenedAt);
        return date && date >= weekStart && date < weekEnd;
      })
      .length;

    const created = tasks.filter(task => {
      const date = parseSafeDate(task.createdAt);
      return date && date >= weekStart && date < weekEnd;
    }).length;

    return { label: formatShortDate(weekStart), completed, created };
  });
}

function buildCompletedItems(tasks = []) {
  return getCompletedTasks(tasks).slice(0, 7).map(task => ({
    title: task.title || 'Tarea sin titulo',
    tag: task.tags?.[0] || task.project || task.area || 'General',
    completedAtLabel: formatDateTime(task.completedAt),
  }));
}

function buildPremiumInsights(tasks = []) {
  return insightAnalyzer
    .analyze(getActiveTasks(tasks), { referenceDate: new Date() })
    .map(item => item.message)
    .slice(0, 5);
}

function buildActivityItem({ id, title, tag, whenLabel, detail }) {
  return {
    id: id || `${title}-${whenLabel}`,
    title: title || 'Tarea sin titulo',
    tag: tag || 'General',
    whenLabel: whenLabel || 'Sin fecha',
    detail: detail || 'Sin contexto adicional',
  };
}

function buildActivityGroups(tasks = [], analytics, dashboard) {
  const range = {
    start: parseSafeDate(dashboard?.range?.startDate),
    end: parseSafeDate(dashboard?.range?.endDate),
  };
  const referenceDate = new Date();
  const activeTasks = getActiveTasks(tasks);
  const events = Array.isArray(analytics?.events) ? analytics.events : [];

  const completed = events
    .filter(event => ['completed', 'deleted_after_completion'].includes(event.type))
    .filter(event => isDateInRange(parseSafeDate(event.happenedAt), range))
    .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt))
    .map(event => buildActivityItem({
      id: event.id,
      title: event.title,
      tag: event.project || event.area || 'General',
      whenLabel: formatDateTime(event.happenedAt),
      detail: event.type === 'deleted_after_completion'
        ? 'Completada y luego retirada de la vista activa.'
        : 'Marcada como completada dentro del rango observado.',
    }));

  const deleted = events
    .filter(event => event.type === 'deleted')
    .filter(event => isDateInRange(parseSafeDate(event.happenedAt), range))
    .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt))
    .map(event => buildActivityItem({
      id: event.id,
      title: event.title,
      tag: event.project || event.area || 'General',
      whenLabel: formatDateTime(event.happenedAt),
      detail: 'Eliminada antes de llegar a completarse.',
    }));

  const overdue = activeTasks
    .filter(task => {
      const taskDate = resolveTaskDate(task);
      const dueDate = resolveDueDate(task);
      return dueDate && dueDate < referenceDate && isDateInRange(taskDate, range);
    })
    .sort((left, right) => (resolveDueDate(left)?.getTime() ?? 0) - (resolveDueDate(right)?.getTime() ?? 0))
    .map(task => buildActivityItem({
      id: task.id,
      title: task.title,
      tag: task.project || task.area || task.tags?.[0] || 'General',
      whenLabel: formatDateTime(task.dueAt),
      detail: 'Sigue abierta aunque ya paso su fecha objetivo.',
    }));

  const incomplete = activeTasks
    .filter(task => {
      const taskDate = resolveTaskDate(task);
      const dueDate = resolveDueDate(task);
      return isDateInRange(taskDate, range) && !(dueDate && dueDate < referenceDate);
    })
    .sort((left, right) => (resolveTaskDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (resolveTaskDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .map(task => buildActivityItem({
      id: task.id,
      title: task.title,
      tag: task.project || task.area || task.tags?.[0] || 'General',
      whenLabel: resolveTaskDate(task) ? formatDateTime(resolveTaskDate(task)) : 'Sin fecha definida',
      detail: 'Permanece activa y todavia puede ejecutarse.',
    }));

  return CATEGORY_DEFINITIONS.map(definition => ({
    ...definition,
    items: { completed, deleted, overdue, incomplete }[definition.id] || [],
  }));
}

export function buildListeaReportData({
  appName = 'ListEA',
  dashboard,
  tasks = [],
  analytics,
  visibleCategoryLabels = [],
} = {}) {
  const activeTasks = getActiveTasks(tasks);
  const completedItems = buildCompletedItems(tasks);
  const referenceDate = parseSafeDate(dashboard?.range?.endDate) || new Date();

  return {
    appName,
    generatedAtLabel: formatDateTime(new Date()),
    periodLabel: dashboard?.range?.label || 'Sin rango',
    summary: {
      open: activeTasks.length,
      today: filterService.apply(activeTasks, FILTER_IDS.TODAY, { referenceDate: new Date() }).length,
      overdue: filterService.apply(activeTasks, FILTER_IDS.OVERDUE, { referenceDate: new Date() }).length,
    },
    activeWindow: {
      totalTasksLabel: formatTaskCountLabel(activeTasks.length),
      today: filterService.apply(activeTasks, FILTER_IDS.TODAY, { referenceDate }).length,
      thisWeek: filterService.apply(activeTasks, FILTER_IDS.THIS_WEEK, { referenceDate }).length,
      overdue: filterService.apply(activeTasks, FILTER_IDS.OVERDUE, { referenceDate }).length,
      noDate: filterService.apply(activeTasks, FILTER_IDS.NO_DATE, { referenceDate }).length,
    },
    productivity: {
      completionRate: dashboard?.summary?.completionRate ?? 0,
      bestHourRange: getBestHourRange(analytics),
      mostPostponedCategory: getMostPostponedCategory(tasks, analytics),
      weeklyBars: buildWeeklyBars(tasks, analytics, referenceDate),
      categoryBreakdown: CATEGORY_DEFINITIONS.map(category => ({
        ...category,
        value: dashboard?.summary?.[category.id] ?? 0,
      })),
    },
    completed: {
      totalLabel: formatTaskCountLabel(completedItems.length, 'completadas'),
      items: completedItems,
    },
    premiumInsights: buildPremiumInsights(tasks),
    visibleCategoryLabels,
    activityGroups: buildActivityGroups(tasks, analytics, dashboard),
  };
}

export function buildListeaReportHTML(data) {
  const completedRows = data.completed.items.length
    ? data.completed.items.map(item => `
      <div class="task-row">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.tag)}</span>
        <span>${escapeHtml(item.completedAtLabel)}</span>
      </div>
    `).join('')
    : '<div class="task-row"><strong>Sin tareas completadas</strong><span>Sin datos</span><span>-</span></div>';

  const activityGroups = data.activityGroups.map(group => `
    <section class="activity-group">
      <h3>${escapeHtml(group.label)} (${group.items.length})</h3>
      <p>${escapeHtml(group.description)}</p>
    </section>
  `).join('');

  return `
    <main class="page">
      <h1>${escapeHtml(data.appName)} - Reporte Premium</h1>
      <p>Periodo: ${escapeHtml(data.periodLabel)}</p>
      <section class="summary">
        <article><strong>${data.summary.open}</strong><span>Abiertas</span></article>
        <article><strong>${data.summary.today}</strong><span>Para hoy</span></article>
        <article><strong>${data.summary.overdue}</strong><span>Vencidas</span></article>
      </section>
      <section class="completed">${completedRows}</section>
      ${activityGroups}
    </main>
  `;
}

function ensurePageSpace(doc, cursor, heightNeeded) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursor.y + heightNeeded <= pageHeight - PAGE_MARGIN) return;
  doc.addPage();
  fillColor(doc, COLORS.page);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
  cursor.y = PAGE_MARGIN;
}

function drawPanel(doc, x, y, width, height, options = {}) {
  fillColor(doc, options.fill || COLORS.panel);
  drawColor(doc, options.stroke || COLORS.stroke);
  doc.setLineWidth(options.lineWidth ?? 1);
  doc.roundedRect(x, y, width, height, options.radius ?? 16, options.radius ?? 16, 'FD');
}

function drawTextBlock(doc, text, x, y, options = {}) {
  doc.setFont('helvetica', options.fontStyle || 'normal');
  doc.setFontSize(options.size || 11);
  textColor(doc, options.color || COLORS.text);
  const width = options.width || 120;
  const lines = Array.isArray(text) ? text : doc.splitTextToSize(`${text ?? ''}`, width);
  doc.text(lines, x, y, {
    align: options.align || 'left',
    baseline: 'top',
    lineHeightFactor: options.lineHeight || 1.2,
  });
  return lines.length * (options.size || 11) * (options.lineHeight || 1.2);
}

function getTextLines(doc, text, width, options = {}) {
  doc.setFont('helvetica', options.fontStyle || 'normal');
  doc.setFontSize(options.size || 11);
  return doc.splitTextToSize(`${text ?? ''}`, width);
}

function getTextHeight(lines, size, lineHeight = 1.2) {
  return lines.length * size * lineHeight;
}

function drawTag(doc, text, x, y, color) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const width = doc.getTextWidth(text) + 20;
  drawPanel(doc, x, y, width, 22, {
    fill: mixHex(color, COLORS.white, 0.82),
    stroke: mixHex(color, COLORS.stroke, 0.4),
    radius: 11,
  });
  drawTextBlock(doc, text, x + 10, y + 6, {
    width: width - 20,
    size: 9,
    color,
    fontStyle: 'bold',
  });
  return width;
}

function drawMetricCard(doc, x, y, width, height, metric) {
  drawPanel(doc, x, y, width, height, {
    fill: mixHex(metric.accent, COLORS.white, 0.82),
    stroke: mixHex(metric.accent, COLORS.stroke, 0.44),
  });
  const valueText = `${metric.value ?? ''}`;
  const isDescriptor = metric.kind === 'descriptor';
  const valueSize = metric.size
    ?? (isDescriptor ? (valueText.length > 18 ? 10 : 11) : (valueText.length > 8 ? 18 : 23));
  const valueLines = getTextLines(doc, valueText, width - 28, {
    size: valueSize,
    fontStyle: 'bold',
  }).slice(0, isDescriptor ? 3 : 2);
  const valueHeight = getTextHeight(valueLines, valueSize, isDescriptor ? 1.15 : 1.05);

  drawTextBlock(doc, valueLines, x + 14, y + 12, {
    width: width - 28,
    size: valueSize,
    color: COLORS.title,
    fontStyle: 'bold',
    lineHeight: isDescriptor ? 1.15 : 1.05,
  });
  drawTextBlock(doc, metric.label, x + 14, y + 18 + valueHeight, {
    width: width - 28,
    size: 10,
    color: COLORS.text,
  });
}

function drawHeaderSection(doc, cursor, data, logoDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  const y = cursor.y;
  drawPanel(doc, x, y, width, 94, { radius: 22 });

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', x + 18, y + 18, 56, 56);
    } catch {}
  }

  drawTextBlock(doc, data.appName, x + 92, y + 22, {
    width: width - 250,
    size: 20,
    color: COLORS.brand,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, 'Reporte Premium de actividad', x + 92, y + 44, {
    width: width - 250,
    size: 17,
    color: COLORS.title,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, 'Tus estadisticas privadas, generadas localmente.', x + 92, y + 66, {
    width: width - 260,
    size: 10,
    color: COLORS.muted,
  });

  const metaWidth = 188;
  const metaX = x + width - metaWidth - 18;
  drawPanel(doc, metaX, y + 18, metaWidth, 34, {
    fill: COLORS.soft,
    stroke: COLORS.soft,
    lineWidth: 0,
    radius: 14,
  });
  const periodLines = getTextLines(doc, `Periodo: ${data.periodLabel}`, metaWidth - 24, {
    size: 8,
    fontStyle: 'bold',
  }).slice(0, 2);
  drawTextBlock(doc, periodLines, metaX + 12, y + 23, {
    width: metaWidth - 24,
    size: 8,
    color: COLORS.title,
    fontStyle: 'bold',
    align: 'center',
  });
  drawTextBlock(doc, `Generado: ${data.generatedAtLabel}`, metaX, y + 60, {
    width: metaWidth,
    size: 8,
    color: COLORS.muted,
    align: 'right',
  });

  cursor.y += 94 + SECTION_GAP;
}

function drawHeroSection(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  const y = cursor.y;
  drawPanel(doc, x, y, width, 156, { fill: COLORS.panelAlt, radius: 22 });
  drawTextBlock(doc, 'TODO EMPIEZA CON LO QUE ANOTAS.', x + 22, y + 22, {
    width: width - 44,
    size: 20,
    color: COLORS.title,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, 'Este reporte resume lo que hiciste, lo que pospusiste y lo que sigue pendiente dentro de tu flujo real.', x + 22, y + 52, {
    width: width - 44,
    size: 11,
    color: COLORS.muted,
  });

  const cardWidth = (width - 44 - 24) / 3;
  const cardY = y + 92;
  drawMetricCard(doc, x + 22, cardY, cardWidth, 48, {
    value: data.summary.open,
    label: 'Abiertas',
    accent: COLORS.completed,
  });
  drawMetricCard(doc, x + 22 + cardWidth + 12, cardY, cardWidth, 48, {
    value: data.summary.today,
    label: 'Para hoy',
    accent: COLORS.incomplete,
  });
  drawMetricCard(doc, x + 22 + ((cardWidth + 12) * 2), cardY, cardWidth, 48, {
    value: data.summary.overdue,
    label: 'Vencidas',
    accent: COLORS.overdue,
  });
  cursor.y += 156 + SECTION_GAP;
}

function drawActiveWindowSection(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  const y = cursor.y;
  drawPanel(doc, x, y, width, 146, { radius: 22 });
  drawTextBlock(doc, 'Activa / Hoy', x + 22, y + 22, {
    width: 240,
    size: 17,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, data.activeWindow.totalTasksLabel, x + width - 148, y + 26, {
    width: 126,
    size: 10,
    color: COLORS.muted,
    align: 'right',
  });

  const cardWidth = (width - 44 - 30) / 4;
  const metrics = [
    { label: 'Hoy', value: data.activeWindow.today, accent: COLORS.completed },
    { label: 'Esta semana', value: data.activeWindow.thisWeek, accent: COLORS.title },
    { label: 'Vencidas', value: data.activeWindow.overdue, accent: COLORS.overdue },
    { label: 'Sin fecha', value: data.activeWindow.noDate, accent: COLORS.incomplete },
  ];

  metrics.forEach((metric, index) => {
    drawMetricCard(doc, x + 22 + ((cardWidth + 10) * index), y + 62, cardWidth, 56, metric);
  });

  cursor.y += 146 + SECTION_GAP;
}

function drawWeeklyBars(doc, x, y, width, height, weeklyBars) {
  const maxValue = Math.max(...weeklyBars.map(item => Math.max(item.completed, item.created)), 1);
  const baseY = y + height - 20;
  const groupWidth = width / Math.max(weeklyBars.length, 1);
  drawColor(doc, COLORS.stroke);
  doc.setLineWidth(1);
  doc.line(x, baseY, x + width, baseY);

  weeklyBars.forEach((bar, index) => {
    const groupX = x + (groupWidth * index);
    const centerX = groupX + (groupWidth / 2);
    const completedHeight = Math.max(8, (bar.completed / maxValue) * (height - 44));
    const createdHeight = Math.max(8, (bar.created / maxValue) * (height - 44));

    fillColor(doc, COLORS.completed);
    doc.roundedRect(centerX - 16, baseY - completedHeight, 12, completedHeight, 4, 4, 'F');
    fillColor(doc, mixHex(COLORS.completed, COLORS.white, 0.5));
    doc.roundedRect(centerX + 4, baseY - createdHeight, 12, createdHeight, 4, 4, 'F');

    drawTextBlock(doc, bar.label, groupX, baseY + 8, {
      width: groupWidth,
      size: 8,
      color: COLORS.muted,
      align: 'center',
    });
  });
}

function drawCategoryBars(doc, x, y, width, categories) {
  const maxValue = Math.max(...categories.map(item => item.value), 1);
  categories.forEach((category, index) => {
    const rowY = y + (index * 24);
    drawTextBlock(doc, category.label, x, rowY + 4, {
      width: 88,
      size: 9,
      color: COLORS.text,
      fontStyle: 'bold',
    });
    const trackX = x + 92;
    const trackWidth = width - 126;
    drawPanel(doc, trackX, rowY, trackWidth, 16, {
      fill: mixHex(category.color, COLORS.white, 0.84),
      stroke: mixHex(category.color, COLORS.stroke, 0.42),
      radius: 9,
    });
    drawPanel(doc, trackX, rowY, Math.min(trackWidth, Math.max(8, (category.value / maxValue) * trackWidth)), 16, {
      fill: category.color,
      stroke: category.color,
      lineWidth: 0,
      radius: 9,
    });
    drawTextBlock(doc, `${category.value}`, x + width - 22, rowY + 4, {
      width: 22,
      size: 9,
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'right',
    });
  });
}

function drawProductivitySection(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  const categoryRowsHeight = data.productivity.categoryBreakdown.length * 24;
  const height = 314 + categoryRowsHeight;
  ensurePageSpace(doc, cursor, height);
  const y = cursor.y;
  drawPanel(doc, x, y, width, height, { radius: 22 });
  drawTextBlock(doc, 'Resumen semanal', x + 22, y + 22, {
    width: 220,
    size: 17,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, 'Graficos y metricas del periodo para entender avance, ritmo y tareas que se quedaron atras.', x + 22, y + 46, {
    width: width - 44,
    size: 10,
    color: COLORS.muted,
  });

  const metricWidth = (width - 44 - 20) / 3;
  drawMetricCard(doc, x + 22, y + 76, metricWidth, 58, {
    value: `${clamp(Math.round(data.productivity.completionRate), 0, 100)}%`,
    label: 'Cumplimiento del rango',
    accent: COLORS.completed,
  });
  drawMetricCard(doc, x + 22 + metricWidth + 10, y + 76, metricWidth, 58, {
    value: data.productivity.bestHourRange,
    label: 'Mejor franja',
    accent: COLORS.title,
    kind: 'descriptor',
  });
  drawMetricCard(doc, x + 22 + ((metricWidth + 10) * 2), y + 76, metricWidth, 58, {
    value: data.productivity.mostPostponedCategory,
    label: 'Categoria mas reprogramada',
    accent: COLORS.deleted,
    kind: 'descriptor',
  });

  drawTextBlock(doc, 'Completadas vs creadas', x + 22, y + 152, {
    width: 180,
    size: 11,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawWeeklyBars(doc, x + 22, y + 168, width - 44, 84, data.productivity.weeklyBars);
  drawTextBlock(doc, 'Peso por categoria', x + 22, y + 266, {
    width: 160,
    size: 11,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawCategoryBars(doc, x + 22, y + 284, width - 44, data.productivity.categoryBreakdown);
  cursor.y += height + SECTION_GAP;
}

function drawInsightsSection(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const items = [
    `Cerraste el ${clamp(Math.round(data.productivity.completionRate), 0, 100)}% de lo gestionado en el periodo.`,
    `Tu mejor franja de productividad fue ${data.productivity.bestHourRange}.`,
    `La categoria mas reprogramada fue ${data.productivity.mostPostponedCategory}.`,
    ...data.premiumInsights,
  ].slice(0, 6);
  const height = 94 + (items.length * 18);
  ensurePageSpace(doc, cursor, height);
  const x = PAGE_MARGIN;
  const y = cursor.y;
  drawPanel(doc, x, y, width, height, {
    fill: mixHex(COLORS.completed, COLORS.white, 0.92),
    radius: 22,
  });
  drawTextBlock(doc, 'Insights premium', x + 22, y + 22, {
    width: 220,
    size: 17,
    color: COLORS.title,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, `Categorias visibles: ${data.visibleCategoryLabels.join(', ') || 'Todas las categorias'}`, x + 22, y + 48, {
    width: width - 44,
    size: 10,
    color: COLORS.muted,
  });
  let lineY = y + 72;
  items.forEach(item => {
    drawTextBlock(doc, `- ${item}`, x + 22, lineY, {
      width: width - 44,
      size: 10,
      color: COLORS.text,
    });
    lineY += 18;
  });
  cursor.y += height + SECTION_GAP;
}

function buildTaskRowLayout(doc, item, width) {
  const contentWidth = width - 24;
  const titleLines = getTextLines(doc, item.title, contentWidth, {
    size: 10,
    fontStyle: 'bold',
  });
  const detailLines = getTextLines(doc, item.detail, contentWidth, {
    size: 9,
  });
  const titleHeight = getTextHeight(titleLines, 10, 1.1);
  const detailHeight = getTextHeight(detailLines, 9, 1.18);
  const detailY = 38 + titleHeight + 4;
  const rowHeight = Math.max(64, detailY + detailHeight + 12);

  return {
    titleLines,
    detailLines,
    detailY,
    rowHeight,
  };
}

function measureTaskRowHeight(doc, item, width) {
  return buildTaskRowLayout(doc, item, width).rowHeight;
}

function drawTaskRow(doc, x, y, width, item, color) {
  const layout = buildTaskRowLayout(doc, item, width);
  const rowHeight = layout.rowHeight;
  drawPanel(doc, x, y, width, rowHeight, { radius: 14 });
  drawTag(doc, item.tag, x + 12, y + 10, color);
  drawTextBlock(doc, item.whenLabel, x + width - 108, y + 12, {
    width: 96,
    size: 8,
    color: COLORS.muted,
    align: 'right',
  });
  drawTextBlock(doc, layout.titleLines, x + 12, y + 34, {
    width: width - 130,
    size: 10,
    color: COLORS.text,
    fontStyle: 'bold',
    lineHeight: 1.1,
  });
  drawTextBlock(doc, layout.detailLines, x + 12, y + layout.detailY, {
    width: width - 24,
    size: 9,
    color: COLORS.muted,
    lineHeight: 1.18,
  });
  return rowHeight;
}

function drawCompletedSection(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  const items = data.completed.items.length
    ? data.completed.items
    : [{ title: 'Todavia no hay tareas completadas recientes.', tag: 'Sin datos', completedAtLabel: '-' }];

  const estimatedHeight = 82 + items.reduce((sum, item) => sum + measureTaskRowHeight(doc, {
    title: item.title,
    tag: item.tag,
    whenLabel: item.completedAtLabel,
    detail: item.completedAtLabel === '-' ? 'No se registraron cierres para este reporte.' : `Cerrada en ${item.completedAtLabel}.`,
  }, width) + 10, 0);

  ensurePageSpace(doc, cursor, estimatedHeight);
  drawTextBlock(doc, 'Completadas recientes', x, cursor.y, {
    width: 260,
    size: 17,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, data.completed.totalLabel, x + width - 140, cursor.y + 4, {
    width: 140,
    size: 10,
    color: COLORS.muted,
    align: 'right',
  });
  cursor.y += 30;

  items.forEach(item => {
    cursor.y += drawTaskRow(doc, x, cursor.y, width, {
      title: item.title,
      tag: item.tag,
      whenLabel: item.completedAtLabel,
      detail: item.completedAtLabel === '-' ? 'No se registraron cierres para este reporte.' : `Cerrada en ${item.completedAtLabel}.`,
    }, COLORS.completed) + 10;
  });

  cursor.y += SECTION_GAP;
}

function drawActivityGroups(doc, cursor, data) {
  const width = doc.internal.pageSize.getWidth() - (PAGE_MARGIN * 2);
  const x = PAGE_MARGIN;
  ensurePageSpace(doc, cursor, 52);
  drawTextBlock(doc, 'Actividad del rango por categoria', x, cursor.y, {
    width,
    size: 17,
    color: COLORS.text,
    fontStyle: 'bold',
  });
  drawTextBlock(doc, 'Aqui ves con claridad lo que hiciste, lo que dejaste pendiente y lo que se quedo fuera de tiempo.', x, cursor.y + 24, {
    width,
    size: 10,
    color: COLORS.muted,
  });
  cursor.y += 48;

  data.activityGroups.forEach(group => {
    const items = group.items.length
      ? group.items
      : [buildActivityItem({
        title: `Sin tareas en ${group.label.toLowerCase()}`,
        tag: 'Sin datos',
        whenLabel: '-',
        detail: 'No hubo registros en esta categoria dentro del rango seleccionado.',
      })];

    ensurePageSpace(doc, cursor, 70);
    drawPanel(doc, x, cursor.y, width, 58, {
      fill: mixHex(group.color, COLORS.white, 0.9),
      stroke: mixHex(group.color, COLORS.stroke, 0.44),
      radius: 18,
    });
    drawTextBlock(doc, group.label, x + 18, cursor.y + 14, {
      width: width - 160,
      size: 16,
      color: group.color,
      fontStyle: 'bold',
    });
    drawTextBlock(doc, group.description, x + 18, cursor.y + 34, {
      width: width - 170,
      size: 9,
      color: COLORS.muted,
    });
    drawTag(doc, `${group.items.length} ${group.items.length === 1 ? 'registro' : 'registros'}`, x + width - 110, cursor.y + 16, group.color);
    cursor.y += 70;

    items.slice(0, MAX_VISIBLE_ITEMS).forEach(item => {
      const rowHeight = measureTaskRowHeight(doc, item, width);
      ensurePageSpace(doc, cursor, rowHeight + 10);
      cursor.y += drawTaskRow(doc, x, cursor.y, width, item, group.color) + 10;
    });

    if (group.items.length > MAX_VISIBLE_ITEMS) {
      ensurePageSpace(doc, cursor, 24);
      drawTextBlock(doc, `+${group.items.length - MAX_VISIBLE_ITEMS} tareas mas siguen disponibles en la app.`, x, cursor.y, {
        width,
        size: 9,
        color: COLORS.muted,
      });
      cursor.y += 24;
    }

    cursor.y += 8;
  });
}

function drawFooters(doc, data) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawColor(doc, COLORS.stroke);
    doc.setLineWidth(0.8);
    doc.line(PAGE_MARGIN, pageHeight - 26, pageWidth - PAGE_MARGIN, pageHeight - 26);
    drawTextBlock(doc, `Reporte generado en el dispositivo - ${data.appName}`, PAGE_MARGIN, pageHeight - 18, {
      width: 220,
      size: 8,
      color: COLORS.muted,
    });
    drawTextBlock(doc, `Pagina ${page} de ${totalPages}`, pageWidth - PAGE_MARGIN - 78, pageHeight - 18, {
      width: 78,
      size: 8,
      color: COLORS.muted,
      align: 'right',
    });
  }
}

let pdfLibraryPromise;
let logoDataPromise;

function loadPdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import('jspdf').then(module => ({
      jsPDF: module.jsPDF || module.default?.jsPDF || module.default,
    }));
  }
  return pdfLibraryPromise;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadLogoDataUrl() {
  if (!logoDataPromise) {
    logoDataPromise = (async () => {
      if (typeof fetch !== 'function') return null;
      try {
        const response = await fetch(logoUrl);
        if (!response.ok) return null;
        return await blobToDataUrl(await response.blob());
      } catch {
        return null;
      }
    })();
  }
  return logoDataPromise;
}

async function renderReportToPdf(data, fileName) {
  const { jsPDF } = await loadPdfLibrary();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  fillColor(doc, COLORS.page);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');

  const cursor = { y: PAGE_MARGIN };
  const logoDataUrl = await loadLogoDataUrl();

  drawHeaderSection(doc, cursor, data, logoDataUrl);
  drawHeroSection(doc, cursor, data);
  drawActiveWindowSection(doc, cursor, data);
  drawProductivitySection(doc, cursor, data);
  drawInsightsSection(doc, cursor, data);
  drawCompletedSection(doc, cursor, data);
  drawActivityGroups(doc, cursor, data);
  drawFooters(doc, data);

  doc.save(fileName);
}

export async function downloadDashboardPdfReport({
  appName = 'ListEA',
  dashboard,
  tasks = [],
  analytics,
  visibleCategoryLabels = [],
  fileNamePrefix = 'reporte-listEA',
} = {}) {
  const data = buildListeaReportData({
    appName,
    dashboard,
    tasks,
    analytics,
    visibleCategoryLabels,
  });
  const safeDate = new Date().toISOString().slice(0, 10);
  await renderReportToPdf(data, `${fileNamePrefix}-${safeDate}.pdf`);
}
