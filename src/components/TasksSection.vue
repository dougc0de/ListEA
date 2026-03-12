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
import { BackupService, FocusSession, TemplateLibrary } from '../domain/premium';
import { FEATURE_KEYS, FeatureAccessController, PlanRegistry } from '../domain/plans';
import { TaskBoardBuilder, TaskFactory } from '../domain/tasks';
import { ThemeCatalog } from '../domain/themes';

const STORAGE_KEY = 'listea-local-state-v3';

const planRegistry = new PlanRegistry();
const featureAccess = new FeatureAccessController(planRegistry);
const taskFactory = new TaskFactory();
const taskBoardBuilder = new TaskBoardBuilder();
const themeCatalog = new ThemeCatalog();
const templateLibrary = new TemplateLibrary();
const backupService = new BackupService();
const focusSession = new FocusSession();

const defaultSettings = {
  notificationsEnabled: false,
  reminderPermission: 'default',
  planId: 'free',
  themeId: 'light',
};

const todos = ref([]);
const settings = ref({ ...defaultSettings });
const activeTab = ref('pending');
const activePremiumView = ref('list');
const premiumThemesOpen = ref(false);
const searchQuery = ref('');
const mounted = ref(false);
const focusRemainingMs = ref(0);
const focusDuration = ref(25);

let focusIntervalId = null;

function normalizeSettings(rawSettings = {}) {
  return {
    notificationsEnabled: Boolean(rawSettings.notificationsEnabled),
    reminderPermission: rawSettings.reminderPermission ?? 'default',
    planId: rawSettings.planId === 'premium' ? 'premium' : 'free',
    themeId: rawSettings.themeId ?? 'light',
  };
}

function setTheme(themeId) {
  const palette = themeCatalog.getPalette(themeId);
  const canUsePremiumTheme = palette.tier === 'free' || isPremium.value;
  const nextPalette = canUsePremiumTheme ? palette : themeCatalog.getPalette('light');
  settings.value.themeId = nextPalette.id;
  themeCatalog.applyPalette(nextPalette.id);
  if (nextPalette.tier === 'premium') {
    premiumThemesOpen.value = true;
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      todos: todos.value.map(todo => todo.toJSON()),
      settings: settings.value,
    }),
  );
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    todos.value = [
      taskFactory.create({
        title: 'Primer ejemplo',
        notes: 'Puedes editar esta tarea, agregar un snippet o fijar un recordatorio.',
      }),
    ];
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    todos.value = Array.isArray(parsed.todos)
      ? parsed.todos.map((todo, index) => taskFactory.normalize(todo, index)).filter(todo => todo.title)
      : [];

    settings.value = normalizeSettings(parsed.settings);
  } catch {
    todos.value = [];
    settings.value = { ...defaultSettings };
  }
}

function addTodo(payload) {
  const title = typeof payload === 'string' ? payload.trim() : payload?.title?.trim();
  if (!title) return;

  todos.value.unshift(taskFactory.create(payload));
  activeTab.value = 'pending';
}

function toggleTodo(id) {
  const todo = todos.value.find(item => item.id === id);
  if (!todo) return;

  todo.done = !todo.done;
  todo.updatedAt = new Date().toISOString();

  if (todo.done) {
    todo.reminderSent = true;
  } else if (todo.reminderAt) {
    todo.reminderSent = false;
  }
}

function removeTodo(id) {
  cancelReminder(id);
  todos.value = todos.value.filter(todo => todo.id !== id);
}

function updateTodo(payload) {
  const todo = todos.value.find(item => item.id === payload.id);
  if (!todo) return;

  if (typeof payload.title === 'string' && payload.title.trim()) {
    todo.title = payload.title.trim();
  }

  if (typeof payload.notes === 'string') {
    todo.notes = payload.notes;
  }

  if (typeof payload.reminderAt === 'string') {
    const reminderChanged = payload.reminderAt !== todo.reminderAt;
    todo.reminderAt = payload.reminderAt;
    if (reminderChanged) {
      todo.reminderSent = false;
    }
  }

  if (typeof payload.priority === 'string' && canUse(FEATURE_KEYS.TAGS)) {
    todo.priority = payload.priority;
  }

  if (payload.tags !== undefined && canUse(FEATURE_KEYS.TAGS)) {
    todo.tags = taskFactory.normalizeTags(payload.tags);
  }

  todo.updatedAt = new Date().toISOString();
}

function toggleSubtask({ todoId, subtaskId }) {
  if (!canUse(FEATURE_KEYS.SUBTASKS)) return;
  const todo = todos.value.find(item => item.id === todoId);
  if (!todo) return;

  const subtask = todo.subtasks.find(item => item.id === subtaskId);
  if (!subtask) return;

  subtask.done = !subtask.done;
  todo.updatedAt = new Date().toISOString();
}

function markReminderSent(id) {
  const todo = todos.value.find(item => item.id === id);
  if (!todo) return;
  todo.reminderSent = true;
  todo.updatedAt = new Date().toISOString();
}

async function syncReminders() {
  for (const todo of todos.value) {
    await cancelReminder(todo.id);

    if (!settings.value.notificationsEnabled) continue;
    if (!todo.reminderAt || todo.done || todo.reminderSent) continue;

    await scheduleReminder(todo.toJSON(), markReminderSent);
  }
}

async function enableNotifications() {
  if (settings.value.reminderPermission === 'granted') {
    settings.value.notificationsEnabled = true;
    return;
  }

  const permission = await enableReminders();
  settings.value.reminderPermission = permission;
  settings.value.notificationsEnabled = permission === 'granted';
}

async function disableNotifications() {
  settings.value.notificationsEnabled = false;
  await clearAllReminderTimers();

  for (const todo of todos.value) {
    await cancelReminder(todo.id);
  }
}

function canUse(featureKey) {
  return featureAccess.canUse(settings.value.planId, featureKey);
}

function applyTemplate(templateId) {
  const template = templateLibrary.getById(templateId);
  if (!template || !canUse(FEATURE_KEYS.TEMPLATES)) return;

  addTodo({
    title: template.title,
    notes: template.notes,
    reminderAt: '',
    priority: template.priority,
    tags: template.tags,
    subtasks: template.subtasks,
    templateId: template.id,
  });
}

function exportBackup() {
  if (!canUse(FEATURE_KEYS.BACKUP_EXPORT)) return;
  const snapshot = backupService.buildSnapshot({
    todos: todos.value.map(todo => todo.toJSON()),
    settings: settings.value,
  });
  backupService.download('listea-backup.json', snapshot);
}

function startFocus(minutes) {
  if (!canUse(FEATURE_KEYS.FOCUS_MODE)) return;

  focusDuration.value = minutes;
  focusSession.start(minutes);
  updateFocusClock();

  if (focusIntervalId) {
    clearInterval(focusIntervalId);
  }

  focusIntervalId = window.setInterval(() => {
    updateFocusClock();

    if (!focusSession.isRunning() || focusSession.getRemainingMs() === 0) {
      stopFocus();
    }
  }, 1000);
}

function stopFocus() {
  focusSession.stop();
  focusRemainingMs.value = 0;

  if (focusIntervalId) {
    clearInterval(focusIntervalId);
    focusIntervalId = null;
  }
}

function updateFocusClock() {
  focusRemainingMs.value = focusSession.getRemainingMs();
}

function setPlan(planId) {
  settings.value.planId = planId;
  premiumThemesOpen.value = planId === 'premium';

  if (!isPremium.value && themeCatalog.getPalette(settings.value.themeId).tier === 'premium') {
    setTheme('light');
  } else {
    setTheme(settings.value.themeId);
  }
}

const isPremium = computed(() => settings.value.planId === 'premium');
const availablePlans = computed(() => planRegistry.getAllPlans());
const premiumTemplates = computed(() => templateLibrary.getAll());
const freePalettes = computed(() => themeCatalog.getFreePalettes());
const premiumPalettes = computed(() => themeCatalog.getPremiumPalettes());

const pendingTodos = computed(() => todos.value.filter(todo => !todo.done));
const completedTodos = computed(() => todos.value.filter(todo => todo.done));

const filteredBaseTodos = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const base = activeTab.value === 'completed' ? completedTodos.value : pendingTodos.value;

  if (!query) return base;

  return base.filter(todo =>
    todo.title.toLowerCase().includes(query) ||
    todo.notes.toLowerCase().includes(query) ||
    todo.tags.some(tag => tag.toLowerCase().includes(query)),
  );
});

const upcomingTodos = computed(() =>
  pendingTodos.value
    .filter(todo => todo.reminderAt)
    .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt))
    .slice(0, 4),
);

const agendaGroups = computed(() => {
  const groups = new Map();

  pendingTodos.value
    .slice()
    .sort((a, b) => {
      const left = a.reminderAt ? new Date(a.reminderAt).getTime() : new Date(a.createdAt).getTime();
      const right = b.reminderAt ? new Date(b.reminderAt).getTime() : new Date(b.createdAt).getTime();
      return left - right;
    })
    .forEach(todo => {
      const baseDate = todo.reminderAt || todo.createdAt;
      const key = new Date(baseDate).toLocaleDateString();
      const current = groups.get(key) ?? [];
      current.push(todo);
      groups.set(key, current);
    });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
});

const boardColumns = computed(() => taskBoardBuilder.build(pendingTodos.value));
const focusFormatted = computed(() => {
  const totalSeconds = Math.ceil(focusRemainingMs.value / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

watch(
  [todos, settings],
  async () => {
    if (!mounted.value) return;
    persistState();
    setTheme(settings.value.themeId);
    await syncReminders();
  },
  { deep: true },
);

onMounted(async () => {
  loadState();
  settings.value.reminderPermission = await getReminderPermission();
  setTheme(settings.value.themeId);
  mounted.value = true;
  persistState();
  await syncReminders();
});

onBeforeUnmount(() => {
  clearAllReminderTimers();
  stopFocus();
});
</script>

<template>
  <section class="tasksSection">
    <div class="heroCard">
      <div class="heroCopy">
        <p class="eyebrow">{{ isPremium ? 'Premium workspace' : 'Privado, local y mantenible' }}</p>
        <h2>Basado en modalidad Local-first no dependes de la nube.</h2>
        <p class="heroText">
          Crea tareas, editalas, agrega snippets y mucho mas.
        </p>
      </div>

      <div class="heroStats">
        <div class="statCard">
          <span>{{ pendingTodos.length }}</span>
          <p>Pendientes</p>
        </div>
        <div class="statCard">
          <span>{{ completedTodos.length }}</span>
          <p>Completadas</p>
        </div>
      </div>
    </div>

    <AddTask
      :is-premium="isPremium"
      :templates="premiumTemplates"
      @add="addTodo"
      @apply-template="applyTemplate"
    />

    <div v-if="isPremium" class="premiumCommandBar">
      <div class="premiumViews">
        <button
          class="tabButton"
          :class="{ active: activePremiumView === 'list' }"
          type="button"
          @click="activePremiumView = 'list'"
        >
          Lista
        </button>
        <button
          class="tabButton"
          :class="{ active: activePremiumView === 'agenda' }"
          type="button"
          @click="activePremiumView = 'agenda'"
        >
          Agenda
        </button>
        <button
          class="tabButton"
          :class="{ active: activePremiumView === 'board' }"
          type="button"
          @click="activePremiumView = 'board'"
        >
          Board
        </button>
      </div>

      <div class="focusPanel">
        <p class="settingsLabel">Focus mode</p>
        <strong>{{ focusFormatted === '00:00' ? `${focusDuration} min` : focusFormatted }}</strong>
        <div class="focusActions">
          <button type="button" class="miniAction" @click="startFocus(25)">25m</button>
          <button type="button" class="miniAction" @click="startFocus(50)">50m</button>
          <button type="button" class="miniAction" @click="stopFocus">Stop</button>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Vistas de tareas">
        <button
          class="tabButton"
          :class="{ active: activeTab === 'pending' }"
          type="button"
          @click="activeTab = 'pending'"
        >
          Por hacer
        </button>
        <button
          class="tabButton"
          :class="{ active: activeTab === 'completed' }"
          type="button"
          @click="activeTab = 'completed'"
        >
          Hechas
        </button>
        <button
          class="tabButton"
          :class="{ active: activeTab === 'settings' }"
          type="button"
          @click="activeTab = 'settings'"
        >
          Configuraciones
        </button>
      </div>

      <label class="searchField">
        <span class="sr-only">Buscar tareas</span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Buscar por texto, tags o snippet"
        >
      </label>
    </div>

    <div v-if="activeTab !== 'settings'" class="contentStage">
      <div v-if="!isPremium || activePremiumView === 'list'" class="listScroll">
        <TodoList
          :todos="filteredBaseTodos"
          :empty-message="activeTab === 'completed' ? 'No hay tareas completadas todavia.' : 'No hay tareas pendientes. Agrega una nueva.'"
          :is-premium="isPremium"
          @toggle="toggleTodo"
          @remove="removeTodo"
          @update="updateTodo"
          @toggle-subtask="toggleSubtask"
        />
      </div>

      <div v-else-if="activePremiumView === 'agenda'" class="agendaGrid">
        <article v-for="group in agendaGroups" :key="group.label" class="agendaCard">
          <p class="settingsLabel">{{ group.label }}</p>
          <div class="agendaItems">
            <div v-for="todo in group.items" :key="todo.id" class="agendaItem">
              <div class="agendaCopy">
                <strong>{{ todo.title }}</strong>
                <small>{{ todo.reminderAt ? 'Con recordatorio' : 'Sin hora fijada' }}</small>
              </div>
              <span>{{ todo.reminderAt ? new Date(todo.reminderAt).toLocaleTimeString() : 'Pendiente' }}</span>
            </div>
          </div>
        </article>
        <p v-if="!agendaGroups.length" class="emptyPremium">No hay tareas para mostrar en agenda.</p>
      </div>

      <div v-else class="boardGrid">
        <article class="boardColumn">
          <p class="settingsLabel">Alta</p>
          <div v-if="boardColumns.high.length" class="boardItems">
            <div v-for="todo in boardColumns.high" :key="todo.id" class="boardItem">{{ todo.title }}</div>
          </div>
          <p v-else class="emptyPremium">Sin tareas</p>
        </article>
        <article class="boardColumn">
          <p class="settingsLabel">Media</p>
          <div v-if="boardColumns.medium.length" class="boardItems">
            <div v-for="todo in boardColumns.medium" :key="todo.id" class="boardItem">{{ todo.title }}</div>
          </div>
          <p v-else class="emptyPremium">Sin tareas</p>
        </article>
        <article class="boardColumn">
          <p class="settingsLabel">Baja</p>
          <div v-if="boardColumns.low.length" class="boardItems">
            <div v-for="todo in boardColumns.low" :key="todo.id" class="boardItem">{{ todo.title }}</div>
          </div>
          <p v-else class="emptyPremium">Sin tareas</p>
        </article>
      </div>
    </div>

    <div v-else class="settingsPanel">
      <article class="settingsCard">
        <div>
          <p class="settingsLabel">Testing</p>
          <h3>Plan activo</h3>
          <p class="settingsText">
            Cambia entre gratis y premium para validar ambos flujos antes del lanzamiento.
          </p>
        </div>

        <div class="pillRow">
          <button
            v-for="plan in availablePlans"
            :key="plan.id"
            type="button"
            class="pillButton"
            :class="{ active: settings.planId === plan.id }"
            @click="setPlan(plan.id)"
          >
            {{ plan.name }}
          </button>
        </div>
      </article>

      <article class="settingsCard">
        <div>
          <p class="settingsLabel">Recordatorios</p>
          <h3>Notificaciones locales</h3>
          <p class="settingsText">
            Piden permiso al usuario y quedan asociadas solo a este dispositivo para mantener la experiencia privada.
          </p>
        </div>

        <div class="settingsActions">
          <button
            v-if="!settings.notificationsEnabled"
            type="button"
            class="primaryAction"
            @click="enableNotifications"
          >
            Activar recordatorios
          </button>
          <button
            v-else
            type="button"
            class="secondaryAction"
            @click="disableNotifications"
          >
            Desactivar recordatorios
          </button>
          <p class="permissionStatus">Estado: {{ settings.reminderPermission }}</p>
        </div>
      </article>

      <article class="settingsCard">
        <div>
          <p class="settingsLabel">Apariencia</p>
          <h3>{{ isPremium ? 'Paletas premium' : 'Modo gratis' }}</h3>
          <p class="settingsText">
            {{ isPremium ? 'Elige entre ocho paletas premium.' : 'Gratis incluye un modo dia y un modo noche mas atractivo.' }}
          </p>
        </div>

        <div v-if="!isPremium" class="themeToggle">
          <span>Day</span>
          <button
            type="button"
            class="themeSwitch"
            :class="{ night: settings.themeId === 'night' }"
            @click="setTheme(settings.themeId === 'night' ? 'light' : 'night')"
            aria-label="Cambiar modo de color"
          >
            <span class="themeThumb"></span>
          </button>
          <span>Night</span>
        </div>

        <div v-else class="premiumThemesBlock">
          <button
            type="button"
            class="themeDisclosure"
            :class="{ active: premiumThemesOpen }"
            @click="premiumThemesOpen = !premiumThemesOpen"
          >
            <div>
              <strong>Ver paletas premium</strong>
              <small>Haz click para desplegar las 8 opciones</small>
            </div>
            <span>{{ premiumThemesOpen ? 'Ocultar' : 'Abrir' }}</span>
          </button>

          <div v-if="premiumThemesOpen" class="paletteGrid">
            <button
              v-for="palette in premiumPalettes"
              :key="palette.id"
              type="button"
              class="paletteCard"
              :class="{ active: settings.themeId === palette.id }"
              @click="setTheme(palette.id)"
            >
              <strong>{{ palette.name }}</strong>
              <small>{{ palette.mode }}</small>
            </button>
          </div>
        </div>

        <div v-if="isPremium" class="freePaletteRow">
          <button
            v-for="palette in freePalettes"
            :key="palette.id"
            type="button"
            class="pillButton"
            :class="{ active: settings.themeId === palette.id }"
            @click="setTheme(palette.id)"
          >
            {{ palette.name }}
          </button>
        </div>
      </article>

      <article class="settingsCard">
        <div>
          <p class="settingsLabel">Privacidad</p>
          <h3>Modo local-first</h3>
          <p class="settingsText">
            Tus tareas, snippets y recordatorios se conservan en este dispositivo para darte control, rapidez y privacidad.
          </p>
        </div>
      </article>

      <article v-if="!isPremium" class="settingsCard">
        <div>
          <p class="settingsLabel">Monetizacion</p>
          <h3>{{ isPremium ? 'Experiencia sin anuncios' : 'Zona de anuncios cuidada' }}</h3>
          <p class="settingsText">
            {{ isPremium ? 'Premium elimina la franja de anuncios y deja mas espacio para trabajar.' : 'La app reserva una franja inferior no invasiva para anuncios de la version gratis.' }}
          </p>
        </div>
      </article>

      <article v-if="isPremium" class="settingsCard">
        <div>
          <p class="settingsLabel">Premium</p>
          <h3>Exportacion</h3>
          <p class="settingsText">Genera un snapshot local para probar respaldo premium.</p>
        </div>
        <button type="button" class="primaryAction" @click="exportBackup">
          Exportar backup
        </button>
      </article>

      <article class="settingsCard fullWidth">
        <div>
          <p class="settingsLabel">Proximos recordatorios</p>
          <h3>Agenda inmediata</h3>
        </div>

        <ul v-if="upcomingTodos.length" class="upcomingList">
          <li v-for="todo in upcomingTodos" :key="todo.id">
            <strong>{{ todo.title }}</strong>
            <span>{{ new Date(todo.reminderAt).toLocaleString() }}</span>
          </li>
        </ul>
        <p v-else class="settingsText">No hay recordatorios programados.</p>
      </article>
    </div>

    <aside v-if="!canUse(FEATURE_KEYS.NO_ADS)" class="adsSection" aria-label="Zona reservada para anuncios">
      <div class="adsMeta">
        <p class="settingsLabel">Ads inteligente</p>
        <h3>Espacio inferior listo para monetizacion</h3>
        <p class="settingsText">
          Este bloque esta separado del flujo de tareas para no interrumpir creacion, edicion ni marcado de pendientes.
        </p>
      </div>
      <div class="adsPlaceholder">
        <span>Banner adaptable 320x100 a 728x120</span>
        <small>Recomendado para AdMob o proveedor equivalente en la app movil.</small>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.tasksSection {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto 40px;
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.heroCard,
.premiumCommandBar,
.agendaCard,
.boardColumn,
.settingsCard {
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--hero-shadow);
}

.heroCard {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
  gap: 18px;
  padding: 24px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 26%, transparent), transparent 30%),
    var(--surface);
}

.heroCopy h2 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.05;
  text-align: left;
  color: var(--text-main);
}

.heroText,
.eyebrow {
  margin: 0;
  text-align: left;
}

.eyebrow {
  color: var(--accent-strong);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.heroText {
  margin-top: 12px;
  max-width: 62ch;
  color: var(--text-muted);
}

.heroStats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.statCard {
  padding: 18px;
  border-radius: 24px;
  background: var(--surface-muted);
  border: 1px solid var(--line);
  text-align: left;
}

.statCard span {
  display: block;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  color: var(--text-main);
}

.statCard p {
  margin: 6px 0 0;
  color: var(--text-muted);
}

.premiumCommandBar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
  border-radius: 24px;
}

.premiumViews,
.tabs,
.pillRow,
.freePaletteRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.focusPanel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  color: var(--text-main);
}

.focusPanel strong {
  font-size: 1.8rem;
}

.focusActions {
  display: flex;
  gap: 8px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tabButton,
.pillButton,
.miniAction {
  background: var(--surface-soft);
  color: var(--text-main);
  border: 1px solid var(--line);
}

.tabButton.active,
.pillButton.active {
  background: var(--accent);
}

.searchField {
  flex: 1;
  max-width: 360px;
}

.searchField input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--surface-muted);
  color: var(--text-main);
}

.contentStage,
.listScroll {
  min-height: 260px;
}

.agendaGrid,
.boardGrid,
.settingsPanel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.agendaCard,
.boardColumn,
.settingsCard {
  padding: 20px;
  border-radius: 24px;
  text-align: left;
}

.agendaItems,
.boardItems {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.agendaItem,
.boardItem {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--surface-soft);
  color: var(--text-main);
}

.agendaCopy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agendaCopy small {
  color: var(--text-muted);
}

.settingsLabel {
  margin: 0 0 4px;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-strong);
  font-weight: 700;
}

.settingsCard h3,
.adsMeta h3 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--text-main);
}

.settingsText,
.permissionStatus,
.emptyPremium,
.adsMeta .settingsText {
  margin: 10px 0 0;
  color: var(--text-muted);
}

.settingsActions {
  margin-top: 18px;
}

.primaryAction {
  background: var(--accent);
  color: var(--text-main);
}

.secondaryAction {
  background: var(--surface-soft);
  color: var(--text-main);
}

.themeToggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  color: var(--text-main);
  font-weight: 600;
}

.premiumThemesBlock {
  margin-top: 22px;
}

.themeDisclosure {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 18px;
  background: var(--surface-soft);
  color: var(--text-main);
  border: 1px solid var(--line);
  text-align: left;
}

.themeDisclosure.active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-soft));
}

.themeDisclosure small {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
}

.themeSwitch {
  position: relative;
  width: 76px;
  height: 40px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f8c76a 0%, #92b7ff 100%);
  padding: 4px;
}

.themeSwitch.night {
  background: linear-gradient(90deg, #20314d 0%, #728ef0 100%);
}

.themeThumb {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ffffff;
  transform: translateX(0);
  transition: transform 160ms ease;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.themeSwitch.night .themeThumb {
  transform: translateX(36px);
}

.paletteGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.paletteCard {
  padding: 14px;
  border-radius: 18px;
  text-align: left;
  background: var(--surface-soft);
  color: var(--text-main);
}

.paletteCard.active {
  background: var(--accent);
}

.paletteCard small {
  display: block;
  margin-top: 6px;
  text-transform: uppercase;
  opacity: 0.7;
}

.freePaletteRow {
  margin-top: 18px;
}

.fullWidth {
  grid-column: 1 / -1;
}

.upcomingList {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcomingList li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--surface-soft);
  color: var(--text-main);
}

.adsSection {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr);
  gap: 18px;
  align-items: center;
  padding: 20px;
  border-radius: 28px;
  background: var(--ads-bg);
  color: white;
}

.adsMeta h3,
.adsMeta .settingsText,
.adsMeta .settingsLabel {
  color: white;
}

.adsPlaceholder {
  min-height: min(28vh, 220px);
  max-height: 320px;
  border-radius: 22px;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.04);
}

.adsPlaceholder span,
.adsPlaceholder small {
  display: block;
}

.sr-only {
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

@media (max-width: 920px) {
  .heroCard,
  .premiumCommandBar,
  .agendaGrid,
  .boardGrid,
  .settingsPanel,
  .adsSection {
    grid-template-columns: 1fr;
  }

  .focusPanel {
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .tasksSection {
    width: min(100% - 20px, 1120px);
  }

  .heroCard {
    padding: 18px;
    border-radius: 22px;
  }

  .heroStats {
    grid-template-columns: 1fr;
  }

  .toolbar {
    align-items: stretch;
  }

  .tabs {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .searchField {
    max-width: none;
  }

  .paletteGrid {
    grid-template-columns: 1fr;
  }

  .adsPlaceholder {
    min-height: 160px;
    max-height: 220px;
  }
}
</style>
