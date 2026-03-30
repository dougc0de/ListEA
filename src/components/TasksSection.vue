<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AddTask from './AddTask.vue';
import ProductivityDashboard from './ProductivityDashboard.vue';
import TodoList from './TodoList.vue';
import {
  cancelReminder,
  clearReminderInteractions,
  clearAllReminderTimers,
  enableExactReminders,
  enableReminders,
  getExactAlarmPermission,
  getReminderPermission,
  isNativeReminderRuntime,
  registerReminderInteractions,
  REMINDER_ACTION_IDS,
  scheduleReminder,
} from '../services/reminders';
import {
  AvatarCoach,
  AvatarPreferences,
  AVATAR_SNIPPET_DURATIONS,
  AVATAR_TIMINGS,
} from '../domain/avatar';
import {
  FILTER_IDS,
  TaskFilterCatalog,
  TaskFilterService,
  TaskVisibilityPlanner,
} from '../domain/filters';
import { BacklogInsightAnalyzer } from '../domain/insights';
import {
  ENTITLEMENT_KEYS,
  LICENSE_TIERS,
  activateLocalProLicense,
  downgradeToFreeLicense,
  hasEntitlement,
} from '../domain/license';
import { LocalTaskRepository } from '../domain/localFirst';
import { NavigationCatalog } from '../domain/navigation';
import { QuickCaptureInterpreter } from '../domain/quickCapture';
import { RecurrenceEngine } from '../domain/recurrence';
import { ProfessionalReviewAnalyzer } from '../domain/review';
import { downloadBackupFile, parseBackupDocument, readBackupFile } from '../services/localBackup';
import { LAUNCH_INTENT_TYPES } from '../services/launchIntents';
import { TaskAppLaunchService } from '../services/taskAppLaunchService';
import {
  CAPTURE_SOURCES,
  TASK_STATUS,
  TaskContextPresenter,
  TaskFactory,
} from '../domain/tasks';

const props = defineProps({
  currentView: { type: String, default: 'today' },
  launchIntent: { type: Object, default: null },
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
const visibilityPlanner = new TaskVisibilityPlanner(filterService);
const insightAnalyzer = new BacklogInsightAnalyzer();
const navigationCatalog = new NavigationCatalog();
const contextPresenter = new TaskContextPresenter();
const captureInterpreter = new QuickCaptureInterpreter();
const professionalReviewAnalyzer = new ProfessionalReviewAnalyzer();
const taskAppLaunchService = new TaskAppLaunchService();

const tasks = ref([]);
const analytics = ref(repository.normalizeAnalytics());
const preferences = ref(repository.normalizePreferences());
const activeFilterId = ref(FILTER_IDS.TODAY);
const searchQuery = ref('');
const mounted = ref(false);
const avatarSnippet = ref(null);
const uiFeedback = ref(null);
const upgradePrompt = ref(null);
const backlogCompletedOpen = ref(true);
const focusListPanelRef = ref(null);
const paletteSelectorOpen = ref(false);
const backupFileInput = ref(null);
const backupPassphrase = ref('');
const importPassphrase = ref('');
const isExportingBackup = ref(false);
const isImportingBackup = ref(false);
const isNativeReminderPlatform = ref(false);
const THEME_MODES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
});
const COLOR_PALETTES = Object.freeze({
  WARM: 'warm',
  OCEAN: 'ocean',
  FOREST: 'forest',
  BERRY: 'berry',
  AURORA: 'aurora',
  NOIR: 'noir',
  SUNSET: 'sunset',
});
const paletteOptions = [
  { id: COLOR_PALETTES.WARM, label: 'Arena', description: 'Calida y cercana' },
  { id: COLOR_PALETTES.OCEAN, label: 'Oceano', description: 'Limpia y serena' },
  { id: COLOR_PALETTES.FOREST, label: 'Bosque', description: 'Natural y sobria' },
  { id: COLOR_PALETTES.BERRY, label: 'Baya', description: 'Suave y elegante' },
  { id: COLOR_PALETTES.AURORA, label: 'Aurora', description: 'Fresca y luminosa' },
  { id: COLOR_PALETTES.NOIR, label: 'Noir', description: 'Tecnologica y premium' },
  { id: COLOR_PALETTES.SUNSET, label: 'Atardecer', description: 'Vibrante y moderna' },
];
const BASIC_TIMINGS = new Set([AVATAR_TIMINGS.NEVER, AVATAR_TIMINGS.ON_TIME]);
const UPGRADE_COPY = Object.freeze({
  [ENTITLEMENT_KEYS.ADVANCED_DASHBOARD]: {
    title: 'ListEA Pro desbloquea panel avanzado',
    message: 'Los rangos personalizados y la lectura semanal viven solo en tu dispositivo y forman parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PDF_EXPORT]: {
    title: 'ListEA Pro desbloquea el PDF local',
    message: 'El reporte PDF se genera localmente y esta incluido en ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PREMIUM_INSIGHTS]: {
    title: 'ListEA Pro desbloquea insights del backlog',
    message: 'La lectura automatica de saturacion, duplicados y tareas sin decision forma parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.ADVANCED_REMINDERS]: {
    title: 'ListEA Pro desbloquea recordatorios avanzados',
    message: 'Los avisos antes o despues de la hora objetivo forman parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.AVATAR_PRO]: {
    title: 'ListEA Pro desbloquea el avatar avanzado',
    message: 'Duracion personalizada, filtros por importancia y avisos avanzados estan en ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PREMIUM_THEMES]: {
    title: 'ListEA Pro desbloquea paletas premium',
    message: 'Modo dia/noche es gratis. Las paletas exclusivas se reservan para ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP]: {
    title: 'ListEA Pro desbloquea respaldo cifrado',
    message: 'Puedes exportar e importar gratis. El respaldo cifrado con frase local forma parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.SMART_APP_LAUNCH]: {
    title: 'ListEA Pro desbloquea apertura inteligente de apps',
    message: 'ListEA Pro detecta apps compatibles instaladas y las abre directamente desde tus tareas y recordatorios.',
  },
});
const INBOX_TASK_ACTIONS = Object.freeze([
  { id: 'triage', label: 'Marcar lista', tone: 'primary' },
  { id: 'inbox-tomorrow', label: 'Manana 9:00', tone: 'ghost' },
]);
const FOLLOW_UP_TASK_ACTIONS = Object.freeze([
  { id: 'follow-up-tomorrow', label: 'Manana', tone: 'ghost' },
  { id: 'follow-up-friday', label: 'Viernes', tone: 'ghost' },
  { id: 'follow-up-next-week', label: 'Prox. semana', tone: 'ghost' },
  { id: 'follow-up-resolved', label: 'Resuelto', tone: 'primary' },
]);

let avatarSnippetTimerId = 0;
let avatarSnippetHideTimerId = 0;
let uiFeedbackTimerId = 0;

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

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function resolveTaskActionField(task) {
  if (task.followUpAt && (!task.dueAt || [TASK_STATUS.WAITING, TASK_STATUS.BLOCKED].includes(task.status))) {
    return 'followUpAt';
  }

  return task.dueAt ? 'dueAt' : 'followUpAt';
}

function createDateAt(hour = 9, minute = 0) {
  const nextDate = new Date();
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}

function buildTomorrowAt(hour = 9, minute = 0) {
  const nextDate = createDateAt(hour, minute);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate;
}

function buildNextWeekdayAt(targetWeekday, hour = 9, minute = 0) {
  const nextDate = createDateAt(hour, minute);
  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (nextDate.getDay() !== targetWeekday);
  return nextDate;
}

function buildNextWeekAt(hour = 9, minute = 0) {
  return buildNextWeekdayAt(1, hour, minute);
}

function buildSnoozeDate(task, minutes = 10) {
  const currentAnchor = parseDate(task[resolveTaskActionField(task)] || task.getRelevantDate());
  const nextDate = currentAnchor && currentAnchor.getTime() > Date.now()
    ? new Date(currentAnchor)
    : new Date();
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function resolveTaskWorkspaceView(task) {
  if (!task) return 'today';
  if (task.needsTriage) return 'inbox';
  if (task.status === TASK_STATUS.WAITING || task.status === TASK_STATUS.BLOCKED || task.followUpAt) {
    return 'follow-up';
  }

  const preferredFilter = visibilityPlanner.getPreferredFilter(task, {
    referenceDate: new Date(),
  });
  return preferredFilter ? 'today' : 'backlog';
}

function loadState() {
  const state = repository.load();
  tasks.value = state.tasks;
  analytics.value = state.analytics;
  preferences.value = state.preferences;
}

function persistState() {
  repository.save({
    tasks: tasks.value,
    analytics: analytics.value,
    preferences: preferences.value,
  });
}

function addTask(payload) {
  const task = taskFactory.create(payload);
  if (!task.title) return;

  tasks.value = [task, ...tasks.value];
  const feedbackMessage = task.needsTriage
    ? `Captura "${task.title}" guardada en Capturas.`
    : `Tarea "${task.title}" guardada.`;
  showUiFeedback(feedbackMessage, 'success');
  revealTask(task);
}

function captureTaskFromExternalSource(text, metadata = {}) {
  const interpreted = captureInterpreter.interpret(text);
  const nextTitle = interpreted.title || `${text ?? ''}`.trim();
  if (!nextTitle) return;

  addTask({
    title: nextTitle,
    project: metadata.project || interpreted.project,
    area: metadata.area || interpreted.area,
    dueAt: interpreted.dueAt,
    followUpAt: interpreted.followUpAt,
    priority: interpreted.priority,
    status: interpreted.status,
    tags: interpreted.tags,
    effortMinutes: interpreted.effortMinutes || 20,
    source: metadata.source || CAPTURE_SOURCES.SHARE,
    capturedAt: new Date().toISOString(),
    needsTriage: true,
  });
}

function toggleTask(id) {
  const task = tasks.value.find(item => item.id === id);
  if (!task) return;

  if (task.isCompleted()) {
    task.reopen();
    tasks.value = recurrenceEngine.reconcileReopenedTask(tasks.value, task);
    tasks.value = [...tasks.value];
    showUiFeedback(`Tarea "${task.title}" reabierta.`, 'success');
    revealTask(task);
    return;
  }

  task.complete();
  tasks.value = [...tasks.value];
  analytics.value.recordCompleted(task, task.completedAt);
  const nextOccurrence = recurrenceEngine.createNextOccurrence(task, task.completedAt);
  if (nextOccurrence) {
    tasks.value = [nextOccurrence, ...tasks.value];
    showUiFeedback(`Tarea completada. Se programo la siguiente ocurrencia de "${task.title}".`, 'success');
    revealTask(nextOccurrence);
    return;
  }

  if (task.recurrence?.isEnabled?.()) {
    showUiFeedback('No fue posible programar la siguiente ocurrencia.', 'error');
    return;
  }

  showUiFeedback(`Tarea "${task.title}" completada.`, 'success');
}

function updateTask(payload) {
  const task = tasks.value.find(item => item.id === payload.id);
  if (!task) return;
  task.applyPatch(payload);
  tasks.value = [...tasks.value];
  showUiFeedback(`Cambios guardados en "${task.title}".`, 'success');
  if (!task.isCompleted()) {
    revealTask(task);
  }
}

function toggleSubtask({ taskId, subtaskId }) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  const subtask = task.subtasks.find(item => item.id === subtaskId);
  if (!subtask) return;

  subtask.done = !subtask.done;
  task.updatedAt = new Date().toISOString();
  tasks.value = [...tasks.value];
}

async function removeTasksByIds(ids, { trackAnalytics = true, showItemFeedback = true } = {}) {
  const idSet = new Set(ids);
  const removedTasks = tasks.value.filter(task => idSet.has(task.id));
  if (!removedTasks.length) return;

  if (trackAnalytics) {
    removedTasks.forEach(task => {
      analytics.value.recordDeleted(task);
      if (showItemFeedback) {
        showUiFeedback(`Tarea "${task.title}" eliminada.`, 'success');
      }
    });
  }

  await Promise.all(removedTasks.map(task => cancelReminder(task.id)));
  tasks.value = tasks.value.filter(task => !idSet.has(task.id));
}

async function removeTask(id) {
  await removeTasksByIds([id], {
    trackAnalytics: true,
    showItemFeedback: true,
  });
}

function resetTaskWorkspaceView() {
  searchQuery.value = '';
  activeFilterId.value = FILTER_IDS.TODAY;
  showUiFeedback('Vista reiniciada.', 'info');
}

function clearAnalytics() {
  analytics.value = repository.normalizeAnalytics();
  showUiFeedback('Estadisticas reiniciadas.', 'success');
}

function setAvatarPreferences(patch) {
  preferences.value.avatar = new AvatarPreferences({
    ...preferences.value.avatar,
    ...patch,
  });
}

function setAppearancePreferences(patch) {
  preferences.value = {
    ...preferences.value,
    ...patch,
  };
}

function hasFeature(entitlementKey) {
  return hasEntitlement(preferences.value.license, entitlementKey);
}

function buildEffectiveAvatarPreferences() {
  if (hasFeature(ENTITLEMENT_KEYS.ADVANCED_REMINDERS) || hasFeature(ENTITLEMENT_KEYS.AVATAR_PRO)) {
    return new AvatarPreferences(preferences.value.avatar);
  }

  return new AvatarPreferences({
    ...preferences.value.avatar,
    reminderTiming: preferences.value.notificationsEnabled ? AVATAR_TIMINGS.ON_TIME : AVATAR_TIMINGS.NEVER,
    snippetTiming: preferences.value.avatar.snippetEnabled ? AVATAR_TIMINGS.ON_TIME : AVATAR_TIMINGS.NEVER,
    snippetDuration: AVATAR_SNIPPET_DURATIONS.MEDIUM,
    importantOnly: false,
  });
}

function buildPersistedSnapshot() {
  return {
    tasks: tasks.value.map(task => task.toJSON()),
    analytics: repository.serializeAnalytics(analytics.value),
    preferences: repository.serializePreferences(preferences.value),
  };
}

function dismissUpgradePrompt() {
  upgradePrompt.value = null;
}

function requestUpgrade(entitlementKey) {
  const copy = UPGRADE_COPY[entitlementKey] ?? {
    title: 'ListEA Pro desbloquea esta funcion',
    message: 'Esta mejora vive localmente y forma parte de ListEA Pro.',
  };

  upgradePrompt.value = {
    ...copy,
    entitlementKey,
  };
}

function openUpgradeSettings() {
  emit('navigate', 'settings');
}

function applyLicenseState(nextLicense, feedbackMessage = '') {
  const nextHasPremiumThemes = hasEntitlement(nextLicense, ENTITLEMENT_KEYS.PREMIUM_THEMES);
  const nextAvatarPreferences = (hasEntitlement(nextLicense, ENTITLEMENT_KEYS.ADVANCED_REMINDERS)
    || hasEntitlement(nextLicense, ENTITLEMENT_KEYS.AVATAR_PRO))
    ? new AvatarPreferences(preferences.value.avatar)
    : new AvatarPreferences({
      ...preferences.value.avatar,
      reminderTiming: preferences.value.notificationsEnabled ? AVATAR_TIMINGS.ON_TIME : AVATAR_TIMINGS.NEVER,
      snippetTiming: preferences.value.avatar.snippetEnabled ? AVATAR_TIMINGS.ON_TIME : AVATAR_TIMINGS.NEVER,
      snippetDuration: AVATAR_SNIPPET_DURATIONS.MEDIUM,
      importantOnly: false,
    });

  preferences.value = {
    ...preferences.value,
    license: nextLicense,
    colorPalette: nextHasPremiumThemes ? preferences.value.colorPalette : COLOR_PALETTES.OCEAN,
    avatar: nextAvatarPreferences,
  };

  if (!nextHasPremiumThemes) {
    paletteSelectorOpen.value = false;
  }

  applyAppearancePreferences();
  syncAvatarSnippet();
  if (feedbackMessage) {
    showUiFeedback(feedbackMessage, 'info');
  }
}

function activateProLocally() {
  applyLicenseState(
    activateLocalProLicense(preferences.value.license),
    'ListEA Pro quedo activado localmente en este dispositivo.',
  );
  dismissUpgradePrompt();
}

function restoreLocalPro() {
  if (preferences.value.license?.restoreAvailable || preferences.value.license?.licenseTier === LICENSE_TIERS.PRO) {
    applyLicenseState(
      activateLocalProLicense(preferences.value.license),
      'ListEA Pro se restauro localmente en este dispositivo.',
    );
    return;
  }

  showUiFeedback('Todavia no hay una compra local para restaurar en este dispositivo.', 'error');
}

function revertToFreePlan() {
  applyLicenseState(
    downgradeToFreeLicense(preferences.value.license),
    'ListEA volvio al plan Free sin tocar tus tareas ni tu historial local.',
  );
}

function togglePaletteSelector() {
  if (!hasFeature(ENTITLEMENT_KEYS.PREMIUM_THEMES)) {
    requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_THEMES);
    return;
  }
  paletteSelectorOpen.value = !paletteSelectorOpen.value;
}

function selectColorPalette(paletteId) {
  if (!hasFeature(ENTITLEMENT_KEYS.PREMIUM_THEMES)) {
    requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_THEMES);
    return;
  }
  setAppearancePreferences({ colorPalette: paletteId });
}

function scrollToFocusContent() {
  if (typeof window === 'undefined') return;

  const panel = focusListPanelRef.value;
  if (!panel) return;

  panel.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function resolvePrimaryLaunchSuggestion(task) {
  return taskAppLaunchService.resolvePrimary(task);
}

function applyAppearancePreferences() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.theme = preferences.value.themeMode ?? THEME_MODES.LIGHT;
  root.dataset.palette = hasFeature(ENTITLEMENT_KEYS.PREMIUM_THEMES)
    ? (preferences.value.colorPalette ?? COLOR_PALETTES.OCEAN)
    : COLOR_PALETTES.OCEAN;
}

function selectTimeFilter(filterId) {
  activeFilterId.value = filterId;
  scrollToFocusContent();
}

function resetTimeFilter() {
  activeFilterId.value = FILTER_IDS.TODAY;
  scrollToFocusContent();
}

function clearUiFeedbackTimer() {
  if (!uiFeedbackTimerId || typeof window === 'undefined') return;
  window.clearTimeout(uiFeedbackTimerId);
  uiFeedbackTimerId = 0;
}

function dismissUiFeedback() {
  clearUiFeedbackTimer();
  uiFeedback.value = null;
}

function showUiFeedback(message, tone = 'success') {
  uiFeedback.value = { message, tone };
  clearUiFeedbackTimer();

  if (typeof window === 'undefined') return;
  uiFeedbackTimerId = window.setTimeout(() => {
    uiFeedbackTimerId = 0;
    uiFeedback.value = null;
  }, 4200);
}

function revealTask(task) {
  searchQuery.value = '';
  const targetView = resolveTaskWorkspaceView(task);

  if (targetView === 'inbox' || targetView === 'follow-up') {
    emit('navigate', targetView);
    return;
  }

  if (targetView === 'today') {
    const nextFilter = visibilityPlanner.resolveVisibleFilter(task, activeFilterId.value, {
      referenceDate: new Date(),
    });

    if (nextFilter) {
      activeFilterId.value = nextFilter;
    }
    emit('navigate', 'today');
    return;
  }

  emit('navigate', 'backlog');
}

function focusTaskById(taskId, preferredView = '') {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  searchQuery.value = '';
  const targetView = preferredView || resolveTaskWorkspaceView(task);

  if (targetView === 'today') {
    const nextFilter = visibilityPlanner.resolveVisibleFilter(task, activeFilterId.value, {
      referenceDate: new Date(),
    });
    if (nextFilter) {
      activeFilterId.value = nextFilter;
    }
  }

  emit('navigate', targetView || 'today');
  showUiFeedback(`Abriendo "${task.title}".`, 'info');
}

function updateTaskWithDate(task, nextDate, feedbackMessage) {
  if (!task || !nextDate) return;

  const dateField = resolveTaskActionField(task);
  const patch = {
    [dateField]: nextDate.toISOString(),
    reminderSent: false,
    avatarSnippetShownAt: '',
    needsTriage: false,
  };

  if (dateField === 'followUpAt' && task.status === TASK_STATUS.ACTIVE) {
    patch.status = TASK_STATUS.WAITING;
  }

  task.applyPatch(patch);
  tasks.value = [...tasks.value];
  showUiFeedback(feedbackMessage, 'success');
}

function markTaskTriaged(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  task.applyPatch({ needsTriage: false });
  tasks.value = [...tasks.value];
  showUiFeedback(`"${task.title}" salio de Capturas y ya cuenta como tarea lista.`, 'success');
}

function resolveFollowUp(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  task.applyPatch({
    status: TASK_STATUS.ACTIVE,
    followUpAt: '',
    needsTriage: false,
    reminderSent: false,
    avatarSnippetShownAt: '',
  });
  tasks.value = [...tasks.value];
  showUiFeedback(`Seguimiento resuelto en "${task.title}".`, 'success');
}

function handleTaskAction({ taskId, actionId }) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  if (actionId === 'triage') {
    markTaskTriaged(taskId);
    return;
  }

  if (actionId === 'inbox-tomorrow') {
    updateTaskWithDate(task, buildTomorrowAt(9, 0), `"${task.title}" quedo para manana a las 9:00.`);
    return;
  }

  if (actionId === 'follow-up-tomorrow') {
    updateTaskWithDate(task, buildTomorrowAt(9, 0), `Seguimiento reagendado para manana.`);
    return;
  }

  if (actionId === 'follow-up-friday') {
    updateTaskWithDate(task, buildNextWeekdayAt(5, 9, 0), `Seguimiento movido al viernes.`);
    return;
  }

  if (actionId === 'follow-up-next-week') {
    updateTaskWithDate(task, buildNextWeekAt(9, 0), `Seguimiento movido a la proxima semana.`);
    return;
  }

  if (actionId === 'follow-up-resolved') {
    resolveFollowUp(taskId);
  }
}

function clearAvatarSnippetTimer() {
  if (!avatarSnippetTimerId || typeof window === 'undefined') return;
  window.clearTimeout(avatarSnippetTimerId);
  avatarSnippetTimerId = 0;
}

function clearAvatarSnippetHideTimer() {
  if (!avatarSnippetHideTimerId || typeof window === 'undefined') return;
  window.clearTimeout(avatarSnippetHideTimerId);
  avatarSnippetHideTimerId = 0;
}

function dismissAvatarSnippet({ reschedule = true } = {}) {
  clearAvatarSnippetHideTimer();
  avatarSnippet.value = null;

  if (reschedule) {
    syncAvatarSnippet();
  }
}

function showAvatarSnippet(task) {
  if (!task) return;

  const effectiveAvatarPreferences = buildEffectiveAvatarPreferences();
  const shownAt = new Date().toISOString();
  const primaryAction = resolvePrimaryLaunchSuggestion(task);
  task.applyPatch({ avatarSnippetShownAt: shownAt });
  avatarSnippet.value = {
    ...avatarCoach.buildTaskSnippet(task, effectiveAvatarPreferences, new Date(shownAt)),
    context: contextPresenter.buildTaskContext(task).slice(0, 3).join(' - '),
    preferredView: resolveTaskWorkspaceView(task),
    primaryAction,
  };

  clearAvatarSnippetHideTimer();
  const durationMs = effectiveAvatarPreferences.getSnippetDurationMs();
  if (durationMs === null || typeof window === 'undefined') return;

  avatarSnippetHideTimerId = window.setTimeout(() => {
    avatarSnippetHideTimerId = 0;
    dismissAvatarSnippet();
  }, durationMs);
}

function syncAvatarSnippet() {
  clearAvatarSnippetTimer();
  const effectiveAvatarPreferences = buildEffectiveAvatarPreferences();

  const canRenderSnippet = mounted.value
    && showTaskWorkspace.value
    && effectiveAvatarPreferences.enabled
    && effectiveAvatarPreferences.snippetEnabled
    && !(preferences.value.notificationsEnabled && isNativeReminderPlatform.value);

  if (!canRenderSnippet) {
    clearAvatarSnippetHideTimer();
    avatarSnippet.value = null;
    return;
  }

  if (avatarSnippet.value) {
    const currentTask = tasks.value.find(task => task.id === avatarSnippet.value.taskId);
    if (currentTask && !currentTask.isCompleted()) {
      return;
    }

    clearAvatarSnippetHideTimer();
    avatarSnippet.value = null;
  }

  const dueTask = avatarCoach.getDueSnippetTask(tasks.value, effectiveAvatarPreferences, new Date());
  if (dueTask) {
    showAvatarSnippet(dueTask);
    return;
  }

  const nextSnippet = avatarCoach.getNextSnippetTask(tasks.value, effectiveAvatarPreferences, new Date());
  if (!nextSnippet || typeof window === 'undefined') {
    return;
  }

  const delay = Math.max(nextSnippet.scheduledTime - Date.now(), 0);
  avatarSnippetTimerId = window.setTimeout(() => {
    avatarSnippetTimerId = 0;
    syncAvatarSnippet();
  }, Math.min(delay, 2147483647));
}

function showReminderBubble(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task || task.isCompleted() || avatarSnippet.value?.taskId === taskId) return;

  task.applyPatch({ reminderSent: true });
  tasks.value = [...tasks.value];
  showAvatarSnippet(task);
}

function completeReminderTask(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task || task.isCompleted()) return;
  toggleTask(taskId);
  dismissAvatarSnippet({ reschedule: false });
}

function snoozeReminderTask(taskId, minutes = 10) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  updateTaskWithDate(task, buildSnoozeDate(task, minutes), `Aviso pospuesto ${minutes} minutos.`);
  dismissAvatarSnippet({ reschedule: true });
}

function moveReminderTaskToTomorrow(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  updateTaskWithDate(task, buildTomorrowAt(9, 0), `Aviso movido a manana a las 9:00.`);
  dismissAvatarSnippet({ reschedule: true });
}

async function openTaskLaunch(task, suggestionId = '', { showPremiumHint = true } = {}) {
  if (!task) {
    return { completed: false, mode: 'none', suggestion: null };
  }

  const premiumEnabled = hasFeature(ENTITLEMENT_KEYS.SMART_APP_LAUNCH);
  const result = await taskAppLaunchService.open(task, {
    suggestionId,
    premiumEnabled,
  });

  if (result.completed && result.mode === 'native') {
    showUiFeedback(`Abriendo ${result.suggestion?.label ?? 'app'} para "${task.title}".`, 'info');
    return result;
  }

  if (result.completed && ['fallback', 'web'].includes(result.mode)) {
    if (!premiumEnabled && result.suggestion?.supportsNativeLaunch() && showPremiumHint) {
      requestUpgrade(ENTITLEMENT_KEYS.SMART_APP_LAUNCH);
    }
    return result;
  }

  if (!premiumEnabled && result.suggestion?.supportsNativeLaunch()) {
    if (showPremiumHint) {
      requestUpgrade(ENTITLEMENT_KEYS.SMART_APP_LAUNCH);
    }
    return result;
  }

  return result;
}

async function openReminderPrimaryAction(taskId, preferredView = '') {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  const primarySuggestion = resolvePrimaryLaunchSuggestion(task);
  const result = await openTaskLaunch(task, primarySuggestion?.id ?? '', {
    showPremiumHint: false,
  });
  if (result.completed) {
    dismissAvatarSnippet({ reschedule: false });
    return;
  }

  openReminderTask(taskId, preferredView);
}

async function handleTaskLaunchRequest({ taskId, suggestionId }) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  const result = await openTaskLaunch(task, suggestionId);
  if (!result.completed) {
    showUiFeedback(`No fue posible abrir una app para "${task.title}".`, 'error');
  }
}

function openReminderTask(taskId, preferredView = '') {
  dismissAvatarSnippet({ reschedule: false });
  focusTaskById(taskId, preferredView);
}

function handleReminderNotificationReceived(notification) {
  const taskId = notification?.extra?.taskId;
  if (!taskId) return;
  showReminderBubble(taskId);
}

function handleReminderNotificationAction(notificationAction) {
  const taskId = notificationAction?.notification?.extra?.taskId;
  if (!taskId) return;

  const preferredView = notificationAction?.notification?.extra?.preferredView ?? '';
  const actionId = notificationAction?.actionId;
  if (actionId === REMINDER_ACTION_IDS.COMPLETE) {
    completeReminderTask(taskId);
    return;
  }

  if (actionId === REMINDER_ACTION_IDS.SNOOZE_10) {
    snoozeReminderTask(taskId, 10);
    return;
  }

  if (actionId === REMINDER_ACTION_IDS.MOVE_TOMORROW) {
    moveReminderTaskToTomorrow(taskId);
    return;
  }

  if (actionId === REMINDER_ACTION_IDS.OPEN) {
    openReminderPrimaryAction(taskId, preferredView);
  }
}

async function enableNotificationsFlow() {
  const permission = await enableReminders();
  preferences.value.reminderPermission = permission;
  if (permission !== 'granted') {
    preferences.value.notificationsEnabled = false;
    return;
  }

  const exactPermission = await getExactAlarmPermission();
  preferences.value.exactAlarmPermission = exactPermission;

  if (exactPermission !== 'granted') {
    preferences.value.exactAlarmPermission = await enableExactReminders();
  }

  preferences.value.notificationsEnabled = preferences.value.exactAlarmPermission === 'granted';
}

async function disableNotificationsFlow() {
  preferences.value.notificationsEnabled = false;
  await clearAllReminderTimers();
  await Promise.all(tasks.value.map(task => cancelReminder(task.id)));
}

async function toggleNotificationsSetting(enabled) {
  if (enabled) {
    await enableNotificationsFlow();
    return;
  }

  await disableNotificationsFlow();
}

async function saveReminderSettings() {
  persistState();
  await syncReminders();
  showUiFeedback('Preferencias de recordatorio guardadas localmente.', 'success');
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

  const effectiveAvatarPreferences = buildEffectiveAvatarPreferences();
  for (const task of tasks.value) {
    if (task.isCompleted()) continue;
    const reminderAt = avatarCoach.getReminderAt(task, effectiveAvatarPreferences);
    if (!reminderAt || task.reminderSent) continue;

    await scheduleReminder({
      ...task.toJSON(),
      reminderAt,
    }, markReminderSent);
  }
}

function setReminderTiming(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.ADVANCED_REMINDERS) && !BASIC_TIMINGS.has(value)) {
    requestUpgrade(ENTITLEMENT_KEYS.ADVANCED_REMINDERS);
    return;
  }

  setAvatarPreferences({ reminderTiming: value });
}

function setSnippetTiming(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.AVATAR_PRO) && !BASIC_TIMINGS.has(value)) {
    requestUpgrade(ENTITLEMENT_KEYS.AVATAR_PRO);
    return;
  }

  setAvatarPreferences({ snippetTiming: value });
}

function setSnippetDuration(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.AVATAR_PRO) && value !== AVATAR_SNIPPET_DURATIONS.MEDIUM) {
    requestUpgrade(ENTITLEMENT_KEYS.AVATAR_PRO);
    return;
  }

  setAvatarPreferences({ snippetDuration: value });
}

function setImportantOnly(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.AVATAR_PRO) && value) {
    requestUpgrade(ENTITLEMENT_KEYS.AVATAR_PRO);
    return;
  }

  setAvatarPreferences({ importantOnly: value });
}

async function exportBackup({ encrypted = false } = {}) {
  if (encrypted && !hasFeature(ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP)) {
    requestUpgrade(ENTITLEMENT_KEYS.LOCAL_ENCRYPTED_BACKUP);
    return;
  }

  if (encrypted && !backupPassphrase.value.trim()) {
    showUiFeedback('Escribe una frase para cifrar tu respaldo local.', 'error');
    return;
  }

  isExportingBackup.value = true;
  try {
    await downloadBackupFile(buildPersistedSnapshot(), {
      encrypted,
      passphrase: encrypted ? backupPassphrase.value : '',
      appName: 'ListEA',
      fileNamePrefix: encrypted ? 'listea-secure' : 'listea-local',
    });
    showUiFeedback(
      encrypted
        ? 'Respaldo local cifrado exportado.'
        : 'Respaldo local exportado.',
      'success',
    );
    if (encrypted) {
      backupPassphrase.value = '';
    }
  } catch (error) {
    showUiFeedback(error instanceof Error ? error.message : 'No se pudo exportar el respaldo.', 'error');
  } finally {
    isExportingBackup.value = false;
  }
}

function openBackupImport() {
  backupFileInput.value?.click();
}

async function importBackupFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  isImportingBackup.value = true;
  try {
    const rawText = await readBackupFile(file);
    const snapshot = await parseBackupDocument(rawText, {
      passphrase: importPassphrase.value,
    });

    tasks.value = Array.isArray(snapshot.tasks)
      ? snapshot.tasks.map((task, index) => taskFactory.rehydrate(task, index))
      : [];
    analytics.value = repository.normalizeAnalytics(snapshot.analytics);
    preferences.value = repository.normalizePreferences(snapshot.preferences);
    applyAppearancePreferences();
    dismissUpgradePrompt();
    showUiFeedback('Respaldo local importado correctamente.', 'success');
    await syncReminders();
    syncAvatarSnippet();
  } catch (error) {
    showUiFeedback(error instanceof Error ? error.message : 'No se pudo importar el respaldo.', 'error');
  } finally {
    importPassphrase.value = '';
    event.target.value = '';
    isImportingBackup.value = false;
  }
}

function runProfessionalReviewAction(item) {
  if (!item?.targetView) return;
  emit('navigate', item.targetView);
  if (item.targetView === 'today') {
    activeFilterId.value = FILTER_IDS.NO_DATE;
  }
}

function handleLaunchIntent(intent) {
  if (!intent?.nonce) return;

  if (intent.type === LAUNCH_INTENT_TYPES.CAPTURE) {
    captureTaskFromExternalSource(intent.payload?.text, {
      project: intent.payload?.project,
      area: intent.payload?.area,
      source: intent.payload?.source || CAPTURE_SOURCES.SHARE,
    });
    emit('navigate', intent.view || 'inbox');
    return;
  }

  if (intent.type === LAUNCH_INTENT_TYPES.FOCUS_TASK) {
    focusTaskById(intent.taskId, intent.view);
    return;
  }

  if (intent.type === LAUNCH_INTENT_TYPES.NAVIGATE && intent.view) {
    emit('navigate', intent.view);
  }
}

const resolvedView = computed(() => navigationCatalog.getFallbackView(props.currentView));
const effectiveAvatarPreferences = computed(() => buildEffectiveAvatarPreferences());
const showTaskWorkspace = computed(() => ['inbox', 'today', 'follow-up', 'backlog'].includes(resolvedView.value));
const openTasks = computed(() => sortTasksByRelevance(tasks.value.filter(task => !task.isCompleted())));
const focusTasks = computed(() =>
  sortTasksByRelevance(openTasks.value.filter(task => resolveTaskWorkspaceView(task) === 'today')),
);
const inboxTasks = computed(() =>
  sortTasksByRelevance(applySearch(openTasks.value.filter(task => task.needsTriage))),
);
const followUpTasks = computed(() =>
  sortTasksByRelevance(applySearch(openTasks.value.filter(task =>
    task.status === TASK_STATUS.WAITING
    || task.status === TASK_STATUS.BLOCKED
    || Boolean(task.followUpAt),
  ))),
);
const completedTasks = computed(() =>
  tasks.value
    .filter(task => task.isCompleted())
    .slice()
    .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt))
    .slice(0, 6),
);
const timeFilters = computed(() => {
  const referenceDate = new Date();
  return filterCatalog.getPrimaryFilters()
    .filter(filter => [
      FILTER_IDS.TODAY,
      FILTER_IDS.THIS_WEEK,
      FILTER_IDS.OVERDUE,
      FILTER_IDS.NO_DATE,
    ].includes(filter.id))
    .map(filter => ({
      ...filter,
      count: filterService.apply(focusTasks.value, filter.id, { referenceDate }).length,
    }));
});
const selectedTimeFilter = computed(() =>
  timeFilters.value.find(filter => filter.id === activeFilterId.value)
  ?? timeFilters.value[0],
);
const filteredTasks = computed(() => {
  const filtered = filterService.apply(focusTasks.value, selectedTimeFilter.value?.id ?? FILTER_IDS.TODAY, {
    referenceDate: new Date(),
  });
  return sortTasksByRelevance(applySearch(filtered));
});
const agendaTasks = computed(() => sortTasksByRelevance(applySearch(openTasks.value)));
const professionalReviewItems = computed(() => professionalReviewAnalyzer.analyze(openTasks.value, {
  referenceDate: new Date(),
}));
const focusEmptyMessage = computed(() => {
  if (selectedTimeFilter.value?.id === FILTER_IDS.OVERDUE) {
    return 'No hay tareas vencidas.';
  }

  if (selectedTimeFilter.value?.id === FILTER_IDS.NO_DATE) {
    return 'No hay tareas sin fecha.';
  }

  if (selectedTimeFilter.value?.id === FILTER_IDS.THIS_WEEK) {
    return 'No hay tareas para esta semana.';
  }

  return 'No hay tareas dentro de esta ventana de tiempo.';
});
const backlogInsights = computed(() => insightAnalyzer.analyze(openTasks.value, {
  referenceDate: new Date(),
}));
const visibleBacklogInsights = computed(() =>
  hasFeature(ENTITLEMENT_KEYS.PREMIUM_INSIGHTS) ? backlogInsights.value : [],
);
const summary = computed(() => ({
  pending: openTasks.value.length,
  overdue: openTasks.value.filter(task => task.dueAt && new Date(task.dueAt) < new Date()).length,
  today: filterService.apply(focusTasks.value, FILTER_IDS.TODAY, { referenceDate: new Date() }).length,
  inbox: inboxTasks.value.length,
  followUp: followUpTasks.value.length,
  blocked: openTasks.value.filter(task => task.status === TASK_STATUS.BLOCKED).length,
}));
const heroCopy = computed(() => {
  if (resolvedView.value === 'inbox') {
    return {
      eyebrow: 'Capturas',
      title: 'Convierte capturas rapidas en siguientes pasos claros.',
      description: 'Capturas guarda ideas, llamadas y compromisos hasta que decidas que hacer con ellos.',
    };
  }

  if (resolvedView.value === 'follow-up') {
    return {
      eyebrow: 'Seguimiento',
      title: 'Manten promesas, respuestas y pendientes visibles.',
      description: 'Aqui se junta lo que espera respuesta, esta bloqueado o necesita nueva fecha.',
    };
  }

  if (resolvedView.value === 'backlog') {
    return {
      eyebrow: 'Agenda',
      title: 'Ordena tu backlog con contexto real y privado.',
      description: 'Aqui ves senales y tareas activas para decidir mejor sin sacar datos del dispositivo.',
    };
  }

  return {
    eyebrow: 'Hoy',
    title: 'Captura rapido, decide el siguiente paso y ejecuta con foco.',
    description: 'ListEA prioriza lo que toca hoy sin perder el hilo de tu seguimiento.',
  };
});
const summaryCards = computed(() => {
  if (resolvedView.value === 'inbox') {
    return [
      { id: 'inbox', label: 'En Capturas', value: summary.value.inbox },
      { id: 'today', label: 'Para hoy', value: summary.value.today },
      { id: 'followUp', label: 'En seguimiento', value: summary.value.followUp },
    ];
  }

  if (resolvedView.value === 'follow-up') {
    return [
      { id: 'followUp', label: 'Seguimientos', value: summary.value.followUp },
      { id: 'blocked', label: 'Bloqueadas', value: summary.value.blocked },
      { id: 'overdue', label: 'Vencidas', value: summary.value.overdue },
    ];
  }

  return [
    { id: 'pending', label: 'Abiertas', value: summary.value.pending },
    { id: 'today', label: 'Para hoy', value: summary.value.today },
    { id: 'overdue', label: 'Vencidas', value: summary.value.overdue },
  ];
});
const activePaletteId = computed(() => hasFeature(ENTITLEMENT_KEYS.PREMIUM_THEMES)
  ? (preferences.value.colorPalette ?? COLOR_PALETTES.OCEAN)
  : COLOR_PALETTES.OCEAN);
const licenseSummary = computed(() => preferences.value.license?.licenseTier === LICENSE_TIERS.PRO
  ? 'ListEA Pro activado en este dispositivo.'
  : 'ListEA Free activo. Tus tareas siguen siendo privadas y locales.');
const isProActive = computed(() => preferences.value.license?.licenseTier === LICENSE_TIERS.PRO);

function formatTaskCount(value) {
  return `${value} ${value === 1 ? 'tarea' : 'tareas'}`;
}

watch(
  () => resolvedView.value,
  nextView => {
    if (nextView !== props.currentView) {
      emit('navigate', nextView);
    }
    syncAvatarSnippet();
  },
);

watch(
  [tasks, analytics, preferences],
  async () => {
    if (!mounted.value) return;
    persistState();
    await syncReminders();
    syncAvatarSnippet();
  },
  { deep: true, flush: 'sync' },
);

watch(
  () => [
    preferences.value.themeMode,
    preferences.value.colorPalette,
    preferences.value.license?.licenseTier,
  ],
  () => {
    applyAppearancePreferences();
  },
  { immediate: true },
);

watch(
  () => props.launchIntent,
  nextIntent => {
    handleLaunchIntent(nextIntent);
  },
);

onMounted(async () => {
  loadState();
  isNativeReminderPlatform.value = await isNativeReminderRuntime();
  preferences.value.reminderPermission = await getReminderPermission();
  preferences.value.exactAlarmPermission = await getExactAlarmPermission();
  await registerReminderInteractions({
    onNotificationReceived: handleReminderNotificationReceived,
    onNotificationAction: handleReminderNotificationAction,
  });
  mounted.value = true;
  applyAppearancePreferences();
  persistState();
  await syncReminders();
  syncAvatarSnippet();
});

onBeforeUnmount(() => {
  clearAllReminderTimers();
  clearReminderInteractions();
  clearAvatarSnippetTimer();
  clearAvatarSnippetHideTimer();
  clearUiFeedbackTimer();
});
</script>

<template>
  <section class="tasksShell">
    <section v-if="showTaskWorkspace" class="topBar">
      <div class="topCopy">
        <p class="eyebrow">{{ heroCopy.eyebrow }}</p>
        <h1>{{ heroCopy.title }}</h1>
        <p class="panelText">{{ heroCopy.description }}</p>
      </div>
      <div class="topStats">
        <article v-for="card in summaryCards" :key="card.id" class="statCard">
          <strong>{{ card.value }}</strong>
          <span>{{ card.label }}</span>
        </article>
      </div>
    </section>

    <AddTask v-if="showTaskWorkspace" @add="addTask" />

    <transition name="timeSwap">
      <div
        v-if="uiFeedback && showTaskWorkspace"
        class="feedbackBanner"
        :data-tone="uiFeedback.tone"
        aria-live="polite"
        role="status"
      >
        <p>{{ uiFeedback.message }}</p>
        <button type="button" class="ghostButton feedbackClose" @click="dismissUiFeedback">
          Cerrar
        </button>
      </div>
    </transition>

    <transition name="snippetPulse">
      <div
        v-if="avatarSnippet && showTaskWorkspace"
        class="snippetOverlay"
        aria-atomic="true"
        aria-live="polite"
        role="status"
      >
        <div class="snippetCard" :data-tone="avatarSnippet.tone">
          <div class="snippetBubble">
            <p class="eyebrow">Aviso</p>
            <strong>{{ avatarSnippet.title }}</strong>
            <p class="snippetTask">{{ avatarSnippet.message }}</p>
            <p v-if="avatarSnippet.context" class="snippetContext">{{ avatarSnippet.context }}</p>
          </div>

          <div class="snippetActions">
            <button type="button" class="primaryButton" @click="openReminderPrimaryAction(avatarSnippet.taskId, avatarSnippet.preferredView)">
              {{ avatarSnippet.primaryAction?.label ?? 'Abrir' }}
            </button>
            <button v-if="avatarSnippet.primaryAction" type="button" class="ghostButton" @click="openReminderTask(avatarSnippet.taskId, avatarSnippet.preferredView)">
              Ver tarea
            </button>
            <button type="button" class="ghostButton" @click="completeReminderTask(avatarSnippet.taskId)">
              Completar
            </button>
            <button type="button" class="ghostButton" @click="snoozeReminderTask(avatarSnippet.taskId, 10)">
              Posponer 10m
            </button>
            <button type="button" class="ghostButton" @click="moveReminderTaskToTomorrow(avatarSnippet.taskId)">
              Manana
            </button>
          </div>

          <button type="button" class="ghostButton snippetClose" @click="dismissAvatarSnippet()">
            Cerrar
          </button>
        </div>
      </div>
    </transition>

    <transition name="timeSwap">
      <div
        v-if="upgradePrompt"
        class="upgradeBanner"
        aria-live="polite"
        role="status"
      >
        <div>
          <p class="eyebrow">ListEA Pro</p>
          <strong>{{ upgradePrompt.title }}</strong>
          <p>{{ upgradePrompt.message }}</p>
        </div>
        <div class="upgradeActions">
          <button type="button" class="primaryButton" @click="openUpgradeSettings">
            Ver opciones Pro
          </button>
          <button type="button" class="ghostButton" @click="dismissUpgradePrompt">
            Cerrar
          </button>
        </div>
      </div>
    </transition>

    <section v-if="showTaskWorkspace" class="filterBar">
      <label class="searchField">
        <span class="srOnly">Buscar tareas</span>
        <input v-model="searchQuery" type="search" placeholder="Buscar por tarea, proyecto, area o tag" />
      </label>
    </section>

    <section v-if="resolvedView === 'inbox'" class="workflowGrid">
      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Capturas</p>
            <h3>Capturas pendientes por ordenar</h3>
          </div>
          <div class="headerActions">
            <span class="laneCount">{{ formatTaskCount(inboxTasks.length) }}</span>
          </div>
        </div>
        <p class="panelText">Captura primero. Ordena cuando toque.</p>
        <TodoList
          :todos="inboxTasks"
          :task-actions="INBOX_TASK_ACTIONS"
          empty-message="No hay capturas pendientes. Todo ya tiene siguiente paso."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
          @task-action="handleTaskAction"
          @open-external="handleTaskLaunchRequest"
        />
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Revision rapida</p>
            <h3>Senales que conviene resolver primero</h3>
          </div>
        </div>
        <div v-if="professionalReviewItems.length" class="reviewList">
          <article v-for="item in professionalReviewItems" :key="item.id" class="reviewCard">
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.message }}</p>
            </div>
            <button type="button" class="ghostButton" @click="runProfessionalReviewAction(item)">
              {{ item.actionLabel }}
            </button>
          </article>
        </div>
        <p v-else class="emptyText">No hay senales urgentes en tu revision profesional.</p>
      </article>
    </section>

    <section v-else-if="resolvedView === 'today'" class="focusBoardGrid">
      <article ref="focusListPanelRef" class="panelCard focusListPanel">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Activa</p>
            <h3>{{ selectedTimeFilter.label }}</h3>
          </div>
          <div class="headerActions">
            <button type="button" class="ghostButton" @click="resetTaskWorkspaceView">Reiniciar vista</button>
            <span class="laneCount">{{ formatTaskCount(filteredTasks.length) }}</span>
          </div>
        </div>

        <div class="focusFilterBar">
          <button
            v-for="filter in timeFilters"
            :key="filter.id"
            type="button"
            class="timeFilterTile focusFilterTile"
            :class="{ active: selectedTimeFilter.id === filter.id }"
            @click="selectTimeFilter(filter.id)"
          >
            <span class="timeFilterLabel">{{ filter.label }}</span>
            <strong>{{ filter.count }}</strong>
          </button>
        </div>

        <transition name="timeSwap" mode="out-in">
          <div :key="selectedTimeFilter.id" class="focusListWrap">
            <TodoList
              :todos="filteredTasks"
              :empty-message="focusEmptyMessage"
              @toggle="toggleTask"
              @remove="removeTask"
              @update="updateTask"
              @toggle-subtask="toggleSubtask"
              @open-external="handleTaskLaunchRequest"
            />
          </div>
        </transition>
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Completadas</p>
            <h3>Completadas recientes</h3>
          </div>
          <div class="headerActions">
            <button type="button" class="ghostButton" @click="resetTaskWorkspaceView">Reiniciar vista</button>
            <span class="laneCount">{{ formatTaskCount(completedTasks.length) }}</span>
          </div>
        </div>

        <TodoList
          :todos="completedTasks"
          empty-message="Todavia no hay tareas completadas."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
          @open-external="handleTaskLaunchRequest"
        />
      </article>
    </section>

    <section v-else-if="resolvedView === 'follow-up'" class="workflowGrid">
      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Seguimiento</p>
            <h3>Pendientes de respuesta, espera o desbloqueo</h3>
          </div>
          <div class="headerActions">
            <span class="laneCount">{{ formatTaskCount(followUpTasks.length) }}</span>
          </div>
        </div>
        <p class="panelText">Todo lo que espera respuesta o nueva fecha vive aqui.</p>
        <TodoList
          :todos="followUpTasks"
          :task-actions="FOLLOW_UP_TASK_ACTIONS"
          empty-message="No hay seguimientos ni bloqueos pendientes."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
          @task-action="handleTaskAction"
          @open-external="handleTaskLaunchRequest"
        />
      </article>

      <article class="panelCard insightsPanel">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Revision profesional</p>
            <h3>Resumen local de 3 a 5 minutos</h3>
          </div>
        </div>
        <div v-if="professionalReviewItems.length" class="reviewList">
          <article v-for="item in professionalReviewItems" :key="item.id" class="reviewCard">
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.message }}</p>
            </div>
            <button type="button" class="ghostButton" @click="runProfessionalReviewAction(item)">
              {{ item.actionLabel }}
            </button>
          </article>
        </div>
        <p v-else class="emptyText">Tu seguimiento se ve bajo control en este momento.</p>
      </article>
    </section>

    <section v-else-if="resolvedView === 'backlog'" class="backlogGrid">
      <article class="panelCard insightsPanel">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Agenda</p>
            <h3>Senales que conviene resolver primero</h3>
          </div>
        </div>

        <div v-if="visibleBacklogInsights.length" class="insightList">
          <article v-for="insight in visibleBacklogInsights" :key="insight.id" class="insightCard">
            <strong>{{ insight.title }}</strong>
            <p>{{ insight.message }}</p>
          </article>
        </div>
        <div v-else-if="backlogInsights.length" class="upgradePanel">
          <strong>ListEA Pro lee tu backlog sin sacar datos del dispositivo.</strong>
          <p class="panelText">Desbloquea deteccion de duplicados y tareas sin decision en local.</p>
          <button type="button" class="ghostButton" @click="requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_INSIGHTS)">
            Ver ListEA Pro
          </button>
        </div>
        <p v-else class="emptyText">No hay alertas relevantes en la agenda.</p>
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Agenda</p>
            <h3>Tareas activas ordenadas por fecha y prioridad</h3>
          </div>
          <div class="headerActions">
            <button type="button" class="ghostButton" @click="resetTaskWorkspaceView">Reiniciar vista</button>
          </div>
        </div>

        <TodoList
          :todos="agendaTasks"
          empty-message="No hay tareas activas en tu agenda."
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
          @open-external="handleTaskLaunchRequest"
        />
      </article>

      <article class="panelCard">
        <div class="sectionHeader">
          <div class="headerToggleWrap">
            <button
              type="button"
              class="sectionToggle"
              :aria-expanded="backlogCompletedOpen ? 'true' : 'false'"
              @click="backlogCompletedOpen = !backlogCompletedOpen"
            >
              <span class="eyebrow">Completadas recientes</span>
              <span class="sectionToggleTitle">Completadas recientes</span>
            </button>
            <button type="button" class="ghostButton" @click="resetTaskWorkspaceView">Reiniciar vista</button>
          </div>
          <span class="laneCount">{{ formatTaskCount(completedTasks.length) }}</span>
        </div>

        <div v-if="backlogCompletedOpen">
          <p class="panelText recentCompletedLabel">Lista reciente de tareas completadas</p>
          <TodoList
            :todos="completedTasks"
            empty-message="Todavia no hay tareas completadas."
            @toggle="toggleTask"
            @remove="removeTask"
            @update="updateTask"
            @toggle-subtask="toggleSubtask"
            @open-external="handleTaskLaunchRequest"
          />
        </div>
      </article>
    </section>

    <section v-else-if="resolvedView === 'dashboard'" class="dashboardGrid">
      <ProductivityDashboard
        :analytics="analytics"
        :entitlements="preferences.license.entitlements"
        :license-tier="preferences.license.licenseTier"
        :tasks="tasks"
        @clear-analytics="clearAnalytics"
        @upgrade="requestUpgrade"
      />
    </section>

    <section v-else class="settingsGrid">
      <article class="panelCard">
        <p class="eyebrow">Privacidad</p>
        <h3>Todo vive en este dispositivo</h3>
        <p class="panelText">Todo queda en este dispositivo. Sin cuentas ni nube propia.</p>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Plan</p>
        <h3>ListEA Free y ListEA Pro</h3>
        <p class="panelText">{{ licenseSummary }}</p>
        <div class="settingsStack">
          <div class="licenseBadgeRow">
            <span class="licenseBadge" :data-tier="preferences.license.licenseTier">
              {{ isProActive ? 'ListEA Pro' : 'ListEA Free' }}
            </span>
            <span class="panelText">
              {{ isProActive ? 'Pago unico local preparado para este dispositivo.' : 'Tus tareas siguen completas y privadas en el plan Free.' }}
            </span>
          </div>
          <p class="panelText">
            Pro desbloquea revision avanzada, avisos avanzados, apertura inteligente de apps, paletas premium y respaldo cifrado.
          </p>
          <div class="buttonRow">
            <button v-if="!isProActive" type="button" class="primaryButton" @click="activateProLocally">
              Activar ListEA Pro local
            </button>
            <button type="button" class="ghostButton" @click="restoreLocalPro">
              Restaurar Pro local
            </button>
            <button v-if="isProActive" type="button" class="ghostButton" @click="revertToFreePlan">
              Volver a Free
            </button>
          </div>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Notificaciones</p>
        <h3>Recordatorios nativos y accionables</h3>
        <p class="panelText">Estado actual: {{ preferences.reminderPermission }}</p>
        <p class="panelText">Recordatorios: {{ preferences.notificationsEnabled ? 'activados' : 'desactivados' }}</p>
        <p class="panelText">Alarma exacta: {{ preferences.exactAlarmPermission }}</p>
        <div class="settingsStack">
          <label class="checkboxRow">
            <input
              :checked="preferences.notificationsEnabled"
              type="checkbox"
              @change="toggleNotificationsSetting($event.target.checked)"
            />
            <span>Activar recordatorios</span>
          </label>

          <label class="fieldGroup">
            <span>Momento del recordatorio</span>
            <select
              class="detailField"
              :value="effectiveAvatarPreferences.reminderTiming"
              @change="setReminderTiming($event.target.value)"
            >
              <option :value="AVATAR_TIMINGS.NEVER">Nunca</option>
              <option :value="AVATAR_TIMINGS.BEFORE_10" :disabled="!preferences.license.entitlements.advancedReminders">10 min antes</option>
              <option :value="AVATAR_TIMINGS.BEFORE_5" :disabled="!preferences.license.entitlements.advancedReminders">5 min antes</option>
              <option :value="AVATAR_TIMINGS.ON_TIME">Justo a tiempo</option>
              <option :value="AVATAR_TIMINGS.AFTER_10" :disabled="!preferences.license.entitlements.advancedReminders">10 min despues</option>
            </select>
          </label>
          <p v-if="!preferences.license.entitlements.advancedReminders" class="panelText">
            Free incluye avisos basicos. ListEA Pro desbloquea recordatorios antes o despues de la hora objetivo.
          </p>

          <div class="buttonRow">
            <button type="button" class="primaryButton" @click="saveReminderSettings">
              Guardar preferencias
            </button>
          </div>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Avisos</p>
        <h3>Globo local cuando toca actuar</h3>
        <div class="settingsStack">
          <label class="checkboxRow">
            <input
              :checked="preferences.avatar.enabled"
              type="checkbox"
              @change="setAvatarPreferences({ enabled: $event.target.checked })"
            />
            <span>Activar avisos</span>
          </label>

          <label class="checkboxRow">
            <input
              :checked="preferences.avatar.snippetEnabled"
              type="checkbox"
              @change="setAvatarPreferences({ snippetEnabled: $event.target.checked })"
            />
            <span>Mostrar avisos en pantalla</span>
          </label>

          <label class="fieldGroup">
            <span>Momento del aviso</span>
            <select
              class="detailField"
              :value="effectiveAvatarPreferences.snippetTiming"
              @change="setSnippetTiming($event.target.value)"
            >
              <option :value="AVATAR_TIMINGS.NEVER">Nunca</option>
              <option :value="AVATAR_TIMINGS.BEFORE_10" :disabled="!preferences.license.entitlements.avatarPro">10 min antes</option>
              <option :value="AVATAR_TIMINGS.BEFORE_5" :disabled="!preferences.license.entitlements.avatarPro">5 min antes</option>
              <option :value="AVATAR_TIMINGS.ON_TIME">Justo a tiempo</option>
              <option :value="AVATAR_TIMINGS.AFTER_10" :disabled="!preferences.license.entitlements.avatarPro">10 min despues</option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Duracion del aviso</span>
            <select
              class="detailField"
              :value="effectiveAvatarPreferences.snippetDuration"
              @change="setSnippetDuration($event.target.value)"
            >
              <option :value="AVATAR_SNIPPET_DURATIONS.SHORT" :disabled="!preferences.license.entitlements.avatarPro">Corta</option>
              <option :value="AVATAR_SNIPPET_DURATIONS.MEDIUM">Media</option>
              <option :value="AVATAR_SNIPPET_DURATIONS.LONG" :disabled="!preferences.license.entitlements.avatarPro">Larga</option>
              <option :value="AVATAR_SNIPPET_DURATIONS.STICKY" :disabled="!preferences.license.entitlements.avatarPro">Hasta cerrarlo</option>
            </select>
          </label>

          <label class="checkboxRow">
            <input
              :checked="effectiveAvatarPreferences.importantOnly"
              type="checkbox"
              @change="setImportantOnly($event.target.checked)"
            />
            <span>Solo para tareas importantes</span>
          </label>
          <p v-if="!preferences.license.entitlements.avatarPro" class="panelText">
            El avatar basico sigue disponible gratis. ListEA Pro desbloquea duracion y filtros avanzados.
          </p>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Respaldo</p>
        <h3>Exporta e importa tus datos localmente</h3>
        <div class="settingsStack">
          <p class="panelText">Exporta e importa con un archivo local. El cifrado queda para ListEA Pro.</p>
          <label class="fieldGroup">
            <span>Frase para respaldo cifrado</span>
            <input
              v-model="backupPassphrase"
              class="detailField"
              type="password"
              placeholder="Solo necesaria para el respaldo cifrado"
            />
          </label>
          <label class="fieldGroup">
            <span>Frase para importar respaldo cifrado</span>
            <input
              v-model="importPassphrase"
              class="detailField"
              type="password"
              placeholder="Escribela solo si el archivo esta cifrado"
            />
          </label>
          <div class="buttonRow">
            <button type="button" class="ghostButton" :disabled="isExportingBackup" @click="exportBackup()">
              {{ isExportingBackup ? 'Exportando...' : 'Exportar respaldo local' }}
            </button>
            <button type="button" class="primaryButton" :disabled="isExportingBackup" @click="exportBackup({ encrypted: true })">
              Respaldo cifrado Pro
            </button>
            <button type="button" class="ghostButton" :disabled="isImportingBackup" @click="openBackupImport">
              {{ isImportingBackup ? 'Importando...' : 'Importar respaldo local' }}
            </button>
          </div>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Apariencia</p>
        <h3>Dia, noche y paleta de color</h3>
        <div class="settingsStack">
          <label class="fieldGroup">
            <span>Modo</span>
            <select
              class="detailField"
              :value="preferences.themeMode"
              @change="setAppearancePreferences({ themeMode: $event.target.value })"
            >
              <option :value="THEME_MODES.LIGHT">Dia</option>
              <option :value="THEME_MODES.DARK">Noche</option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Paleta</span>
            <p v-if="!preferences.license.entitlements.premiumThemes" class="panelText">
              Oceano sigue disponible gratis. Las paletas exclusivas se habilitan con ListEA Pro.
            </p>
            <div class="palettePickerStack">
              <button
                type="button"
                class="paletteToggleButton"
                :aria-expanded="paletteSelectorOpen ? 'true' : 'false'"
                @click="togglePaletteSelector"
              >
                <span>Cambiar paleta de colores</span>
                <strong>{{ paletteOptions.find(palette => palette.id === activePaletteId)?.label ?? 'Oceano' }}</strong>
              </button>

              <div v-if="paletteSelectorOpen" class="paletteGrid">
                <button
                  v-for="palette in paletteOptions"
                  :key="palette.id"
                  type="button"
                  class="paletteCard"
                  :class="{ active: activePaletteId === palette.id }"
                  :data-palette="palette.id"
                  @click="selectColorPalette(palette.id)"
                >
                  <span class="paletteSwatch"></span>
                  <strong>{{ palette.label }}</strong>
                  <small>{{ palette.description }}</small>
                </button>
              </div>
            </div>
          </label>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Contexto de subtareas</p>
        <h3>Siempre visible</h3>
        <p class="panelText">Cada subtarea mantiene su padre, prioridad y fecha visible en la misma tarjeta.</p>
      </article>

      <input
        ref="backupFileInput"
        class="srOnly"
        type="file"
        accept="application/json,.json,.listea-backup.json,.listea-secure.json"
        @change="importBackupFromFile"
      />
    </section>
  </section>
</template>

<style scoped>
.tasksShell {
  width: min(100%, 960px);
  margin: 0 auto 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.topBar,
.panelCard {
  border-radius: 28px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.topBar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.92fr);
  gap: 14px;
  padding: 16px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 34%),
    var(--surface);
}

.topCopy {
  display: grid;
  gap: 6px;
  align-content: start;
}

.topCopy h1,
.eyebrow {
  margin: 0;
  text-align: left;
}

.topCopy h1 {
  margin-top: 0.35rem;
  margin-bottom: 0.5rem;
  max-width: 18ch;
  font-size: clamp(1.25rem, 4vw, 1.78rem);
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
.emptyText {
  color: var(--text-muted);
  line-height: 1.45;
  text-wrap: pretty;
  max-width: 60ch;
}

.topStats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-self: stretch;
  grid-auto-rows: 1fr;
}

.feedbackBanner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, white);
  box-shadow: var(--card-shadow);
  backdrop-filter: blur(12px);
}

.feedbackBanner[data-tone='success'] {
  border-color: color-mix(in srgb, #5f8d64 34%, var(--line));
}

.feedbackBanner[data-tone='error'] {
  border-color: color-mix(in srgb, #de6f4d 38%, var(--line));
}

.feedbackBanner[data-tone='info'] {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
}

.feedbackBanner p {
  margin: 0;
  text-align: left;
  font-weight: 600;
}

.upgradeBanner,
.upgradePanel {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
  background: color-mix(in srgb, var(--surface) 86%, white);
  box-shadow: var(--card-shadow);
}

.upgradeBanner strong,
.upgradePanel strong {
  display: block;
  text-align: left;
}

.upgradeBanner p,
.upgradePanel p {
  margin: 6px 0 0;
  text-align: left;
}

.upgradeActions,
.licenseBadgeRow {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.licenseBadge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-main);
  font-weight: 700;
}

.licenseBadge[data-tier='pro'] {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  color: var(--accent-strong);
}

.feedbackClose {
  flex-shrink: 0;
}

.statCard {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 2px;
  min-height: 76px;
  padding: 12px;
  border-radius: 18px;
  background: var(--surface-soft);
  text-align: left;
}

.statCard strong {
  font-size: clamp(1.25rem, 4vw, 1.7rem);
}

.snippetOverlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: max(16px, env(safe-area-inset-top)) 18px max(16px, env(safe-area-inset-bottom));
  pointer-events: none;
}

.snippetCard {
  --snippet-card-max: min(92vw, 360px);
  width: min(100%, var(--snippet-card-max));
  max-width: var(--snippet-card-max);
  margin-inline: auto;
  display: grid;
  gap: 10px;
  padding: 0;
  border-radius: 26px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, white);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
  pointer-events: auto;
  position: relative;
}

.snippetCard[data-tone='focus'] {
  border-color: color-mix(in srgb, #d46a47 45%, var(--line));
}

.snippetCard[data-tone='nudge'] {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
}

.snippetCard[data-tone='coach'] {
  border-color: color-mix(in srgb, #5f8d64 38%, var(--line));
}

.snippetBubble {
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 18px 88px 10px 18px;
  border-radius: 22px;
  background: var(--surface-soft);
  text-align: center;
}

.snippetBubble strong,
.snippetTask {
  position: relative;
  z-index: 1;
}

.snippetBubble strong {
  display: block;
  font-size: 0.96rem;
  color: var(--accent-strong);
  line-height: 1.2;
}

.snippetTask {
  margin: 6px 0 0;
  max-width: 100%;
  font-size: clamp(1rem, 4vw, 1.16rem);
  line-height: 1.2;
  color: var(--text-main);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.snippetContext {
  margin: 10px 0 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--text-muted);
}

.snippetActions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 18px;
}

.snippetActions .ghostButton,
.snippetActions .primaryButton {
  flex: 1 1 140px;
}

.snippetClose {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 70px;
  height: 32px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  line-height: 1;
  font-size: 0.78rem;
  font-weight: 700;
}

.filterBar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: calc(62px + env(safe-area-inset-top));
  z-index: 18;
  padding: 8px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(14px);
}

.searchField {
  display: block;
}

.timeFilterGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.timeFilterTile {
  min-height: 82px;
  border-radius: 20px;
  border: 1px solid var(--line);
}

.timeFilterTile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  background: var(--surface-soft);
  color: var(--text-main);
  text-align: left;
}

.timeFilterLabel {
  color: var(--text-muted);
}

.timeFilterTile strong {
  font-size: clamp(1.1rem, 4vw, 1.55rem);
}

.timeFilterTile strong {
  margin-top: auto;
}

.timeFilterLabel {
  font-weight: 700;
  color: var(--text-main);
}

.timeFilterTile.active {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
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
  font-size: 16px;
}

.focusBoardGrid,
.workflowGrid,
.backlogGrid,
.dashboardGrid,
.settingsGrid {
  display: grid;
  gap: 14px;
}

.focusBoardGrid {
  grid-template-columns: 1fr;
}

.workflowGrid {
  grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
}

.backlogGrid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.dashboardGrid {
  grid-template-columns: 1fr;
}

.settingsGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panelCard {
  padding: 18px;
}

.laneHeader,
.sectionHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.headerActions,
.headerToggleWrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sectionToggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.sectionToggle:hover {
  transform: none;
}

.sectionToggleTitle {
  font-size: 1.1rem;
  font-weight: 700;
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

.laneCount {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--surface-soft);
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.focusListPanel,
.widePanel {
  grid-column: 1 / -1;
}

.focusListWrap {
  min-height: 120px;
}

.focusFilterBar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.focusFilterTile {
  min-height: 62px;
  gap: 6px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--surface-soft) 82%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, var(--line));
}

.focusFilterTile .timeFilterLabel {
  font-size: 0.86rem;
}

.focusFilterTile strong {
  font-size: 1rem;
}

.insightsPanel {
  grid-column: 1 / -1;
}

.insightList {
  display: grid;
  gap: 12px;
}

.reviewList {
  display: grid;
  gap: 12px;
}

.insightCard {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--surface-soft);
}

.reviewCard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface-soft) 88%, white);
}

.reviewCard button {
  align-self: center;
}

.insightCard strong,
.insightCard p,
.reviewCard strong,
.reviewCard p {
  display: block;
  text-align: left;
}

.insightCard p,
.reviewCard p {
  margin: 6px 0 0;
}

.buttonRow,
.settingsStack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.settingsGrid > .panelCard:first-child,
.settingsGrid > .panelCard:nth-child(2) {
  grid-column: 1 / -1;
}

.recentCompletedLabel {
  margin: 0 0 14px;
}

.paletteGrid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.palettePickerStack {
  width: 100%;
  display: grid;
  gap: 10px;
}

.paletteToggleButton {
  width: 100%;
  min-height: 58px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--text-main);
  text-align: left;
}

.paletteToggleButton strong {
  color: var(--accent-strong);
}

.paletteCard {
  min-height: 102px;
  padding: 12px;
  display: grid;
  justify-items: start;
  gap: 6px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--text-main);
  text-align: left;
}

.paletteCard strong,
.paletteCard small {
  display: block;
}

.paletteCard small {
  color: var(--text-muted);
}

.paletteCard.active {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent);
}

.paletteSwatch {
  width: 100%;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 40%, white));
}

.paletteCard[data-palette='warm'] .paletteSwatch {
  background: linear-gradient(135deg, #d96d31, #f2b27a);
}

.paletteCard[data-palette='ocean'] .paletteSwatch {
  background: linear-gradient(135deg, #2677a6, #7ed0eb);
}

.paletteCard[data-palette='forest'] .paletteSwatch {
  background: linear-gradient(135deg, #3d7b4f, #92c89a);
}

.paletteCard[data-palette='berry'] .paletteSwatch {
  background: linear-gradient(135deg, #9f4d7a, #e3a2cb);
}

.paletteCard[data-palette='aurora'] .paletteSwatch {
  background: linear-gradient(135deg, #5b7cff, #74e0d6);
}

.paletteCard[data-palette='noir'] .paletteSwatch {
  background: linear-gradient(135deg, #5b6678, #aab4c7);
}

.paletteCard[data-palette='sunset'] .paletteSwatch {
  background: linear-gradient(135deg, #d95a4e, #f5b36a);
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

.snippetPulse-enter-active .snippetCard,
.snippetPulse-leave-active .snippetCard {
  transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease;
}

.snippetPulse-enter-from .snippetCard,
.snippetPulse-leave-to .snippetCard {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
  filter: blur(4px);
}

.timeSwap-enter-active,
.timeSwap-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.timeSwap-enter-from,
.timeSwap-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 860px) {
  .tasksShell {
    width: min(100%, 860px);
  }

  .topBar,
  .workflowGrid,
  .focusBoardGrid,
  .backlogGrid,
  .settingsGrid,
  .timeFilterGrid {
    grid-template-columns: 1fr;
  }

  .sectionHeader {
    flex-direction: column;
  }

  .headerActions,
  .headerToggleWrap {
    width: 100%;
    justify-content: flex-start;
  }

  .reviewCard {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .tasksShell {
    width: calc(100% - 14px);
    gap: 10px;
  }

  .topBar,
  .panelCard {
    padding: 12px;
    border-radius: 20px;
  }

  .focusListPanel {
    padding: 12px;
    border-radius: 18px;
  }

  .topCopy h1 {
    max-width: none;
    font-size: clamp(1.02rem, 5vw, 1.3rem);
  }

  .panelText {
    font-size: 0.89rem;
    line-height: 1.4;
  }

  .topStats {
    display: flex;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .topStats::-webkit-scrollbar {
    display: none;
  }

  .statCard {
    min-width: 124px;
    min-height: 68px;
    padding: 10px;
  }

  .sectionHeader {
    gap: 10px;
    align-items: flex-start;
  }

  .headerActions,
  .headerToggleWrap {
    width: 100%;
    justify-content: space-between;
  }

  .laneCount {
    align-self: flex-start;
    justify-self: auto;
  }

  .feedbackBanner {
    flex-direction: column;
    align-items: flex-start;
  }

  .upgradeActions {
    flex-direction: column;
    align-items: stretch;
  }

  .filterBar {
    top: calc(56px + env(safe-area-inset-top));
    padding: 6px;
    border-radius: 18px;
  }

  .focusFilterBar {
    display: flex;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .focusFilterBar::-webkit-scrollbar {
    display: none;
  }

  .paletteGrid {
    grid-template-columns: 1fr;
  }

  .snippetActions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0 14px 14px;
  }

  .focusFilterTile {
    min-height: 52px;
    padding: 9px 12px;
    border-radius: 16px;
    flex: 0 0 150px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .focusFilterTile .timeFilterLabel {
    font-size: 0.82rem;
  }

  .focusFilterTile strong {
    margin-top: 0;
    font-size: 0.95rem;
  }

  .snippetCard {
    --snippet-card-max: min(92vw, 340px);
  }

  .snippetBubble {
    padding: 18px 72px 18px 16px;
    text-align: left;
  }

  .snippetClose {
    top: 8px;
    right: 8px;
  }

  .snippetOverlay {
    place-items: end center;
    padding: 16px 12px max(14px, env(safe-area-inset-bottom) + 10px);
  }

  .topCopy h1 {
    max-width: none;
    font-size: clamp(1.08rem, 5vw, 1.38rem);
  }
}
</style>
