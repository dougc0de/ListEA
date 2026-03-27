<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { DASHBOARD_GRANULARITY, TaskActivityDashboard } from '../domain/activity';
import { downloadDashboardPdfReport } from '../services/dashboardReportPdf';

const props = defineProps({
  analytics: { type: Object, required: true },
  tasks: { type: Array, default: () => [] },
});
const emit = defineEmits(['clear-analytics']);

const dashboardService = new TaskActivityDashboard();
const viewMode = ref('day');
const customGranularity = ref(DASHBOARD_GRANULARITY.DAY);
const customStart = ref('');
const customEnd = ref('');
const isExportingPdf = ref(false);
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
    return 'Vista agrupada por semanas para detectar ritmo real.';
  }

  if (viewMode.value === 'custom') {
    return 'Ajusta fechas para mirar solo el tramo que te importa.';
  }

  return 'Puedes elegir que bloques ver en el panel con los selectores de abajo.';
});

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

async function exportPdfReport() {
  if (isExportingPdf.value) return;

  isExportingPdf.value = true;
  try {
    await downloadDashboardPdfReport({
      dashboard: dashboard.value,
      tasks: props.tasks,
      analytics: props.analytics,
      visibleCategoryLabels: mixChartCategories.value.map(item => item.label),
    });
  } finally {
    isExportingPdf.value = false;
  }
}

watch(dashboard, renderCharts, { deep: true });
watch([viewMode, customGranularity, customStart, customEnd, visibleCategories], renderCharts, { deep: true });
watch(visibleActivityGroups, groups => {
  if (!groups.some(group => group.id === selectedActivityCategory.value)) {
    selectedActivityCategory.value = groups[0]?.id ?? '';
  }
}, { deep: true, immediate: true });

onMounted(renderCharts);
onBeforeUnmount(destroyCharts);
</script>

<template>
  <section class="dashboardPage">
    <article class="heroCard">
      <div class="heroCopy">
        <p class="eyebrow">Panel</p>
        <h2>Panel de revision</h2>
        <p class="heroText">
          Todo sale del historial local-first y de tus tareas activas.
        </p>
      </div>
    </article>

    <article class="dashboardCard">
      <div class="controlHeader">
        <div>
          <p class="eyebrow">Periodo</p>
          <h3>Filtra por ritmo real</h3>
        </div>
        <div class="controlActions">
          <p class="controlCopy">{{ rangeHelper }}</p>
          <div class="actionButtons">
            <button type="button" class="ghostButton" :disabled="isExportingPdf" @click="exportPdfReport">
              {{ isExportingPdf ? 'Generando PDF...' : 'Descargar reporte PDF' }}
            </button>
            <button type="button" class="ghostButton" @click="emit('clear-analytics')">
              Limpiar estadisticas
            </button>
          </div>
        </div>
      </div>

      <div class="modeRow">
        <button type="button" class="modeChip" :class="{ active: viewMode === 'day' }" @click="viewMode = 'day'">
          Por dia
        </button>
        <button type="button" class="modeChip" :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">
          Por semana
        </button>
        <button type="button" class="modeChip" :class="{ active: viewMode === 'custom' }" @click="viewMode = 'custom'">
          Personalizado
        </button>
      </div>

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
  gap: 14px;
}

.heroCard,
.dashboardCard {
  border-radius: 28px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--card-shadow);
}

.heroCard {
  padding: 22px 20px;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) auto;
  gap: 16px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 18%, transparent), transparent 36%),
    linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, white), var(--surface));
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
  max-width: 22ch;
  font-size: clamp(1.4rem, 4vw, 2rem);
  line-height: 1.05;
}

.heroText,
.controlCopy,
.summaryCard span,
.chartHead span,
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

.dashboardCard {
  padding: 18px;
  display: grid;
  gap: 16px;
}

.controlHeader,
.summaryRow,
.customControls {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.chartGrid {
  display: grid;
  gap: 12px;
}

.controlHeader {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.7fr);
  align-items: end;
}

.controlActions {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.actionButtons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.controlHeader h3 {
  text-align: left;
}

.modeRow {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.modeChip,
.eventBadge,
.ghostButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
}

.modeChip {
  background: var(--surface-soft);
  color: var(--text-main);
}

.ghostButton {
  background: var(--surface-soft);
  color: var(--text-main);
}

.ghostButton:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.modeChip.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: color-mix(in srgb, var(--accent) 58%, var(--line));
}

.customControls {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-soft) 78%, white);
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  flex-wrap: wrap;
}

.rangeError {
  margin: 0;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, #de6f4d 28%, var(--line));
  background: color-mix(in srgb, #de6f4d 10%, var(--surface));
  color: #8b3a21;
  text-align: left;
  font-weight: 600;
}

.summaryCard,
.chartCard,
.activityCard {
  border-radius: 22px;
  background: var(--surface-soft);
}

.summaryCard {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 130px;
}

.summaryCard strong {
  font-size: clamp(1.4rem, 4vw, 1.9rem);
  text-align: left;
}

.chartGrid {
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
}

.chartCard,
.activityCard {
  padding: 14px;
}

.chartHead,
.activityHead,
.eventItem {
  display: flex;
  gap: 10px;
}

.chartHead,
.activityHead {
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
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

.chartFrame.donut {
  min-height: 260px;
}

.eventList {
  display: grid;
  gap: 10px;
}

.activityDescription {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-soft) 82%, white);
  color: var(--text-muted);
  text-align: left;
}

.activityDescription strong {
  color: var(--text-main);
}

.activitySegments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
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
}

.activitySegment strong {
  color: var(--accent-strong);
}

.activitySegment.active {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 44%, var(--line));
}

.eventItem {
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 76%, white);
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
  .controlHeader,
  .summaryRow,
  .chartGrid,
  .customControls {
    grid-template-columns: 1fr;
  }

  .controlActions {
    justify-items: start;
  }

  .actionButtons {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .heroCard,
  .dashboardCard {
    padding: 16px 14px;
    border-radius: 22px;
  }

  .eventItem,
  .activityHead {
    flex-direction: column;
    align-items: flex-start;
  }

  .toggleChip {
    width: 100%;
    justify-content: flex-start;
  }

  .activitySegment {
    width: 100%;
  }
}
</style>
