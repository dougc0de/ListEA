<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AddTask from './AddTask.vue';
import TodoList from './TodoList.vue';
import {
  cancelReminder,
  clearAllReminderTimers,
  enableReminders,
  getReminderPermission,
  scheduleReminder,
} from '../services/reminders';
import { AvatarCoach, AvatarPreferences, AVATAR_TIMINGS } from '../domain/avatar';
import { FILTER_IDS, TaskFilterCatalog, TaskFilterService } from '../domain/filters';
import { BacklogInsightAnalyzer } from '../domain/insights';
import { LocalTaskRepository } from '../domain/localFirst';
import { NavigationCatalog } from '../domain/navigation';
import { RecurrenceEngine } from '../domain/recurrence';
import { TaskContextPresenter, TaskFactory } from '../domain/tasks';
import { TodayBoardBuilder } from '../domain/today';

const props = defineProps({
  currentView: { type: String, default: 'today' },
});

const emit = defineEmits(['navigate']);

const taskFactory = new TaskFactory();
const repository = new LocalTaskRepository({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  factory: taskFactory,
});
const recurrenceEngine = new RecurrenceEngine(taskFactory);
const avatarCoach = new AvatarCoach();
const filterCatalog = new TaskFilterCatalog();
const filterService = new TaskFilterService();
const insightAnalyzer = new BacklogInsightAnalyzer();
const todayBoardBuilder = new TodayBoardBuilder();
const navigationCatalog = new NavigationCatalog();
const contextPresenter = new TaskContextPresenter();
const avatarIllustration = '/docs/assets/listea movimientos.png';

const tasks = ref([]);
const preferences = ref(repository.normalizePreferences());
const activeFilterId = ref(FILTER_IDS.TODAY);
const searchQuery = ref('');
const mounted = ref(false);

function sortTasksByRelevance(list) {
  return list.slice().sort((left, right) => {
    const leftDate = left.getRelevantDate() ? new Date(left.getRelevantDate()).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.getRelevantDate() ? new Date(right.getRelevantDate()).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    const priorityWeight = { high: 0, medium: 1, low: 2 };
    return priorityWeight[left.priority] - priorityWeight[right.priority];
  });
}

function applySearch(list) {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return list;

  return list.filter(task =>
    task.title.toLowerCase().includes(query)
    || task.notes.toLowerCase().includes(query)
    || task.project.toLowerCase().includes(query)
    || task.area.toLowerCase().includes(query)
    || task.tags.some(tag => tag.toLowerCase().includes(query)),
  );
}

function loadState() {
  const state = repository.load();
  tasks.value = state.tasks;
  preferences.value = state.preferences;
}

function persistState() {
  repository.save({
    tasks: tasks.value,
    preferences: preferences.value,
  });
}

function addTask(payload) {
  const task = taskFactory.create(payload);
  if (!task.title) return;

  tasks.value = [task, ...tasks.value];
}

function toggleTask(id) {
  const task = tasks.value.find(item => item.id === id);
  if (!task) return;

  if (task.isCompleted()) {
    task.reopen();
    return;
  }

  task.complete();
  const nextOccurrence = recurrenceEngine.createNextOccurrence(task, task.completedAt);
  if (nextOccurrence) {
    tasks.value = [nextOccurrence, ...tasks.value];
  }
}

function updateTask(payload) {
  const task = tasks.value.find(item => item.id === payload.id);
  if (!task) return;
  task.applyPatch(payload);
}

function toggleSubtask({ taskId, subtaskId }) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  const subtask = task.subtasks.find(item => item.id === subtaskId);
  if (!subtask) return;

  subtask.done = !subtask.done;
  task.updatedAt = new Date().toISOString();
}

async function removeTask(id) {
  await cancelReminder(id);
  tasks.value = tasks.value.filter(task => task.id !== id);
}

function setAvatarPreferences(patch) {
  preferences.value.avatar = new AvatarPreferences({
    ...preferences.value.avatar,
    ...patch,
  });
}

async function enableNotificationsFlow() {
  const permission = await enableReminders();
  preferences.value.reminderPermission = permission;
  preferences.value.notificationsEnabled = permission === 'granted';
}

async function disableNotificationsFlow() {
  preferences.value.notificationsEnabled = false;
  await clearAllReminderTimers();
  await Promise.all(tasks.value.map(task => cancelReminder(task.id)));
}

function markReminderSent(id) {
  const task = tasks.value.find(item => item.id === id);
  if (!task) return;
  task.applyPatch({ reminderSent: true });
}

async function syncReminders() {
  await clearAllReminderTimers();
  await Promise.all(tasks.value.map(task => cancelReminder(task.id)));

  if (!preferences.value.notificationsEnabled) {
    return;
  }

  for (const task of tasks.value) {
    if (task.isCompleted()) continue;
    const reminderAt = avatarCoach.getReminderAt(task, preferences.value.avatar);
    if (!reminderAt || task.reminderSent) continue;

    await scheduleReminder({
      ...task.toJSON(),
      reminderAt,
    }, markReminderSent);
  }
}

const resolvedView = computed(() => navigationCatalog.getFallbackView(props.currentView));
const openTasks = computed(() => sortTasksByRelevance(tasks.value.filter(task => !task.isCompleted())));
const completedTasks = computed(() =>
  tasks.value
    .filter(task => task.isCompleted())
    .slice()
    .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt))
    .slice(0, 6),
);
const activeFilters = computed(() => [
  ...filterCatalog.getPrimaryFilters(),
  ...filterCatalog.getDynamicFilters(openTasks.value),
]);
const filteredTasks = computed(() => {
  const filtered = filterService.apply(openTasks.value, activeFilterId.value, {
    referenceDate: new Date(),
  });
  return sortTasksByRelevance(applySearch(filtered));
});
const todayBoard = computed(() =>
  todayBoardBuilder.build(filteredTasks.value, {
    referenceDate: new Date(),
  }),
);
const backlogInsights = computed(() =>
  insightAnalyzer.analyze(openTasks.value, {
    referenceDate: new Date(),
  }),
);
const avatarCard = computed(() =>
  avatarCoach.buildSnapshot({
    tasks: openTasks.value,
    insights: backlogInsights.value,
    preferences: preferences.value.avatar,
    referenceDate: new Date(),
  }),
);
const summary = computed(() => ({
  pending: openTasks.value.length,
  overdue: openTasks.value.filter(task => task.dueAt && new Date(task.dueAt) < new Date()).length,
  today: filterService.apply(openTasks.value, FILTER_IDS.TODAY, { referenceDate: new Date() }).length,
}));
const summaryCards = computed(() => [
  { id: 'pending', label: 'Abiertas', value: summary.value.pending },
  { id: 'today', label: 'Para hoy', value: summary.value.today },
  { id: 'overdue', label: 'Vencidas', value: summary.value.overdue },
]);

watch(
  () => resolvedView.value,
  nextView => {
    if (nextView !== props.currentView) {
      emit('navigate', nextView);
    }
  },
);

watch(
  [tasks, preferences],
  async () => {
    if (!mounted.value) return;
    persistState();
    await syncReminders();
  },
  { deep: true },
);

onMounted(async () => {
  loadState();
  preferences.value.reminderPermission = await getReminderPermission();
  mounted.value = true;
  persistState();
  await syncReminders();
});

onBeforeUnmount(() => {
  clearAllReminderTimers();
});
</script>

<template>
  <section class="tasksShell">
    <section v-if="resolvedView !== 'settings'" class="topBar">
      <div class="topCopy">
        <p class="eyebrow">Captura y ejecuta</p>
        <h1>Tu lista empieza en el input, no en una portada.</h1>
      </div>
      <div class="topStats">
        <article v-for="card in summaryCards" :key="card.id" class="statCard">
          <strong>{{ card.value }}</strong>
          <span>{{ card.label }}</span>
        </article>
      </div>
    </section>

    <AddTask v-if="resolvedView !== 'settings'" @add="addTask" />

    <section v-if="avatarCard.visible && resolvedView === 'today'" class="avatarCard" :data-tone="avatarCard.tone">
      <img :src="avatarIllustration" alt="Avatar de ListEA" class="avatarImage" />
      <div class="avatarCopy">
        <p class="eyebrow">Avatar</p>
        <h3>{{ avatarCard.title }}</h3>
        <p>{{ avatarCard.message }}</p>
      </div>
    </section>

    <section v-if="resolvedView !== 'settings'" class="filterBar">
      <div class="filterRow">
        <button
          v-for="filter in activeFilters"
          :key="filter.id"
          type="button"
          class="filterChip"
          :class="{ active: activeFilterId === filter.id }"
          @click="activeFilterId = filter.id"
        >
          {{ filter.label }}
        </button>
      </div>

      <label class="searchField">
        <span class="srOnly">Buscar tareas</span>
        <input v-model="searchQuery" type="search" placeholder="Buscar por tarea, proyecto, area o tag" />
      </label>
    </section>

    <section v-if="resolvedView === 'today'" class="laneGrid">
      <article v-for="lane in todayBoard" :key="lane.id" class="laneCard">
        <div class="laneHeader">
          <h3>{{ lane.title }}</h3>
          <span>{{ lane.items.length }}</span>
        </div>

        <TodoList
          :todos="lane.items"
          empty-message="Nada que mostrar en esta vista."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
        />
      </article>
    </section>

    <section v-else-if="resolvedView === 'backlog'" class="backlogGrid">
      <article class="panelCard insightsPanel">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Backlog inteligente</p>
            <h3>Senales que conviene resolver primero</h3>
          </div>
        </div>

        <div v-if="backlogInsights.length" class="insightList">
          <article v-for="insight in backlogInsights" :key="insight.id" class="insightCard">
            <strong>{{ insight.title }}</strong>
            <p>{{ insight.message }}</p>
          </article>
        </div>
        <p v-else class="emptyText">No hay alertas relevantes en el backlog.</p>
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Tareas activas</p>
            <h3>Ordenadas por fecha y prioridad</h3>
          </div>
        </div>

        <TodoList
          :todos="filteredTasks"
          empty-message="No hay tareas activas para este filtro."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
        />
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Completadas recientes</p>
            <h3>Cierre visible sin perder control</h3>
          </div>
        </div>

        <TodoList
          :todos="completedTasks"
          empty-message="Todavia no hay tareas completadas."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
        />
      </article>
    </section>

    <section v-else class="settingsGrid">
      <article class="panelCard">
        <p class="eyebrow">Local-first</p>
        <h3>Primero local, luego sincronizacion</h3>
        <p class="panelText">
          Todo se guarda primero en el dispositivo. La interfaz no depende de red para crear, editar o completar tareas.
        </p>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Notificaciones</p>
        <h3>Recordatorios moviles con control del usuario</h3>
        <p class="panelText">Estado actual: {{ preferences.reminderPermission }}</p>
        <div class="buttonRow">
          <button
            v-if="!preferences.notificationsEnabled"
            type="button"
            class="primaryButton"
            @click="enableNotificationsFlow"
          >
            Activar recordatorios
          </button>
          <button
            v-else
            type="button"
            class="ghostButton"
            @click="disableNotificationsFlow"
          >
            Desactivar recordatorios
          </button>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Avatar</p>
        <h3>Acompania sin invadir</h3>
        <div class="settingsStack">
          <label class="checkboxRow">
            <input
              :checked="preferences.avatar.enabled"
              type="checkbox"
              @change="setAvatarPreferences({ enabled: $event.target.checked })"
            />
            <span>Mostrar avatar</span>
          </label>

          <label class="fieldGroup">
            <span>Momento de aparicion</span>
            <select
              class="detailField"
              :value="preferences.avatar.timing"
              @change="setAvatarPreferences({ timing: $event.target.value })"
            >
              <option :value="AVATAR_TIMINGS.NEVER">Nunca</option>
              <option :value="AVATAR_TIMINGS.BEFORE_10">10 min antes</option>
              <option :value="AVATAR_TIMINGS.BEFORE_5">5 min antes</option>
              <option :value="AVATAR_TIMINGS.ON_TIME">Justo a tiempo</option>
              <option :value="AVATAR_TIMINGS.AFTER_10">10 min despues</option>
            </select>
          </label>

          <label class="checkboxRow">
            <input
              :checked="preferences.avatar.importantOnly"
              type="checkbox"
              @change="setAvatarPreferences({ importantOnly: $event.target.checked })"
            />
            <span>Solo para tareas importantes</span>
          </label>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Contexto de subtareas</p>
        <h3>Siempre visible</h3>
        <p class="panelText">
          Cada subtarea conserva padre, proyecto, estado, prioridad y fecha relevante en la tarjeta principal.
        </p>
        <p class="panelText">{{ contextPresenter.getPriorityLabel('high') }} se usa como referencia de lenguaje consistente.</p>
      </article>
    </section>
  </section>
</template>

<style scoped>
.tasksShell {
  width: min(960px, calc(100% - 24px));
  margin: 0 auto 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.topBar,
.avatarCard,
.panelCard,
.laneCard {
  border-radius: 28px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.topBar {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr);
  gap: 14px;
  padding: 16px 18px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 34%),
    var(--surface);
}

.topCopy h1,
.eyebrow {
  margin: 0;
  text-align: left;
}

.topCopy h1 {
  max-width: 16ch;
  font-size: clamp(1.2rem, 4vw, 1.7rem);
  line-height: 1.05;
}

.eyebrow {
  margin-bottom: 6px;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-strong);
  font-weight: 700;
}

.panelText,
.avatarCopy p,
.emptyText {
  color: var(--text-muted);
}

.topStats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-self: stretch;
}

.statCard {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 76px;
  padding: 12px;
  border-radius: 18px;
  background: var(--surface-soft);
}

.statCard strong {
  font-size: clamp(1.25rem, 4vw, 1.7rem);
}

.avatarCard {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
}

.avatarImage {
  width: 64px;
  height: 64px;
  object-fit: contain;
  flex: 0 0 auto;
}

.avatarCopy h3,
.avatarCopy p {
  margin: 0;
  text-align: left;
}

.avatarCopy h3 {
  margin-bottom: 4px;
  font-size: 1rem;
}

.filterBar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filterRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filterChip,
.ghostButton,
.primaryButton {
  border-radius: 999px;
  border: 1px solid var(--line);
}

.filterChip,
.ghostButton {
  background: var(--surface-soft);
  color: var(--text-main);
}

.filterChip.active,
.primaryButton {
  background: var(--accent);
  color: var(--accent-contrast);
}

.searchField input,
.detailField {
  width: 100%;
  border-radius: 16px;
  border: 1px solid var(--line);
  padding: 14px 16px;
  background: var(--surface-soft);
  color: var(--text-main);
}

.laneGrid,
.backlogGrid,
.settingsGrid {
  display: grid;
  gap: 14px;
}

.laneGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.backlogGrid {
  grid-template-columns: 1.1fr 1fr;
}

.settingsGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.laneCard,
.panelCard {
  padding: 16px;
}

.laneHeader,
.sectionHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.laneHeader h3,
.sectionHeader h3 {
  margin: 0;
  text-align: left;
}

.laneHeader span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--surface-soft);
}

.insightsPanel {
  grid-column: 1 / -1;
}

.insightList {
  display: grid;
  gap: 12px;
}

.insightCard {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--surface-soft);
}

.insightCard strong,
.insightCard p {
  display: block;
  text-align: left;
}

.insightCard p {
  margin: 6px 0 0;
}

.buttonRow,
.settingsStack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.checkboxRow,
.fieldGroup {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.fieldGroup {
  flex-direction: column;
  align-items: flex-start;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 860px) {
  .topBar,
  .avatarCard,
  .laneGrid,
  .backlogGrid,
  .settingsGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .tasksShell {
    width: min(100% - 20px, 960px);
    gap: 12px;
  }

  .topBar,
  .avatarCard,
  .laneCard,
  .panelCard {
    padding: 14px;
    border-radius: 20px;
  }

  .topStats {
    grid-template-columns: 1fr;
  }

  .avatarCard {
    align-items: flex-start;
  }

  .avatarImage {
    width: 56px;
    height: 56px;
  }

  .topCopy h1 {
    max-width: none;
  }
}
</style>
