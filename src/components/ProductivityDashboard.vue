<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { DASHBOARD_GRANULARITY, TaskActivityDashboard } from '../domain/activity';
import { ProfessionalControlCenter } from '../domain/controlCenter';
import {
  BacklogRescuePlanner,
  ProductivityPatternAnalyzer,
  TaskHealthAnalyzer,
} from '../domain/operability';

const props = defineProps({
  analytics: { type: Object, required: true },
  briefHistory: { type: Array, default: () => [] },
  entitlements: { type: Object, default: () => ({}) },
  licenseTier: { type: String, default: 'free' },
  operationalBrief: { type: Object, default: null },
  tasks: { type: Array, default: () => [] },
});
const emit = defineEmits(['clear-analytics', 'upgrade', 'navigate']);

const dashboardService = new TaskActivityDashboard();
const controlCenterService = new ProfessionalControlCenter();
const taskHealthAnalyzer = new TaskHealthAnalyzer();
const backlogRescuePlanner = new BacklogRescuePlanner({
  healthAnalyzer: taskHealthAnalyzer,
});
const patternAnalyzer = new ProductivityPatternAnalyzer();
const viewMode = ref('day');
const customGranularity = ref(DASHBOARD_GRANULARITY.DAY);
const customStart = ref('');
const customEnd = ref('');
const selectedActivityCategory = ref('completed');
const trendCanvas = ref(null);
const mixCanvas = ref(null);
const visibleCategories = ref({
  completed: true,
  deleted: true,
  overdue: true,
  incomplete: true,
});

const categoryCatalog = [
  { id: 'completed', label: 'Completadas', color: '#1f6f9d' },
  { id: 'deleted', label: 'Eliminadas', color: '#d97d50' },
  { id: 'overdue', label: 'Vencidas', color: '#b34b3b' },
  { id: 'incomplete', label: 'Incompletas', color: '#4c7d60' },
];

let trendChart;
let mixChart;
const canUseAdvancedDashboard = computed(() => Boolean(props.entitlements?.advancedDashboard));
const canUseControlCenter = computed(() => Boolean(props.entitlements?.premiumInsights));
const weeklyBrief = computed(() => (props.operationalBrief && typeof props.operationalBrief === 'object')
  ? props.operationalBrief
  : null);
const briefDeltaItems = computed(() => {
  if (!weeklyBrief.value?.comparison) {
    return [];
  }

  return [
    { id: 'at-risk', label: 'Riesgos', value: weeklyBrief.value.comparison.atRiskDelta },
    { id: 'responses', label: 'Respuestas', value: weeklyBrief.value.comparison.responsesDelta },
    { id: 'blocked', label: 'Bloqueos', value: weeklyBrief.value.comparison.blockedDelta },
    { id: 'completion', label: 'Cumplimiento', value: weeklyBrief.value.comparison.completionRateDelta },
  ];
});

function formatDateInputValue(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
const todayInputValue = formatDateInputValue(today);
const weekAgoInputValue = formatDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));

if (!customStart.value) customStart.value = weekAgoInputValue;
if (!customEnd.value) customEnd.value = todayInputValue;

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const customRangeError = computed(() => {
  if (viewMode.value !== 'custom') return '';

  const startDate = parseDateInput(customStart.value);
  const endDate = parseDateInput(customEnd.value);
  if (!startDate || !endDate) return '';
  return startDate > endDate ? 'Rango de fechas invalido.' : '';
});

const dashboard = computed(() => {
  if (viewMode.value === 'week') {
    return dashboardService.build(props.analytics, {
      tasks: props.tasks,
      referenceDate: new Date(),
      granularity: DASHBOARD_GRANULARITY.WEEK,
      weeks: 6,
    });
  }

  if (viewMode.value === 'custom') {
    const startDate = parseDateInput(customStart.value);
    const endDate = parseDateInput(customEnd.value);
    const resolvedStart = startDate && endDate && startDate > endDate
      ? customEnd.value || todayInputValue
      : customStart.value || todayInputValue;
    const resolvedEnd = startDate && endDate && startDate > endDate
      ? customEnd.value || todayInputValue
      : customEnd.value || customStart.value || todayInputValue;

    return dashboardService.build(props.analytics, {
      tasks: props.tasks,
      referenceDate: new Date(),
      granularity: customGranularity.value,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
  }

  return dashboardService.build(props.analytics, {
    tasks: props.tasks,
    referenceDate: new Date(),
    granularity: DASHBOARD_GRANULARITY.DAY,
    days: 7,
  });
});

const trendLabel = computed(() => dashboard.value.range.granularity === DASHBOARD_GRANULARITY.WEEK
  ? 'Semanas'
  : 'Dias');

const rangeHelper = computed(() => {
  if (viewMode.value === 'week') {
    return 'Agrupa por semanas para leer ritmo real.';
  }

  if (viewMode.value === 'custom') {
    return 'Ajusta el tramo exacto que quieres revisar.';
  }

  return 'Lectura corta y privada del trabajo reciente.';
});

const controlCenter = computed(() => controlCenterService.build(props.tasks, props.analytics, {
  referenceDate: new Date(),
  rangeStart: dashboard.value.range.startDate,
  rangeEnd: dashboard.value.range.endDate,
  completionRate: dashboard.value.summary.completionRate,
}));
const backlogRescue = computed(() => backlogRescuePlanner.build(props.tasks, {
  referenceDate: new Date(),
}));
const patternStats = computed(() => patternAnalyzer.analyze(props.tasks, props.analytics, {
  referenceDate: new Date(),
}));
const taskHealthSummary = computed(() => taskHealthAnalyzer.summarize(props.tasks, {
  referenceDate: new Date(),
}));

const overviewCards = computed(() => [
  { id: 'at-risk', label: 'En riesgo', value: controlCenter.value.summary.atRisk },
  { id: 'responses', label: 'Por responder', value: controlCenter.value.summary.responses },
  { id: 'blocked', label: 'Bloqueos', value: controlCenter.value.summary.staleBlocked },
  { id: 'completion', label: 'Cumplimiento', value: `${controlCenter.value.summary.completionRate}%` },
]);

const summaryCards = computed(() => categoryCatalog
  .map(category => ({
    ...category,
    value: dashboard.value.summary[category.id] ?? 0,
    visible: visibleCategories.value[category.id],
  }))
  .filter(card => card.visible));

const mixChartCategories = computed(() => categoryCatalog
  .filter(category => visibleCategories.value[category.id])
  .map(category => ({
    id: category.id,
    label: category.label,
    value: dashboard.value.summary[category.id] ?? 0,
    color: category.color,
  })));

const trendDatasets = computed(() => {
  const datasets = [];

  if (visibleCategories.value.completed) {
    datasets.push({
      label: 'Completadas',
      data: dashboard.value.series.map(bucket => bucket.completed),
      backgroundColor: '#1f6f9d',
      borderRadius: 12,
      borderSkipped: false,
    });
  }

  if (visibleCategories.value.deleted) {
    datasets.push({
      label: 'Eliminadas',
      data: dashboard.value.series.map(bucket => bucket.deleted),
      backgroundColor: '#d97d50',
      borderRadius: 12,
      borderSkipped: false,
    });
  }

  return datasets;
});

function formatEventDate(value) {
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(nextDate);
}

function eventTone(type) {
  return type === 'deleted' ? 'warn' : 'good';
}

function eventLabel(type) {
  return type === 'deleted' ? 'Eliminada' : 'Completada';
}

function parseDashboardDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveTaskReferenceDate(task) {
  const relevantDate = task?.getRelevantDate?.() || task?.dueAt || task?.followUpAt || task?.createdAt;
  if (!relevantDate) return null;

  const date = new Date(relevantDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSafeTimestamp(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.getTime()
    : Number.MAX_SAFE_INTEGER;
}

function isWithinCurrentRange(value) {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const startDate = parseDashboardDate(dashboard.value.range.startDate);
  const endDate = parseDashboardDate(dashboard.value.range.endDate);
  if (!startDate || !endDate) return false;

  return date >= startDate && date <= endDate;
}

function buildEventItem(event, badge) {
  return {
    id: event.id,
    title: event.title || 'Tarea sin titulo',
    meta: formatEventDate(event.happenedAt),
    badge,
  };
}

function buildTaskItem(task, badge) {
  const referenceDate = resolveTaskReferenceDate(task);
  const projectLabel = task?.project ? `Proyecto: ${task.project}` : 'Sin proyecto';
  const dateLabel = referenceDate ? formatEventDate(referenceDate) : 'Sin fecha';

  return {
    id: task?.id || `${badge}-${task?.title || 'task'}`,
    title: task?.title || 'Tarea sin titulo',
    meta: `${projectLabel} - ${dateLabel}`,
    badge,
  };
}

const activityGroups = computed(() => {
  const referenceDate = new Date();
  const analyticsEvents = Array.isArray(props.analytics?.events) ? props.analytics.events : [];

  const completedItems = analyticsEvents
    .filter(event => ['completed', 'deleted_after_completion'].includes(event.type) && isWithinCurrentRange(event.happenedAt))
    .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt))
    .map(event => buildEventItem(event, 'Completada'));

  const deletedItems = analyticsEvents
    .filter(event => event.type === 'deleted' && isWithinCurrentRange(event.happenedAt))
    .sort((left, right) => new Date(right.happenedAt) - new Date(left.happenedAt))
    .map(event => buildEventItem(event, 'Eliminada'));

  const activeTasks = props.tasks.filter(task => !(task?.isCompleted?.() || task?.status === 'completed'));

  const overdueItems = activeTasks
    .filter(task => {
      const dueDate = task?.dueAt ? new Date(task.dueAt) : null;
      const referenceTaskDate = resolveTaskReferenceDate(task);
      return dueDate
        && !Number.isNaN(dueDate.getTime())
        && dueDate < referenceDate
        && isWithinCurrentRange(referenceTaskDate);
    })
    .sort((left, right) => getSafeTimestamp(resolveTaskReferenceDate(left)) - getSafeTimestamp(resolveTaskReferenceDate(right)))
    .map(task => buildTaskItem(task, 'Vencida'));

  const incompleteItems = activeTasks
    .filter(task => {
      const referenceTaskDate = resolveTaskReferenceDate(task);
      if (!isWithinCurrentRange(referenceTaskDate)) return false;

      const dueDate = task?.dueAt ? new Date(task.dueAt) : null;
      if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < referenceDate) {
        return false;
      }

      return true;
    })
    .sort((left, right) => getSafeTimestamp(resolveTaskReferenceDate(left)) - getSafeTimestamp(resolveTaskReferenceDate(right)))
    .map(task => buildTaskItem(task, 'Incompleta'));

  return [
    {
      id: 'completed',
      label: 'Completadas',
      description: 'Tareas que fueron hechas con exito.',
      items: completedItems,
    },
    {
      id: 'deleted',
      label: 'Eliminadas',
      description: 'Tareas que fueron eliminadas antes de ejecutarse, por lo que no llegaron a cumplirse.',
      items: deletedItems,
    },
    {
      id: 'overdue',
      label: 'Vencidas',
      description: 'Tareas que ya pasaron su fecha objetivo y siguen pendientes.',
      items: overdueItems,
    },
    {
      id: 'incomplete',
      label: 'Incompletas',
      description: 'Tareas que siguen activas dentro del rango, pero aun no han sido resueltas.',
      items: incompleteItems,
    },
  ];
});

const visibleActivityGroups = computed(() =>
  activityGroups.value.filter(group => visibleCategories.value[group.id]),
);

const currentActivityGroup = computed(() =>
  visibleActivityGroups.value.find(group => group.id === selectedActivityCategory.value)
  ?? visibleActivityGroups.value[0]
  ?? null,
);

function destroyCharts() {
  trendChart?.destroy();
  mixChart?.destroy();
  trendChart = undefined;
  mixChart = undefined;
}

function renderCharts() {
  destroyCharts();
  if (trendCanvas.value && trendDatasets.value.length) {
    trendChart = new Chart(trendCanvas.value, {
      type: 'bar',
      data: {
        labels: dashboard.value.series.map(bucket => bucket.label),
        datasets: trendDatasets.value,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' },
          },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
          },
        },
      },
    });
  }

  if (mixCanvas.value && mixChartCategories.value.length) {
    mixChart = new Chart(mixCanvas.value, {
      type: 'doughnut',
      data: {
        labels: mixChartCategories.value.map(item => item.label),
        datasets: [
          {
            data: mixChartCategories.value.map(item => item.value),
            backgroundColor: mixChartCategories.value.map(item => item.color),
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' },
          },
        },
      },
    });
  }
}

function toggleCategory(categoryId) {
  visibleCategories.value = {
    ...visibleCategories.value,
    [categoryId]: !visibleCategories.value[categoryId],
  };
}

function setViewMode(nextViewMode) {
  if (['week', 'custom'].includes(nextViewMode) && !canUseAdvancedDashboard.value) {
    emit('upgrade', 'advancedDashboard');
    return;
  }

  viewMode.value = nextViewMode;
}

watch(dashboard, renderCharts, { deep: true });
watch([viewMode, customGranularity, customStart, customEnd, visibleCategories], renderCharts, { deep: true });
watch(visibleActivityGroups, groups => {
  if (!groups.some(group => group.id === selectedActivityCategory.value)) {
    selectedActivityCategory.value = groups[0]?.id ?? '';
  }
}, { deep: true, immediate: true });
watch(canUseAdvancedDashboard, enabled => {
  if (!enabled && ['week', 'custom'].includes(viewMode.value)) {
    viewMode.value = 'day';
  }
});

onMounted(renderCharts);
onBeforeUnmount(destroyCharts);
</script>

<template>
  <section class="dashboardPage">
    <article class="heroCard">
      <div class="heroCopy">
        <p class="eyebrow">Panel</p>
        <h2>Centro de control privado</h2>
        <p class="heroText">
          Decide que mover hoy con datos locales, compromisos en riesgo y senales de seguimiento reales.
        </p>
      </div>
      <div class="heroStats">
        <article v-for="card in overviewCards" :key="card.id" class="heroStat">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>
    </article>

    <article class="dashboardCard controlCenterCard">
      <div class="controlHeader">
        <div>
          <p class="eyebrow">Centro de control</p>
          <h3>Lo que conviene mover primero</h3>
        </div>
        <div class="controlActions">
          <span class="rangePill">{{ dashboard.range.label }}</span>
        </div>
      </div>

      <div class="pulseRow">
        <article v-for="item in controlCenter.pulse" :key="item.id" class="pulseCard">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>

      <div v-if="canUseControlCenter" class="controlGrid">
        <article v-if="weeklyBrief" class="decisionCard weeklyBriefCard">
          <div class="decisionHead">
            <div>
              <strong>Lectura operativa semanal</strong>
              <span>{{ weeklyBrief.range?.label }}</span>
            </div>
            <button type="button" class="ghostButton" @click="emit('navigate', 'today')">
              Ir a hoy
            </button>
          </div>

          <div class="weeklyBriefSummary">
            <article class="weeklyBriefStat">
              <span>Cumplimiento</span>
              <strong>{{ weeklyBrief.summary?.completionRate ?? 0 }}%</strong>
            </article>
            <article class="weeklyBriefStat">
              <span>Riesgos</span>
              <strong>{{ weeklyBrief.summary?.atRisk ?? 0 }}</strong>
            </article>
            <article class="weeklyBriefStat">
              <span>Respuestas</span>
              <strong>{{ weeklyBrief.summary?.responses ?? 0 }}</strong>
            </article>
          </div>

          <div class="weeklyBriefHighlights">
            <span v-for="highlight in weeklyBrief.highlights ?? []" :key="highlight" class="weeklyBriefChip">
              {{ highlight }}
            </span>
          </div>

          <div v-if="briefDeltaItems.length" class="weeklyBriefDeltaRow">
            <article v-for="item in briefDeltaItems" :key="item.id" class="weeklyBriefDelta">
              <span>{{ item.label }}</span>
              <strong :data-tone="item.value > 0 ? 'warn' : 'good'">
                {{ item.value > 0 ? '+' : '' }}{{ item.value }}
              </strong>
            </article>
          </div>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Salud del trabajo</strong>
              <span>Lectura local del estado real de tus tareas</span>
            </div>
          </div>

          <div class="weeklyBriefSummary">
            <article class="weeklyBriefStat">
              <span>En riesgo</span>
              <strong>{{ taskHealthSummary['at-risk'] ?? 0 }}</strong>
            </article>
            <article class="weeklyBriefStat">
              <span>Estancadas</span>
              <strong>{{ taskHealthSummary.stalled ?? 0 }}</strong>
            </article>
            <article class="weeklyBriefStat">
              <span>Vencidas</span>
              <strong>{{ taskHealthSummary.overdue ?? 0 }}</strong>
            </article>
          </div>

          <p class="emptyText">ListEA mide salud sin IA ni nube: riesgo, estancamiento y vencimiento desde reglas locales.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Compromisos en riesgo</strong>
              <span>{{ controlCenter.summary.atRisk }} abiertos</span>
            </div>
            <button type="button" class="ghostButton" @click="emit('navigate', 'today')">
              Abrir hoy
            </button>
          </div>

          <div v-if="controlCenter.riskItems.length" class="decisionList">
            <article v-for="item in controlCenter.riskItems" :key="item.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.meta }}</p>
              </div>
              <span class="decisionBadge">{{ item.badge }}</span>
            </article>
          </div>
          <p v-else class="emptyText">No hay compromisos en riesgo ahora.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Respuestas por enviar</strong>
              <span>{{ controlCenter.summary.responses }} detectadas</span>
            </div>
            <button type="button" class="ghostButton" @click="emit('navigate', 'today')">
              Ver tareas
            </button>
          </div>

          <div v-if="controlCenter.responseItems.length" class="decisionList">
            <article v-for="item in controlCenter.responseItems" :key="item.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.meta }}</p>
              </div>
              <span class="decisionBadge">{{ item.badge }}</span>
            </article>
          </div>
          <p v-else class="emptyText">No vemos respuestas pendientes con app sugerida.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Bloqueos viejos</strong>
              <span>{{ controlCenter.summary.staleBlocked }} quietos</span>
            </div>
            <button type="button" class="ghostButton" @click="emit('navigate', 'follow-up')">
              Seguimiento
            </button>
          </div>

          <div v-if="controlCenter.blockedItems.length" class="decisionList">
            <article v-for="item in controlCenter.blockedItems" :key="item.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.meta }}</p>
              </div>
              <span class="decisionBadge">{{ item.badge }}</span>
            </article>
          </div>
          <p v-else class="emptyText">No hay bloqueos viejos ni seguimientos enfriados.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Patrones locales</strong>
              <span>Lo que tu forma de trabajar ya esta mostrando</span>
            </div>
          </div>

          <div v-if="patternStats.insights.length" class="decisionList">
            <article v-for="insight in patternStats.insights" :key="insight.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ insight.title }}</strong>
                <p>{{ insight.message }}</p>
              </div>
              <span class="decisionBadge">{{ insight.tone === 'good' ? 'Patron' : 'Ajuste' }}</span>
            </article>
          </div>
          <p v-else class="emptyText">Todavia no hay suficientes datos locales para detectar patrones confiables.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Canales mas usados</strong>
              <span>{{ controlCenter.summary.launches }} aperturas locales</span>
            </div>
          </div>

          <div v-if="controlCenter.appUsage.length" class="decisionList">
            <article v-for="item in controlCenter.appUsage" :key="item.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.meta }}</p>
              </div>
              <span class="decisionBadge">{{ item.badge }}</span>
            </article>
          </div>
          <p v-else class="emptyText">Todavia no hay aperturas locales registradas en este rango.</p>
        </article>

        <article class="decisionCard">
          <div class="decisionHead">
            <div>
              <strong>Backlog rescue</strong>
              <span>{{ backlogRescue.items.length }} sugerencia(s) listas</span>
            </div>
            <button type="button" class="ghostButton" @click="emit('navigate', 'today')">
              Abrir inicio
            </button>
          </div>

          <div v-if="backlogRescue.items.length" class="decisionList">
            <article v-for="item in backlogRescue.items" :key="item.id" class="decisionItem">
              <div class="decisionCopy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.reason }}</p>
              </div>
              <span class="decisionBadge">{{ item.actionLabel }}</span>
            </article>
          </div>
          <p v-else class="emptyText">No hay rescates urgentes en backlog dentro del rango actual.</p>
        </article>
      </div>

      <div v-else class="upgradeCard">
        <div>
          <strong>ListEA Pro convierte el panel en tu centro de control.</strong>
          <p>
            Compromisos en riesgo, respuestas por enviar, bloqueos viejos, lectura operativa semanal y uso por canal viven solo en tu dispositivo.
          </p>
        </div>
        <button type="button" class="primaryButton" @click="emit('upgrade', 'premiumInsights')">
          Ver ListEA Pro
        </button>
      </div>
    </article>

    <article class="dashboardCard">
      <div class="controlHeader">
        <div>
          <p class="eyebrow">Historial local</p>
          <h3>Ritmo y resultados</h3>
        </div>
        <div class="controlActions">
          <p class="controlCopy">{{ rangeHelper }}</p>
          <div class="actionButtons">
            <button type="button" class="ghostButton" @click="emit('clear-analytics')">
              Limpiar estadisticas
            </button>
          </div>
        </div>
      </div>

      <div class="modeRow">
        <button type="button" class="modeChip" :class="{ active: viewMode === 'day' }" @click="setViewMode('day')">
          Por dia
        </button>
        <button type="button" class="modeChip" :class="{ active: viewMode === 'week', locked: !canUseAdvancedDashboard }" @click="setViewMode('week')">
          Por semana
        </button>
        <button type="button" class="modeChip" :class="{ active: viewMode === 'custom', locked: !canUseAdvancedDashboard }" @click="setViewMode('custom')">
          Personalizado
        </button>
      </div>

      <p v-if="!canUseAdvancedDashboard" class="proHint">
        ListEA Free mantiene el panel corto y privado en el dispositivo. ListEA Pro desbloquea vista semanal y rango personalizado.
      </p>

      <div v-if="viewMode === 'custom'" class="customControls">
        <label class="fieldGroup">
          <span>Desde</span>
          <input v-model="customStart" class="detailField" type="date" :max="customEnd || todayInputValue" />
        </label>

        <label class="fieldGroup">
          <span>Hasta</span>
          <input v-model="customEnd" class="detailField" type="date" :min="customStart || ''" :max="todayInputValue" />
        </label>

        <label class="fieldGroup">
          <span>Agrupar</span>
          <select v-model="customGranularity" class="detailField">
            <option :value="DASHBOARD_GRANULARITY.DAY">Por dia</option>
            <option :value="DASHBOARD_GRANULARITY.WEEK">Por semana</option>
          </select>
        </label>
      </div>

      <p v-if="customRangeError" class="rangeError">{{ customRangeError }}</p>

      <div class="visibilityPanel">
        <p class="visibilityCopy">Selecciona o deselecciona los bloques que quieres ver en tu panel.</p>
        <div class="visibilityRow">
          <label v-for="category in categoryCatalog" :key="category.id" class="toggleChip">
            <input type="checkbox" :checked="visibleCategories[category.id]" @change="toggleCategory(category.id)" />
            <span>{{ category.label }}</span>
          </label>
        </div>
      </div>

      <div class="summaryRow">
        <article v-for="card in summaryCards" :key="card.id" class="summaryCard">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>

      <div class="chartGrid">
        <article class="chartCard">
          <div class="chartHead">
            <strong>{{ trendLabel }}</strong>
            <span>Completadas y eliminadas por periodo</span>
          </div>
          <div v-if="trendDatasets.length" class="chartFrame">
            <canvas ref="trendCanvas"></canvas>
          </div>
          <p v-else class="emptyText">Activa Completadas o Eliminadas para mostrar esta grafica.</p>
        </article>

        <article class="chartCard compact">
          <div class="chartHead">
            <strong>Balance</strong>
            <span>Distribucion de categorias visibles</span>
          </div>
          <div class="completionHero">
            <span class="completionCaption">Cumplimiento</span>
            <strong>{{ dashboard.summary.completionRate }}%</strong>
            <small class="completionNote">Completadas sobre el total observado del rango</small>
          </div>
          <div v-if="mixChartCategories.length" class="chartFrame donut">
            <canvas ref="mixCanvas"></canvas>
          </div>
          <p v-else class="emptyText">Activa al menos una categoria para mostrar la distribucion.</p>
        </article>
      </div>

      <article class="activityCard">
        <div class="activityHead">
          <strong>Actividad del rango por categoria</strong>
          <span>{{ currentActivityGroup?.items.length ?? 0 }} tareas visibles</span>
        </div>

        <div v-if="visibleActivityGroups.length" class="activitySegments">
          <button
            v-for="group in visibleActivityGroups"
            :key="group.id"
            type="button"
            class="activitySegment"
            :class="{ active: currentActivityGroup?.id === group.id }"
            @click="selectedActivityCategory = group.id"
          >
            <span>{{ group.label }}</span>
            <strong>{{ group.items.length }}</strong>
          </button>
        </div>

        <p v-if="currentActivityGroup?.description" class="activityDescription">
          <strong>{{ currentActivityGroup.label }}:</strong> {{ currentActivityGroup.description }}
        </p>

        <div v-if="currentActivityGroup?.items.length" class="eventList">
          <article
            v-for="item in currentActivityGroup.items"
            :key="item.id"
            class="eventItem"
            :data-tone="currentActivityGroup.id === 'deleted' ? 'warn' : 'good'"
          >
            <div class="eventCopy">
              <strong>{{ item.title }}</strong>
              <p>{{ item.meta }}</p>
            </div>
            <span class="eventBadge">{{ item.badge }}</span>
          </article>
        </div>
        <p v-else class="emptyText">No hay tareas en esta categoria dentro del rango actual.</p>
      </article>
    </article>
  </section>
</template>

<style scoped>
.dashboardPage {
  display: grid;
  gap: var(--section-gap);
}

.heroCard,
.dashboardCard {
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.heroCard {
  padding: 0 0 14px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  min-width: 0;
}

.heroCopy h2,
.dashboardCard h3,
.eyebrow {
  margin: 0;
  text-align: left;
}

.eyebrow {
  margin-bottom: 6px;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-strong);
  font-weight: 700;
}

.heroCopy h2 {
  max-width: none;
  font-size: clamp(1.18rem, 5vw, 1.7rem);
  line-height: 1.05;
}

.heroText,
.heroStat span,
.pulseCard span,
.controlCopy,
.summaryCard span,
.chartHead span,
.decisionHead span,
.decisionCopy p,
.eventCopy p,
.emptyText,
.rangeError,
.visibilityCopy {
  color: var(--text-muted);
}

.heroText,
.controlCopy,
.emptyText {
  margin-top: 0;
}

.heroText {
  margin-top: 0.5rem;
}

.heroStats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.heroStat,
.pulseCard,
.decisionCard {
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--line));
  background: color-mix(in srgb, white 93%, var(--surface));
  box-shadow: 0 14px 28px rgba(15, 70, 98, 0.08);
}

.heroStat {
  min-height: 82px;
  padding: 14px 16px;
  display: grid;
  align-content: center;
  gap: 6px;
}

.heroStat,
.pulseCard,
.decisionCard,
.decisionItem,
.summaryCard,
.chartCard,
.activityCard {
  min-width: 0;
}

.heroStat strong,
.pulseCard strong {
  font-size: clamp(1.35rem, 4vw, 1.9rem);
  line-height: 1;
}

.dashboardCard {
  padding: 6px 0 0;
  display: grid;
  gap: 16px;
}

.controlHeader,
.summaryRow,
.customControls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pulseRow {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.pulseCard {
  min-height: 84px;
  padding: 14px 16px;
  display: grid;
  gap: 6px;
  align-content: center;
}

.controlGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-width: 0;
}

.weeklyBriefCard {
  grid-column: 1 / -1;
}

.decisionCard {
  padding: 16px;
  display: grid;
  gap: 12px;
}

.decisionHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-direction: column;
}

.decisionHead strong,
.decisionCopy strong {
  display: block;
  text-align: left;
}

.decisionList {
  display: grid;
  gap: 10px;
}

.decisionItem {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
  background: color-mix(in srgb, var(--surface) 66%, transparent);
}

.decisionCopy {
  min-width: 0;
}

.decisionCopy p {
  margin: 4px 0 0;
  text-align: left;
}

.weeklyBriefSummary,
.weeklyBriefDeltaRow {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.weeklyBriefDeltaRow {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.weeklyBriefStat,
.weeklyBriefDelta {
  min-height: 80px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
  background: color-mix(in srgb, var(--surface) 66%, transparent);
  display: grid;
  gap: 6px;
  text-align: left;
}

.weeklyBriefHighlights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.weeklyBriefChip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--line));
}

.weeklyBriefStat strong,
.weeklyBriefDelta strong {
  font-size: 1.2rem;
}

.weeklyBriefDelta strong[data-tone='warn'] {
  color: #b34b3b;
}

.weeklyBriefDelta strong[data-tone='good'] {
  color: #4c7d60;
}

.upgradeCard {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-direction: column;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px dashed color-mix(in srgb, var(--accent) 34%, var(--line));
  background: color-mix(in srgb, var(--surface) 86%, transparent);
}

.upgradeCard strong {
  display: block;
  text-align: left;
}

.upgradeCard p {
  margin: 6px 0 0;
  color: var(--text-muted);
  text-align: left;
}

.chartGrid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.controlHeader {
  align-items: flex-start;
}

.controlActions {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.actionButtons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.controlHeader h3 {
  text-align: left;
}

.modeRow {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.modeRow::-webkit-scrollbar {
  display: none;
}

.rangePill,
.modeChip,
.eventBadge,
.decisionBadge,
.ghostButton,
.primaryButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
}

.modeChip {
  flex: 0 0 auto;
  white-space: nowrap;
}

.rangePill,
.decisionBadge,
.eventBadge {
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.rangePill,
.modeChip,
.decisionBadge {
  background: var(--surface-soft);
  color: var(--text-main);
}

.ghostButton {
  background: var(--surface-soft);
  color: var(--text-main);
}

.primaryButton,
.modeChip.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: color-mix(in srgb, var(--accent) 58%, var(--line));
}

.ghostButton:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.modeChip.locked {
  border-style: dashed;
}

.customControls {
  grid-template-columns: 1fr;
}

.fieldGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.detailField {
  width: 100%;
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid var(--line);
  padding: 12px 14px;
  background: var(--surface-soft);
  color: var(--text-main);
}

.visibilityPanel {
  padding: 0 0 0 14px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 18%, var(--line));
  background: transparent;
}

.proHint {
  margin: 0;
  padding: 0 0 0 14px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 28%, var(--line));
  background: transparent;
  color: var(--text-muted);
  text-align: left;
}

.visibilityCopy {
  margin: 0 0 10px;
  text-align: left;
}

.visibilityRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toggleChip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
}

.summaryRow {
  grid-template-columns: 1fr;
  flex-wrap: wrap;
}

.rangeError {
  margin: 0;
  padding: 0 0 0 14px;
  border-left: 3px solid color-mix(in srgb, #de6f4d 40%, var(--line));
  background: transparent;
  color: #8b3a21;
  text-align: left;
  font-weight: 600;
}

.summaryCard,
.chartCard,
.activityCard {
  border-radius: 0;
  background: transparent;
}

.summaryCard {
  min-width: 0;
  padding: 8px 0 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 18%, var(--line));
}

.summaryCard strong {
  font-size: clamp(1.4rem, 4vw, 1.9rem);
  text-align: left;
}

.chartCard,
.activityCard {
  padding: 14px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
}

.chartHead,
.activityHead,
.eventItem {
  display: flex;
  gap: 10px;
}

.chartHead,
.activityHead {
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-direction: column;
}

.chartHead {
  flex-direction: column;
  align-items: flex-start;
}

.chartFrame {
  position: relative;
  min-height: 240px;
}

.completionHero {
  display: grid;
  gap: 4px;
  justify-items: center;
  margin-bottom: 8px;
}

.completionCaption {
  color: var(--text-muted);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.completionHero strong {
  font-size: clamp(1.8rem, 5vw, 2.6rem);
  line-height: 1;
  color: var(--accent-strong);
}

.completionNote {
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}

.chartFrame.donut {
  min-height: 260px;
}

.eventList {
  display: grid;
  gap: 10px;
}

.activityDescription {
  margin: 0 0 12px;
  padding: 0 0 0 14px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: transparent;
  color: var(--text-muted);
  text-align: left;
}

.activityDescription strong {
  color: var(--text-main);
}

.activitySegments {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  margin-bottom: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.activitySegments::-webkit-scrollbar {
  display: none;
}

.activitySegment {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-soft) 86%, white);
  color: var(--text-main);
  flex: 0 0 auto;
  white-space: nowrap;
}

.activitySegment strong {
  color: var(--accent-strong);
}

.activitySegment.active {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 44%, var(--line));
}

.eventItem {
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
  background: color-mix(in srgb, var(--surface) 66%, transparent);
}

.eventCopy {
  min-width: 0;
}

.eventCopy strong,
.eventCopy p {
  display: block;
  text-align: left;
}

.eventCopy p {
  margin: 4px 0 0;
}

.eventBadge {
  min-height: 34px;
  font-size: 0.85rem;
  font-weight: 700;
  background: white;
}

.eventItem[data-tone='good'] .eventBadge {
  color: #8b3a21;
}

.eventItem[data-tone='warn'] .eventBadge {
  color: #9a5b18;
}

@media (max-width: 860px) {
  .heroCard,
  .summaryRow,
  .pulseRow,
  .controlGrid,
  .chartGrid,
  .customControls,
  .weeklyBriefSummary,
  .weeklyBriefDeltaRow,
  .heroStats {
    grid-template-columns: 1fr;
  }

  .controlHeader,
  .customControls {
    flex-direction: column;
  }

  .controlActions {
    justify-items: start;
  }

  .actionButtons {
    justify-content: flex-start;
  }
}

@media (max-width: 1100px) {
  .heroCard {
    grid-template-columns: 1fr;
  }

  .heroStats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .controlGrid,
  .chartGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .weeklyBriefSummary {
    grid-template-columns: 1fr;
  }

  .weeklyBriefDeltaRow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summaryRow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summaryCard {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .heroCard,
  .dashboardCard {
    padding: 0;
    border-radius: 0;
  }

  .heroStats {
    grid-template-columns: 1fr;
  }

  .decisionHead,
  .decisionItem,
  .upgradeCard,
  .eventItem,
  .activityHead {
    flex-direction: column;
    align-items: flex-start;
  }

  .ghostButton,
  .primaryButton,
  .toggleChip {
    width: 100%;
    justify-content: flex-start;
  }

  .activitySegment {
    width: 100%;
  }

  .heroStats,
  .pulseRow,
  .summaryRow,
  .weeklyBriefDeltaRow {
    grid-template-columns: 1fr;
  }

  .chartFrame {
    min-height: 200px;
  }

  .chartFrame.donut {
    min-height: 220px;
  }
}

@media (min-width: 721px) {
  .summaryRow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customControls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .activitySegments {
    flex-wrap: wrap;
    overflow: visible;
    padding-bottom: 0;
    scrollbar-width: auto;
  }
}

@media (min-width: 961px) {
  .heroCard {
    grid-template-columns: minmax(0, 1.25fr) auto;
    gap: 16px;
  }

  .heroCopy h2 {
    max-width: 22ch;
    font-size: clamp(1.4rem, 4vw, 2rem);
  }

  .heroStats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .heroStat {
    min-height: 92px;
    padding: 16px 18px;
  }

  .pulseRow {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .controlGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .controlHeader,
  .summaryRow,
  .customControls {
    flex-direction: row;
  }

  .controlActions {
    justify-items: end;
  }

  .actionButtons {
    justify-content: flex-end;
  }

  .decisionHead,
  .decisionItem,
  .upgradeCard,
  .eventItem,
  .activityHead {
    flex-direction: row;
    align-items: center;
  }

  .chartHead {
    align-items: flex-start;
    flex-direction: column;
  }

  .weeklyBriefSummary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .weeklyBriefDeltaRow {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .summaryRow {
    display: flex;
  }

  .chartGrid {
    grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
  }

  .customControls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
