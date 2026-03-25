<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Chart from 'chart.js/auto';
import { DASHBOARD_GRANULARITY, TaskActivityDashboard } from '../domain/activity';

const props = defineProps({
  analytics: { type: Object, required: true },
});
const emit = defineEmits(['clear-analytics']);

const dashboardService = new TaskActivityDashboard();
const viewMode = ref('day');
const customGranularity = ref(DASHBOARD_GRANULARITY.DAY);
const customStart = ref('');
const customEnd = ref('');
const trendCanvas = ref(null);
const mixCanvas = ref(null);

let trendChart;
let mixChart;

const today = new Date();
const todayInputValue = today.toISOString().slice(0, 10);
const weekAgoInputValue = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString().slice(0, 10);

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
  if (!startDate || !endDate) {
    return '';
  }

  return startDate > endDate ? 'Rango de fechas invalido' : '';
});

const dashboard = computed(() => {
  if (viewMode.value === 'week') {
    return dashboardService.build(props.analytics, {
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
      referenceDate: new Date(),
      granularity: customGranularity.value,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
  }

  return dashboardService.build(props.analytics, {
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

  return '';
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

function destroyCharts() {
  trendChart?.destroy();
  mixChart?.destroy();
  trendChart = undefined;
  mixChart = undefined;
}

function renderCharts() {
  if (!trendCanvas.value || !mixCanvas.value) return;

  destroyCharts();

  trendChart = new Chart(trendCanvas.value, {
    type: 'bar',
    data: {
      labels: dashboard.value.series.map(bucket => bucket.label),
      datasets: [
        {
          label: 'Completadas',
          data: dashboard.value.series.map(bucket => bucket.completed),
          backgroundColor: '#de6f4d',
          borderRadius: 12,
          borderSkipped: false,
        },
        {
          label: 'Eliminadas',
          data: dashboard.value.series.map(bucket => bucket.deleted),
          backgroundColor: '#f0b074',
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
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

  mixChart = new Chart(mixCanvas.value, {
    type: 'doughnut',
    data: {
      labels: ['Completadas', 'Eliminadas'],
      datasets: [
        {
          data: [dashboard.value.summary.completed, dashboard.value.summary.deleted],
          backgroundColor: ['#de6f4d', '#f0b074'],
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

watch(dashboard, renderCharts, { deep: true });
watch([viewMode, customGranularity, customStart, customEnd], renderCharts);

onMounted(renderCharts);
onBeforeUnmount(destroyCharts);
</script>

<template>
  <section class="dashboardPage">
    <article class="heroCard">
      <div class="heroCopy">
        <p class="eyebrow">Panel</p>
        <h2>Panel de revisión</h2>
        <p class="heroText">
          Todo sale del historial local-first: tareas completadas, tareas eliminadas y el tramo de tiempo que quieras mirar.
        </p>
      </div>

      <div class="heroMeta">
        <p class="heroRange">{{ dashboard.range.label }}</p>
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
          <button type="button" class="ghostButton" @click="emit('clear-analytics')">
            Limpiar estadisticas
          </button>
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

      <div class="summaryRow">
        <article class="summaryCard">
          <span>Cumplidas</span>
          <strong>{{ dashboard.summary.completed }}</strong>
        </article>
        <article class="summaryCard">
          <span>Eliminadas</span>
          <strong>{{ dashboard.summary.deleted }}</strong>
        </article>
        <article class="summaryCard">
          <span>Gestionadas</span>
          <strong>{{ dashboard.summary.handled }}</strong>
        </article>
      </div>

      <div class="chartGrid">
        <article class="chartCard">
          <div class="chartHead">
            <strong>{{ trendLabel }}</strong>
            <span>Completadas vs eliminadas</span>
          </div>
          <div class="chartFrame">
            <canvas ref="trendCanvas"></canvas>
          </div>
        </article>

        <article class="chartCard compact">
          <div class="chartHead">
            <strong>Balance</strong>
            <span>Como se cierran tus entradas</span>
          </div>
          <div class="completionHero">
            <span class="completionCaption">Cumplimiento</span>
            <strong>{{ dashboard.summary.completionRate }}%</strong>
          </div>
          <div class="chartFrame donut">
            <canvas ref="mixCanvas"></canvas>
          </div>
        </article>
      </div>

      <article class="activityCard">
        <div class="activityHead">
          <strong>Actividad reciente del rango</strong>
          <span>{{ dashboard.recentEvents.length }} eventos visibles</span>
        </div>

        <div v-if="dashboard.recentEvents.length" class="eventList">
          <article
            v-for="event in dashboard.recentEvents"
            :key="event.id"
            class="eventItem"
            :data-tone="eventTone(event.type)"
          >
            <div class="eventCopy">
              <strong>{{ event.title || 'Tarea sin titulo' }}</strong>
              <p>{{ formatEventDate(event.happenedAt) }}</p>
            </div>
            <span class="eventBadge">{{ eventLabel(event.type) }}</span>
          </article>
        </div>
        <p v-else class="emptyText">No hay actividad guardada en este tramo de tiempo.</p>
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
.heroRange,
.controlCopy,
.summaryCard span,
.chartHead span,
.eventCopy p,
.emptyText,
.rangeError {
  color: var(--text-muted);
}

.heroText,
.heroRange,
.controlCopy,
.emptyText {
  margin-top: 1rem;
}

.heroMeta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.dashboardCard {
  padding: 18px;
  display: grid;
  gap: 16px;
}

.controlHeader,
.summaryRow,
.chartGrid,
.customControls {
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

.controlHeader h3 {
  text-align: left;
}

.modeRow {
  display: flex;
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

.summaryRow {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .heroMeta {
    align-items: flex-start;
  }

  .controlActions {
    justify-items: start;
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
}
</style>
