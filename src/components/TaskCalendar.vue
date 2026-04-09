<script setup>
import { computed, ref } from 'vue';
import TodoList from './TodoList.vue';
import {
  buildCalendarDraftForDate,
  CALENDAR_VIEW_MODES,
  TaskCalendarBoardService,
} from '../domain/calendar';

const props = defineProps({
  tasks: { type: Array, required: true },
  editingTaskId: { type: String, default: '' },
});

const emit = defineEmits([
  'toggle',
  'remove',
  'update',
  'toggle-subtask',
  'open-external',
  'create-on-date',
]);

const boardService = new TaskCalendarBoardService();
const visibleMonth = ref(new Date());
const selectedDate = ref(new Date());
const focusMode = ref(CALENDAR_VIEW_MODES.ALL);

const modeOptions = Object.freeze([
  { id: CALENDAR_VIEW_MODES.ALL, label: 'Todo' },
  { id: CALENDAR_VIEW_MODES.DUE, label: 'Fechas' },
  { id: CALENDAR_VIEW_MODES.FOLLOW_UP, label: 'Seguimiento' },
  { id: CALENDAR_VIEW_MODES.COMPLETED, label: 'Cierres' },
]);

const board = computed(() => boardService.build(props.tasks, {
  visibleMonth: visibleMonth.value,
  selectedDate: selectedDate.value,
  mode: focusMode.value,
}));

const selectedDayTitle = computed(() => new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(board.value.selectedDay.value));

const selectedDaySummary = computed(() => {
  const { counts } = board.value.selectedDay;
  const parts = [];

  if (focusMode.value !== CALENDAR_VIEW_MODES.COMPLETED && counts.due) {
    parts.push(`${counts.due} fecha${counts.due === 1 ? '' : 's'}`);
  }

  if (focusMode.value !== CALENDAR_VIEW_MODES.DUE && counts.followUp) {
    parts.push(`${counts.followUp} seguimiento${counts.followUp === 1 ? '' : 's'}`);
  }

  if (counts.completed) {
    parts.push(`${counts.completed} cierre${counts.completed === 1 ? '' : 's'}`);
  }

  if (!parts.length) {
    return 'Dia liviano para planear sin ruido.';
  }

  return parts.join(' · ');
});

const monthStats = computed(() => [
  { id: 'scheduled', label: 'Programadas', value: board.value.monthStats.scheduled },
  { id: 'followUps', label: 'Seguimientos', value: board.value.monthStats.followUps },
  { id: 'completed', label: 'Cierres', value: board.value.monthStats.completed },
  { id: 'withoutDate', label: 'Sin fecha', value: board.value.monthStats.withoutDate },
]);

function shiftMonth(delta) {
  const nextMonth = new Date(board.value.visibleMonth.value);
  nextMonth.setMonth(nextMonth.getMonth() + delta, 1);
  visibleMonth.value = nextMonth;
  selectedDate.value = new Date(nextMonth);
}

function goToToday() {
  const today = new Date();
  visibleMonth.value = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate.value = today;
}

function selectDay(day) {
  selectedDate.value = new Date(day.date);
  if (!day.isCurrentMonth) {
    visibleMonth.value = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
  }
}

function selectMode(modeId) {
  focusMode.value = modeId;
}

function createOnSelectedDate() {
  emit('create-on-date', buildCalendarDraftForDate(board.value.selectedDay.value));
}

function formatUpcomingDate(value) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(value);
}

function formatTaskCountLabel(value = 0) {
  return `${value} tarea${value === 1 ? '' : 's'}`;
}

function formatUpcomingHeadline(day) {
  return `${formatUpcomingDate(day.date)} -> ${formatTaskCountLabel(day.count)}`;
}

function formatBusiestDaySummary() {
  if (!board.value.monthStats.busiestDay) {
    return 'No hubo picos visibles este mes.';
  }

  const busiestDay = board.value.monthStats.busiestDay;
  return `${busiestDay.label} -> ${formatTaskCountLabel(busiestDay.count)}`;
}

function formatWithoutDateSummary() {
  return `${board.value.monthStats.withoutDate} tarea${board.value.monthStats.withoutDate === 1 ? '' : 's'} sin fecha`;
}

function formatLoadMinutes(value) {
  if (!value) return 'Ligero';
  if (value < 45) return `${value}m`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function buildDayAriaLabel(day) {
  const label = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(day.date);

  return day.visibleCount
    ? `${label}, ${day.visibleCount} tareas visibles`
    : label;
}

defineExpose({
  goToToday,
});
</script>

<template>
  <section class="calendarShell">
    <div class="calendarHeader">
      <div class="calendarMonthBlock">
        <p class="eyebrow">Calendario premium</p>
        <div class="calendarMonthRow">
          <div>
            <h3>{{ board.visibleMonth.label }}</h3>
            <p class="calendarMicrocopy">Fechas, seguimiento y cierres en una sola vista local.</p>
          </div>
          <div class="calendarMonthActions">
            <button type="button" class="ghostButton smallButton" @click="shiftMonth(-1)">
              Anterior
            </button>
            <button type="button" class="ghostButton smallButton" @click="goToToday">
              Hoy
            </button>
            <button type="button" class="ghostButton smallButton" @click="shiftMonth(1)">
              Siguiente
            </button>
          </div>
        </div>

        <div class="calendarModeRow">
          <button
            v-for="mode in modeOptions"
            :key="mode.id"
            type="button"
            class="calendarModeButton"
            :class="{ active: focusMode === mode.id }"
            @click="selectMode(mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>

      <div class="calendarStats">
        <article v-for="stat in monthStats" :key="stat.id" class="calendarStatCard">
          <strong>{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
        </article>
      </div>
    </div>

    <transition name="calendarSwap" mode="out-in">
      <div :key="`${board.visibleMonth.key}-${focusMode}`" class="calendarLayout">
        <article class="calendarMonthCard">
          <div class="calendarWeekdays">
            <span v-for="weekday in board.weekdayLabels" :key="weekday">{{ weekday }}</span>
          </div>

          <div class="calendarGrid">
            <button
              v-for="day in board.days"
              :key="day.dateKey"
              type="button"
              class="calendarDay"
              :class="{
                muted: !day.isCurrentMonth,
                selected: day.isSelected,
                today: day.isToday,
                busy: day.visibleCount,
              }"
              :aria-label="buildDayAriaLabel(day)"
              @click="selectDay(day)"
            >
              <div class="calendarDayTop">
                <span class="calendarDayNumber">{{ day.dayNumber }}</span>
                <strong v-if="day.visibleCount" class="calendarDayCount">{{ day.visibleCount }}</strong>
              </div>

              <div class="calendarDayDots" aria-hidden="true">
                <span v-if="day.counts.due" class="calendarDot due"></span>
                <span v-if="day.counts.followUp" class="calendarDot followUp"></span>
                <span v-if="day.counts.completed" class="calendarDot completed"></span>
              </div>

              <p v-if="day.previewTitle" class="calendarDayPreview">{{ day.previewTitle }}</p>
            </button>
          </div>
        </article>

        <article class="calendarDetailCard">
          <div class="calendarDetailHeader">
            <div>
              <p class="eyebrow">{{ board.selectedDay.key === board.days.find(day => day.isToday)?.dateKey ? 'Hoy' : 'Seleccion' }}</p>
              <h3 class="calendarDetailTitle">{{ selectedDayTitle }}</h3>
              <p class="calendarMicrocopy">{{ selectedDaySummary }}</p>
            </div>
            <button type="button" class="primaryButton" @click="createOnSelectedDate">
              Nueva en este dia
            </button>
          </div>

          <TodoList
            :todos="board.selectedDay.tasks"
            :editing-task-id="props.editingTaskId"
            empty-message="No hay tareas visibles para este dia."
            @toggle="emit('toggle', $event)"
            @remove="emit('remove', $event)"
            @update="emit('update', $event)"
            @toggle-subtask="emit('toggle-subtask', $event)"
            @open-external="emit('open-external', $event)"
          />
        </article>

        <aside class="calendarSideCard">
          <div class="calendarSideSection">
            <div class="sectionHeader compact calendarSideHeader">
              <div>
                <p class="calendarSideKicker">Cerca de hoy</p>
                <h3 class="calendarSideTitle">Proximas cargas</h3>
                <p class="calendarSectionNote">Fechas cercanas donde ya hay movimiento visible.</p>
              </div>
            </div>

            <div v-if="board.upcomingDays.length" class="upcomingList">
              <button
                v-for="day in board.upcomingDays"
                :key="day.dateKey"
                type="button"
                class="upcomingRow"
                @click="selectDay(day)"
              >
                <span class="upcomingPrimary">
                  <strong class="upcomingLine">{{ formatUpcomingHeadline(day) }}</strong>
                  <small class="upcomingHint">{{ day.title || 'Hay carga visible ese dia.' }}</small>
                </span>
              </button>
            </div>
            <p v-else class="emptyText">No hay dias con carga visible cerca de hoy.</p>
          </div>

          <div class="calendarSideSection">
            <div class="sectionHeader compact calendarSideHeader">
              <div>
                <h3 class="calendarSideTitle">Lectura del mes</h3>
                <p class="calendarSectionNote">Resumen local de lo que este mes te esta diciendo.</p>
              </div>
            </div>

            <div class="rhythmList">
              <div class="rhythmCard">
                <span>Fecha con mas carga</span>
                <strong>{{ formatBusiestDaySummary() }}</strong>
              </div>
              <div class="rhythmCard">
                <span>Tareas sin fecha</span>
                <strong>{{ formatWithoutDateSummary() }}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.calendarShell {
  display: grid;
  gap: var(--section-gap);
  min-width: 0;
  overflow-x: clip;
}

.calendarHeader,
.calendarMonthCard,
.calendarDetailCard,
.calendarSideCard {
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.calendarHeader {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 30px;
  border: 1px solid var(--hero-surface-border);
  background: var(--hero-surface);
  box-shadow: var(--hero-surface-shadow);
}

.calendarMonthRow,
.calendarDetailHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.calendarMonthBlock h3,
.calendarDetailTitle {
  margin: 0;
  font-size: clamp(1.12rem, 2.8vw, 1.5rem);
}

.calendarMicrocopy {
  margin: 6px 0 0;
  color: var(--text-muted);
}

.calendarHeader .eyebrow,
.calendarHeader .calendarMonthBlock h3,
.calendarHeader .calendarMicrocopy,
.calendarHeader .calendarStatCard strong,
.calendarHeader .calendarStatCard span {
  color: var(--hero-on);
}

.calendarHeader .calendarMicrocopy,
.calendarHeader .calendarStatCard span {
  color: var(--hero-on-muted);
}

.calendarMonthActions,
.calendarModeRow,
.calendarStats,
.calendarDetailMetrics {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.smallButton {
  min-height: 40px;
  padding-inline: 14px;
}

.calendarModeButton,
.metricPill {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
  background: color-mix(in srgb, var(--surface-soft) 82%, white);
  color: var(--text-main);
  font-weight: 600;
}

.calendarModeButton.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
}

.calendarHeader .ghostButton,
.calendarHeader .calendarModeButton {
  border-color: var(--hero-chip-line);
  background: var(--hero-chip-surface);
  color: var(--hero-on);
}

.calendarHeader .calendarModeButton.active {
  background: color-mix(in srgb, white 88%, transparent);
  color: var(--accent-strong);
  border-color: color-mix(in srgb, var(--hero-on) 34%, transparent);
}

.calendarStats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.calendarStatCard,
.rhythmCard {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 68%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
}

.calendarHeader .calendarStatCard {
  background: var(--hero-card-surface);
  border-color: var(--hero-card-line);
}

.calendarStatCard strong,
.rhythmCard strong {
  font-size: 1.2rem;
}

.calendarLayout {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
}

.calendarMonthCard,
.calendarDetailCard,
.calendarSideCard {
  padding: 0;
}

.calendarMonthCard {
  display: grid;
  gap: 12px;
}

.calendarWeekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.calendarGrid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendarDay {
  min-height: 106px;
  padding: 10px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 8%, var(--line));
  background: color-mix(in srgb, var(--surface) 82%, white);
  display: grid;
  gap: 8px;
  align-content: start;
  text-align: left;
}

.calendarDay.muted {
  opacity: 0.62;
}

.calendarDay.today {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
}

.calendarDay.selected {
  background: color-mix(in srgb, var(--accent) 12%, white);
  border-color: color-mix(in srgb, var(--accent) 68%, var(--line));
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.08);
}

.calendarDayTop {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.calendarDayNumber {
  font-weight: 700;
}

.calendarDayCount {
  min-width: 28px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 18%, white);
  font-size: 0.82rem;
}

.calendarDayDots {
  display: flex;
  gap: 6px;
  min-height: 10px;
}

.calendarDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--text-muted);
}

.calendarDot.due,
.metricPill.due {
  background: color-mix(in srgb, var(--accent) 82%, white);
}

.calendarDot.followUp,
.metricPill.followUp {
  background: #f1b24a;
}

.calendarDot.completed,
.metricPill.completed {
  background: #48a174;
}

.calendarDayPreview {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.25;
  color: var(--text-main);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.calendarDetailCard,
.calendarSideCard {
  display: grid;
  gap: 14px;
  align-content: start;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
}

.calendarSideCard {
  grid-template-columns: 1fr;
}

.calendarSideSection {
  --calendar-side-body-width: min(calc(100% - clamp(42px, 12vw, 82px)), 25rem);
  display: grid;
  gap: 12px;
}

.calendarSideSection + .calendarSideSection {
  margin-top: 10px;
}

.calendarSideHeader {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--line));
  background: linear-gradient(180deg, color-mix(in srgb, var(--section-tint-soft) 74%, white), color-mix(in srgb, var(--surface) 96%, white));
}

.calendarSideKicker,
.calendarSectionNote {
  margin: 0;
  text-align: left;
}

.calendarSideKicker {
  margin-bottom: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-strong);
}

.calendarSideTitle {
  margin: 0;
}

.calendarSectionNote {
  margin-top: 6px;
  color: var(--text-muted);
  line-height: 1.4;
}

.upcomingList {
  display: grid;
  gap: 10px;
  width: var(--calendar-side-body-width);
  margin-inline: 0;
  justify-self: start;
  align-items: flex-start;
}

.upcomingRow {
  width: 100%;
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  text-align: left;
}

.upcomingPrimary {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.upcomingLine {
  display: block;
  font-size: 1rem;
  line-height: 1.3;
  color: var(--text-main);
}

.upcomingHint {
  display: block;
  color: var(--text-muted);
  line-height: 1.35;
}

.empty {
  text-align: center;
}

.rhythmList {
  display: grid;
  gap: 10px;
  width: var(--calendar-side-body-width);
  margin-inline: 0;
  justify-self: start;
}

.rhythmCard span {
  color: var(--text-muted);
  font-weight: 700;
}

.rhythmCard strong {
  line-height: 1.35;
}

.calendarSideSection > .emptyText {
  width: var(--calendar-side-body-width);
  margin-inline: 0;
  justify-self: start;
  text-align: left;
}

.calendarDetailCard > :not(.calendarDetailHeader) {
  width: min(calc(100% - var(--section-body-inset)), var(--section-body-max));
  margin-inline: auto;
}

.calendarSwap-enter-active,
.calendarSwap-leave-active {
  transition: opacity 240ms ease, transform 240ms ease, filter 240ms ease;
}

.calendarSwap-enter-from,
.calendarSwap-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.988);
  filter: blur(6px);
}

@media (max-width: 1040px) {
  .calendarLayout {
    grid-template-columns: 1fr;
  }

  .calendarStats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .calendarMonthCard,
  .calendarDetailCard,
  .calendarSideCard {
    border-radius: 0;
    padding: 0;
  }

  .calendarHeader {
    padding: 18px 16px;
    border-radius: 26px;
  }

  .calendarMonthRow,
  .calendarDetailHeader {
    flex-direction: column;
    align-items: stretch;
  }

  .calendarMonthActions,
  .calendarModeRow {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .calendarMonthActions::-webkit-scrollbar,
  .calendarModeRow::-webkit-scrollbar {
    display: none;
  }

  .calendarWeekdays {
    font-size: 0.7rem;
  }

  .calendarGrid {
    gap: 6px;
  }

  .calendarDay {
    min-height: 82px;
    padding: 8px;
    border-radius: 16px;
  }

  .calendarDayPreview {
    display: none;
  }

  .calendarStats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

@media (max-width: 640px) {
  .calendarMonthActions,
  .calendarModeRow {
    overflow-x: visible;
    flex-wrap: wrap;
  }

  .calendarStats {
    grid-template-columns: 1fr;
  }
}
</style>
