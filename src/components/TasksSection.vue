<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AddTask from './AddTask.vue';
import ProductivityDashboard from './ProductivityDashboard.vue';
import TaskCalendar from './TaskCalendar.vue';
import TodoList from './TodoList.vue';
import {
  clearReminderInteractions,
  clearAllReminderTimers,
  enableExactReminders,
  enableReminders,
  getExactAlarmPermission,
  getReminderPermission,
  isNativeReminderRuntime,
  registerReminderInteractions,
  REMINDER_ACTION_IDS,
} from '../services/reminders';
import {
  AvatarCoach,
  AvatarPreferences,
  AVATAR_SNIPPET_DURATIONS,
  AVATAR_TIMINGS,
} from '../domain/avatar';
import {
  AssistantBriefService,
  MobileAssistantPreferences,
  OperationalReportService,
  ReminderPolicyEngine,
  REMINDER_LANES,
  WEEKDAY_OPTIONS,
} from '../domain/mobileAssistant';
import {
  BacklogRescuePlanner,
  DailyRecoveryPlanner,
  ReminderPersonalityCopywriter,
  REMINDER_PERSONALITY_OPTIONS,
  TaskHealthAnalyzer,
} from '../domain/operability';
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
  hasEntitlement,
} from '../domain/license';
import { LocalTaskRepository } from '../domain/localFirst';
import { NavigationCatalog } from '../domain/navigation';
import { QuickCaptureInterpreter } from '../domain/quickCapture';
import { RecurrenceEngine } from '../domain/recurrence';
import { downloadBackupFile, parseBackupDocument, readBackupFile } from '../services/localBackup';
import { LAUNCH_INTENT_TYPES } from '../services/launchIntents';
import { ReminderActionContext, ReminderActionRouter } from '../services/reminderActionRouter';
import { ReminderScheduleService } from '../services/reminderScheduleService';
import { LISTEA_PRO_MONTHLY_PLAN, SubscriptionService } from '../services/subscriptionService';
import { TaskAppLaunchService } from '../services/taskAppLaunchService';
import {
  CAPTURE_SOURCES,
  TASK_DATE_PRECISION,
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
const reminderPolicyEngine = new ReminderPolicyEngine({ avatarCoach });
const operationalReportService = new OperationalReportService();
const assistantBriefService = new AssistantBriefService({ reportService: operationalReportService });
const filterCatalog = new TaskFilterCatalog();
const filterService = new TaskFilterService();
const visibilityPlanner = new TaskVisibilityPlanner(filterService);
const insightAnalyzer = new BacklogInsightAnalyzer();
const taskHealthAnalyzer = new TaskHealthAnalyzer();
const dailyRecoveryPlanner = new DailyRecoveryPlanner({
  filterService,
  healthAnalyzer: taskHealthAnalyzer,
});
const backlogRescuePlanner = new BacklogRescuePlanner({
  healthAnalyzer: taskHealthAnalyzer,
});
const navigationCatalog = new NavigationCatalog();
const contextPresenter = new TaskContextPresenter();
const captureInterpreter = new QuickCaptureInterpreter();
const taskAppLaunchService = new TaskAppLaunchService();
const reminderScheduleService = new ReminderScheduleService();
const subscriptionService = new SubscriptionService();
const reminderCopywriter = new ReminderPersonalityCopywriter();

const tasks = ref([]);
const analytics = ref(repository.normalizeAnalytics());
const preferences = ref(repository.normalizePreferences());
const activeFilterId = ref(FILTER_IDS.TODAY);
const searchQuery = ref('');
const mounted = ref(false);
const avatarSnippet = ref(null);
const uiFeedback = ref(null);
const editingTaskId = ref('');
const upgradePrompt = ref(null);
const addTaskRef = ref(null);
const calendarRef = ref(null);
const searchInputRef = ref(null);
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
const PRE_REMINDER_OPTIONS = Object.freeze([
  { value: 0, label: 'Sin aviso previo' },
  { value: 5, label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
]);
const UPGRADE_COPY = Object.freeze({
  [ENTITLEMENT_KEYS.ADVANCED_DASHBOARD]: {
    title: 'ListEA Pro desbloquea panel avanzado',
    message: 'Los rangos personalizados y la lectura semanal viven solo en tu dispositivo y forman parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PREMIUM_CALENDAR]: {
    title: 'ListEA Pro desbloquea el calendario profesional',
    message: 'Vista mensual, carga diaria y seguimiento visual viven solo en tu dispositivo y forman parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PDF_EXPORT]: {
    title: 'ListEA Pro desbloquea el PDF local',
    message: 'El reporte PDF se genera localmente y esta incluido en ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.PREMIUM_INSIGHTS]: {
    title: 'ListEA Pro desbloquea el centro de control',
    message: 'Compromisos en riesgo, respuestas por enviar y lectura operativa semanal forman parte de ListEA Pro.',
  },
  [ENTITLEMENT_KEYS.ADVANCED_REMINDERS]: {
    title: 'ListEA Pro desbloquea recordatorios avanzados',
    message: 'ListEA Pro suma avisos previos, alertas de riesgo y recordatorios con acciones fuera de la app.',
  },
  [ENTITLEMENT_KEYS.MOBILE_ASSISTANT]: {
    title: 'ListEA Pro desbloquea el asistente movil',
    message: 'Tu telefono te recuerda, te reubica y te deja actuar sin salir del flujo profesional.',
  },
  [ENTITLEMENT_KEYS.WEEKLY_BRIEFING]: {
    title: 'ListEA Pro desbloquea la lectura operativa semanal',
    message: 'Cada semana recibes un resumen local con compromisos en riesgo, respuestas pendientes y bloqueos viejos.',
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
  [ENTITLEMENT_KEYS.VOICE_CAPTURE]: {
    title: 'ListEA Pro desbloquea voz a tarea',
    message: 'Hablas, ListEA estructura la tarea localmente y la deja lista para editar o ejecutar desde tu telefono.',
  },
});
const FOLLOW_UP_TASK_ACTIONS = Object.freeze([
  { id: 'follow-up-tomorrow', label: 'Manana', tone: 'ghost' },
  { id: 'follow-up-friday', label: 'Viernes', tone: 'ghost' },
  { id: 'follow-up-next-week', label: 'Prox. semana', tone: 'ghost' },
  { id: 'follow-up-resolved', label: 'Resuelto', tone: 'primary' },
]);
const calendarPreviewDays = Object.freeze(Array.from({ length: 35 }, (_, index) => index + 1));

let avatarSnippetTimerId = 0;
let avatarSnippetHideTimerId = 0;
let uiFeedbackTimerId = 0;
let taskFocusTimerId = 0;

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

function resolveTaskActionPrecision(task) {
  const dateField = resolveTaskActionField(task);
  return dateField === 'followUpAt'
    ? task.followUpAtPrecision
    : task.dueAtPrecision;
}

function buildTaskSchedule(value = '', precision = '') {
  return {
    value,
    precision,
  };
}

function buildRelativeTaskSchedule(task, moveDate) {
  const dateField = resolveTaskActionField(task);
  const originalValue = task[dateField] || task.getRelevantDate();
  const originalDate = parseDate(originalValue) ?? new Date();
  const keepTime = resolveTaskActionPrecision(task) === TASK_DATE_PRECISION.DATETIME;
  const nextDate = new Date(originalDate);

  moveDate(nextDate);

  if (keepTime) {
    return buildTaskSchedule(nextDate.toISOString(), TASK_DATE_PRECISION.DATETIME);
  }

  nextDate.setHours(23, 59, 0, 0);
  return buildTaskSchedule(nextDate.toISOString(), TASK_DATE_PRECISION.DATE);
}

function buildTomorrowSchedule(task) {
  return buildRelativeTaskSchedule(task, nextDate => {
    nextDate.setDate(nextDate.getDate() + 1);
  });
}

function buildNextWeekdaySchedule(task, targetWeekday) {
  return buildRelativeTaskSchedule(task, nextDate => {
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() !== targetWeekday);
  });
}

function buildNextWeekSchedule(task) {
  return buildNextWeekdaySchedule(task, 1);
}

function buildSnoozeDate(task, minutes = 10) {
  const currentAnchor = parseDate(task[resolveTaskActionField(task)] || task.getRelevantDate());
  const nextDate = currentAnchor && currentAnchor.getTime() > Date.now()
    ? new Date(currentAnchor)
    : new Date();
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return buildTaskSchedule(nextDate.toISOString(), TASK_DATE_PRECISION.DATETIME);
}

function resolveTaskWorkspaceView(task) {
  if (!task) return 'today';
  if (task.isCompleted?.() || task.status === TASK_STATUS.COMPLETED) {
    return 'today';
  }
  if (task.status === TASK_STATUS.WAITING || task.status === TASK_STATUS.BLOCKED || task.followUpAt) {
    return 'follow-up';
  }

  const preferredFilter = visibilityPlanner.getPreferredFilter(task, {
    referenceDate: new Date(),
  });
  return preferredFilter ? 'today' : 'calendar';
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

function addTask(payload, { message = '', action = null } = {}) {
  const task = taskFactory.create(payload);
  if (!task.title) return null;

  tasks.value = [task, ...tasks.value];
  showUiFeedback(message || `Tarea "${task.title}" guardada.`, 'success', action);
  revealTask(task);
  return task;
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
    dueAtPrecision: interpreted.dueAtPrecision,
    followUpAt: interpreted.followUpAt,
    followUpAtPrecision: interpreted.followUpAtPrecision,
    priority: interpreted.priority,
    status: interpreted.status,
    tags: interpreted.tags,
    effortMinutes: interpreted.effortMinutes || 20,
    source: metadata.source || CAPTURE_SOURCES.SHARE,
    capturedAt: new Date().toISOString(),
    needsTriage: false,
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

  await reminderScheduleService.cancelByIds(reminderPolicyEngine.buildKnownReminderIds(removedTasks));
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

function setAssistantPreferences(patch) {
  preferences.value.assistant = new MobileAssistantPreferences({
    ...preferences.value.assistant,
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

function buildEffectiveAssistantPreferences() {
  if (hasFeature(ENTITLEMENT_KEYS.MOBILE_ASSISTANT) || hasFeature(ENTITLEMENT_KEYS.WEEKLY_BRIEFING)) {
    return new MobileAssistantPreferences(preferences.value.assistant);
  }

  return new MobileAssistantPreferences({
    ...preferences.value.assistant,
    assistantEnabled: false,
    preReminderOffset: 0,
    directOpenCompatibleApp: false,
    briefHistory: preferences.value.assistant?.briefHistory ?? [],
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
  const nextAssistantPreferences = (hasEntitlement(nextLicense, ENTITLEMENT_KEYS.MOBILE_ASSISTANT)
    || hasEntitlement(nextLicense, ENTITLEMENT_KEYS.WEEKLY_BRIEFING))
    ? new MobileAssistantPreferences(preferences.value.assistant)
    : new MobileAssistantPreferences({
      ...preferences.value.assistant,
      assistantEnabled: false,
      preReminderOffset: 0,
      directOpenCompatibleApp: false,
      briefHistory: preferences.value.assistant?.briefHistory ?? [],
    });

  preferences.value = {
    ...preferences.value,
    license: nextLicense,
    colorPalette: nextHasPremiumThemes ? preferences.value.colorPalette : COLOR_PALETTES.OCEAN,
    avatar: nextAvatarPreferences,
    assistant: nextAssistantPreferences,
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

async function subscribeToPro() {
  const nextLicense = await subscriptionService.purchaseMonthly(preferences.value.license);
  applyLicenseState(
    nextLicense,
    'ListEA Pro mensual quedo activo en este dispositivo.',
  );
  dismissUpgradePrompt();
}

async function restoreSubscription() {
  const nextLicense = await subscriptionService.restore(preferences.value.license);
  if (nextLicense?.licenseTier === LICENSE_TIERS.PRO) {
    applyLicenseState(
      nextLicense,
      'ListEA Pro mensual se restauro en este dispositivo.',
    );
    return;
  }

  showUiFeedback('Todavia no hay una suscripcion local para restaurar en este dispositivo.', 'error');
}

async function revertToFreePlan() {
  const nextLicense = await subscriptionService.downgrade(preferences.value.license);
  applyLicenseState(
    nextLicense,
    'ListEA volvio al plan Free sin tocar tus tareas ni tu historial local.',
  );
}

function setAssistantEnabled(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.MOBILE_ASSISTANT) && value) {
    requestUpgrade(ENTITLEMENT_KEYS.MOBILE_ASSISTANT);
    return;
  }

  setAssistantPreferences({ assistantEnabled: value });
}

function setPreReminderOffset(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.ADVANCED_REMINDERS) && Number(value) > 0) {
    requestUpgrade(ENTITLEMENT_KEYS.ADVANCED_REMINDERS);
    return;
  }

  setAssistantPreferences({ preReminderOffset: Number(value) });
}

function setDirectOpenCompatibleApp(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.MOBILE_ASSISTANT) && value) {
    requestUpgrade(ENTITLEMENT_KEYS.MOBILE_ASSISTANT);
    return;
  }

  setAssistantPreferences({ directOpenCompatibleApp: value });
}

function setWeeklyBriefDay(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.WEEKLY_BRIEFING)) {
    requestUpgrade(ENTITLEMENT_KEYS.WEEKLY_BRIEFING);
    return;
  }

  setAssistantPreferences({ weeklyBriefDay: Number(value) });
}

function setWeeklyBriefTime(value) {
  if (!hasFeature(ENTITLEMENT_KEYS.WEEKLY_BRIEFING)) {
    requestUpgrade(ENTITLEMENT_KEYS.WEEKLY_BRIEFING);
    return;
  }

  setAssistantPreferences({ weeklyBriefTime: value });
}

function setReminderPersonality(value) {
  setAssistantPreferences({ reminderPersonality: value });
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

function focusSearchField() {
  const field = searchInputRef.value;
  if (!field) return;

  field.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
  field.focus({ preventScroll: true });
}

function openComposerFromShortcut() {
  addTaskRef.value?.openComposer?.();
}

function openComposerFromCalendar(draft = {}) {
  addTaskRef.value?.openComposerWithDraft?.(draft);
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

function clearUiFeedbackTimer() {
  if (!uiFeedbackTimerId || typeof window === 'undefined') return;
  window.clearTimeout(uiFeedbackTimerId);
  uiFeedbackTimerId = 0;
}

function clearTaskFocusTimer() {
  if (!taskFocusTimerId || typeof window === 'undefined') return;
  window.clearTimeout(taskFocusTimerId);
  taskFocusTimerId = 0;
}

function dismissUiFeedback() {
  clearUiFeedbackTimer();
  uiFeedback.value = null;
}

function showUiFeedback(message, tone = 'success', action = null) {
  uiFeedback.value = { message, tone, action };
  clearUiFeedbackTimer();

  if (typeof window === 'undefined') return;
  uiFeedbackTimerId = window.setTimeout(() => {
    uiFeedbackTimerId = 0;
    uiFeedback.value = null;
  }, 4200);
}

function focusTaskCard(taskId, { edit = false, attempt = 0 } = {}) {
  if (typeof document === 'undefined' || !taskId) return;

  const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
  if (!taskCard) {
    if (attempt >= 4 || typeof window === 'undefined') return;
    taskFocusTimerId = window.setTimeout(() => {
      taskFocusTimerId = 0;
      focusTaskCard(taskId, {
        edit,
        attempt: attempt + 1,
      });
    }, 140);
    return;
  }

  taskCard.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  if (edit && typeof window !== 'undefined') {
    editingTaskId.value = taskId;
    window.setTimeout(() => {
      if (editingTaskId.value === taskId) {
        editingTaskId.value = '';
      }
    }, 260);
  }
}

function scheduleTaskFocus(taskId, { edit = false } = {}) {
  if (!taskId || typeof window === 'undefined') return;
  clearTaskFocusTimer();
  taskFocusTimerId = window.setTimeout(async () => {
    taskFocusTimerId = 0;
    await nextTick();
    focusTaskCard(taskId, { edit });
  }, 140);
}

function handleUiFeedbackAction() {
  const action = uiFeedback.value?.action;
  if (!action) return;

  if (action.id === 'edit-task') {
    focusTaskById(action.taskId, action.preferredView, {
      edit: true,
      showFeedback: false,
    });
  }

  dismissUiFeedback();
}

function revealTask(task) {
  searchQuery.value = '';
  const targetView = resolveTaskWorkspaceView(task);

  if (targetView === 'follow-up') {
    emit('navigate', targetView);
    scheduleTaskFocus(task.id);
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
    scheduleTaskFocus(task.id);
    return;
  }

  emit('navigate', 'calendar');
  scheduleTaskFocus(task.id);
}

function focusTaskById(taskId, preferredView = '', { edit = false, showFeedback = true } = {}) {
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
  scheduleTaskFocus(taskId, { edit });
  if (showFeedback) {
    showUiFeedback(`Abriendo "${task.title}".`, 'info');
  }
}

function handleVoiceCaptured(result = {}) {
  const draft = result?.draft ?? null;
  if (!draft?.title) {
    showUiFeedback('No pudimos guardar una tarea clara desde la voz.', 'error');
    return;
  }

  const task = addTask(draft, {
    message: `Tarea "${draft.title}" guardada desde voz.`,
  });
  if (!task) return;

  showUiFeedback(
    `Tarea "${task.title}" guardada desde voz.`,
    'success',
    {
      id: 'edit-task',
      label: 'Editar detalles',
      taskId: task.id,
      preferredView: resolveTaskWorkspaceView(task),
    },
  );
}

function updateTaskWithDate(task, nextDate, feedbackMessage) {
  if (!task || !nextDate?.value) return;

  const dateField = resolveTaskActionField(task);
  const precisionField = dateField === 'followUpAt' ? 'followUpAtPrecision' : 'dueAtPrecision';
  const patch = {
    [dateField]: nextDate.value,
    [precisionField]: nextDate.precision,
    reminderSent: false,
    avatarSnippetShownAt: '',
    needsTriage: false,
    postponedCount: Number(task.postponedCount ?? 0) + 1,
  };

  if (dateField === 'followUpAt' && task.status === TASK_STATUS.ACTIVE) {
    patch.status = TASK_STATUS.WAITING;
  }

  task.applyPatch(patch);
  tasks.value = [...tasks.value];
  showUiFeedback(feedbackMessage, 'success');
}

function resolveFollowUp(taskId) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  task.applyPatch({
    status: TASK_STATUS.ACTIVE,
    followUpAt: '',
    followUpAtPrecision: '',
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

  if (actionId === 'follow-up-tomorrow') {
    updateTaskWithDate(task, buildTomorrowSchedule(task), 'Seguimiento reagendado para manana.');
    return;
  }

  if (actionId === 'follow-up-friday') {
    updateTaskWithDate(task, buildNextWeekdaySchedule(task, 5), 'Seguimiento movido al viernes.');
    return;
  }

  if (actionId === 'follow-up-next-week') {
    updateTaskWithDate(task, buildNextWeekSchedule(task), 'Seguimiento movido a la proxima semana.');
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
  const assistantPreferences = buildEffectiveAssistantPreferences();
  const shownAt = new Date().toISOString();
  const primaryAction = resolvePrimaryLaunchSuggestion(task);
  const baseSnippet = avatarCoach.buildTaskSnippet(task, effectiveAvatarPreferences, new Date(shownAt));
  const personalizedSnippet = reminderCopywriter.buildSnippet(
    task,
    baseSnippet,
    assistantPreferences.reminderPersonality,
  );
  task.applyPatch({ avatarSnippetShownAt: shownAt });
  avatarSnippet.value = {
    ...personalizedSnippet,
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

function showReminderBubble(taskId, { markSent = true } = {}) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task || task.isCompleted() || avatarSnippet.value?.taskId === taskId) return;

  if (markSent) {
    task.applyPatch({ reminderSent: true });
  }
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

  updateTaskWithDate(task, buildTomorrowSchedule(task), 'Aviso movido a manana.');
  dismissAvatarSnippet({ reschedule: true });
}

async function openTaskLaunch(task, suggestionId = '', {
  showPremiumHint = true,
  userInitiated = false,
} = {}) {
  if (!task) {
    return { completed: false, mode: 'none', suggestion: null };
  }

  const premiumEnabled = hasFeature(ENTITLEMENT_KEYS.SMART_APP_LAUNCH);
  const result = await taskAppLaunchService.open(task, {
    suggestionId,
    premiumEnabled,
    userInitiated,
  });

  if (result.completed && result.suggestion) {
    analytics.value.recordLaunched(task, {
      ...result.suggestion,
      mode: result.mode,
    });
  }

  if (result.completed && ['native', 'scheme'].includes(result.mode)) {
    showUiFeedback(`Abriendo ${result.suggestion?.label ?? 'app'} para "${task.title}".`, 'info');
    return result;
  }

  if (result.completed && ['fallback', 'web'].includes(result.mode)) {
    if (!premiumEnabled && !userInitiated && result.suggestion?.supportsNativeLaunch() && showPremiumHint) {
      requestUpgrade(ENTITLEMENT_KEYS.SMART_APP_LAUNCH);
    }
    return result;
  }

  if (!premiumEnabled && !userInitiated && result.suggestion?.supportsNativeLaunch()) {
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

  const suggestions = taskAppLaunchService.resolve(task);
  const canDirectOpen = effectiveAssistantPreferences.value.directOpenCompatibleApp
    && suggestions.length === 1;

  if (canDirectOpen) {
    const result = await openTaskLaunch(task, suggestions[0]?.id ?? '', {
      showPremiumHint: false,
      userInitiated: true,
    });
    if (result.completed) {
      dismissAvatarSnippet({ reschedule: false });
      return;
    }
  }

  openReminderTask(taskId, preferredView);
}

async function handleTaskLaunchRequest({ taskId, suggestionId }) {
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;

  const result = await openTaskLaunch(task, suggestionId, {
    userInitiated: true,
  });
  if (!result.completed) {
    showUiFeedback(`No fue posible abrir una app para "${task.title}".`, 'error');
  }
}

function openReminderTask(taskId, preferredView = '') {
  dismissAvatarSnippet({ reschedule: false });
  focusTaskById(taskId, preferredView);
}

function handleReminderNotificationReceived(notification) {
  const preferredView = notification?.extra?.preferredView ?? '';
  const lane = notification?.extra?.lane ?? REMINDER_LANES.BASIC;
  const reminderKind = notification?.extra?.reminderKind ?? '';
  const taskId = notification?.extra?.taskId;
  if (!taskId && preferredView === 'dashboard' && reminderKind === 'weekly-brief') {
    showUiFeedback('Tu lectura operativa semanal ya esta lista en el panel.', 'info');
    return;
  }
  if (!taskId) return;
  showReminderBubble(taskId, {
    markSent: lane !== REMINDER_LANES.PREP,
  });
}

const reminderActionRouter = new ReminderActionRouter({
  onComplete: ({ taskId }) => completeReminderTask(taskId),
  onSnooze: ({ taskId }) => snoozeReminderTask(taskId, 10),
  onMoveTomorrow: ({ taskId }) => moveReminderTaskToTomorrow(taskId),
  onOpenTask: ({ taskId, preferredView }) => {
    openReminderPrimaryAction(taskId, preferredView);
  },
  onOpenView: ({ preferredView, reminderKind }) => {
    if (preferredView) {
      emit('navigate', preferredView);
      if (reminderKind === 'weekly-brief') {
        showUiFeedback('Abriendo tu lectura operativa semanal.', 'info');
      }
    }
  },
});

function handleReminderNotificationAction(notificationAction) {
  reminderActionRouter.route(new ReminderActionContext({
    actionId: notificationAction?.actionId ?? REMINDER_ACTION_IDS.OPEN,
    taskId: notificationAction?.notification?.extra?.taskId,
    preferredView: notificationAction?.notification?.extra?.preferredView ?? '',
    lane: notificationAction?.notification?.extra?.lane ?? '',
    reminderKind: notificationAction?.notification?.extra?.reminderKind ?? '',
  }));
}

async function enableNotificationsFlow() {
  const permission = await enableReminders();
  preferences.value.reminderPermission = permission;
  if (permission !== 'granted') {
    preferences.value.notificationsEnabled = false;
    return;
  }

  preferences.value.notificationsEnabled = true;

  const exactPermission = await getExactAlarmPermission();
  preferences.value.exactAlarmPermission = exactPermission;

  if (exactPermission !== 'granted') {
    preferences.value.exactAlarmPermission = await enableExactReminders();
  }
}

async function disableNotificationsFlow() {
  preferences.value.notificationsEnabled = false;
  await clearAllReminderTimers();
  await reminderScheduleService.cancelByIds(reminderPolicyEngine.buildKnownReminderIds(tasks.value));
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

function markReminderSent(payload) {
  const taskId = typeof payload === 'string'
    ? payload
    : (payload?.taskId || payload?.id || '');
  const lane = typeof payload === 'object' ? payload?.lane : REMINDER_LANES.BASIC;
  if (!taskId || lane === REMINDER_LANES.PREP || lane === REMINDER_LANES.BRIEFING) return;
  const task = tasks.value.find(item => item.id === taskId);
  if (!task) return;
  task.applyPatch({ reminderSent: true });
}

function syncBriefHistory(report) {
  if (!report?.weekKey) return;

  const currentAssistant = new MobileAssistantPreferences(preferences.value.assistant);
  const currentHistory = currentAssistant.briefHistory;
  const existing = currentHistory.find(item => item.weekKey === report.weekKey);
  const nextEntry = {
    weekKey: report.weekKey,
    createdAt: existing?.createdAt || report.createdAt,
    summary: report.summary,
    highlights: report.highlights,
  };

  const existingSignature = existing ? JSON.stringify({
    summary: existing.summary,
    highlights: existing.highlights,
  }) : '';
  const nextSignature = JSON.stringify({
    summary: nextEntry.summary,
    highlights: nextEntry.highlights,
  });

  if (existingSignature === nextSignature) {
    return;
  }

  const nextHistory = currentHistory.filter(item => item.weekKey !== report.weekKey);
  nextHistory.push(nextEntry);
  preferences.value.assistant = currentAssistant.withBriefHistory(nextHistory);
}

async function syncReminders() {
  await clearAllReminderTimers();
  await reminderScheduleService.cancelByIds(reminderPolicyEngine.buildKnownReminderIds(tasks.value));

  const referenceDate = new Date();
  const avatarPreferences = buildEffectiveAvatarPreferences();
  const assistantPreferences = buildEffectiveAssistantPreferences();
  const entitlements = preferences.value.license?.entitlements ?? {};
  const weeklyBrief = assistantBriefService.buildWeeklyBrief(tasks.value, analytics.value, {
    referenceDate,
    assistantPreferences,
    entitlements,
  });
  syncBriefHistory(weeklyBrief.report);

  if (!preferences.value.notificationsEnabled) {
    return;
  }

  const taskPlans = reminderPolicyEngine.buildTaskPlans(tasks.value, {
    referenceDate,
    avatarPreferences,
    assistantPreferences,
    entitlements,
  });
  const reminderPlans = weeklyBrief.plan
    ? [...taskPlans, weeklyBrief.plan]
    : taskPlans;

  await reminderScheduleService.schedulePlans(reminderPlans, markReminderSent);
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

function handleLaunchIntent(intent) {
  if (!intent?.nonce) return;

  if (intent.type === LAUNCH_INTENT_TYPES.CAPTURE) {
    captureTaskFromExternalSource(intent.payload?.text, {
      project: intent.payload?.project,
      area: intent.payload?.area,
      source: intent.payload?.source || CAPTURE_SOURCES.SHARE,
    });
    if (intent.view) {
      emit('navigate', intent.view);
    }
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
const effectiveAssistantPreferences = computed(() => buildEffectiveAssistantPreferences());
const showTaskWorkspace = computed(() => ['today', 'follow-up', 'calendar'].includes(resolvedView.value));
const openTasks = computed(() => sortTasksByRelevance(tasks.value.filter(task => !task.isCompleted())));
const focusTasks = computed(() =>
  sortTasksByRelevance(openTasks.value.filter(task => resolveTaskWorkspaceView(task) === 'today')),
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
    .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt)),
);
const timeFilters = computed(() => {
  const referenceDate = new Date();
  return filterCatalog.getPrimaryFilters()
    .filter(filter => [
      FILTER_IDS.TODAY,
      FILTER_IDS.THIS_WEEK,
      FILTER_IDS.OVERDUE,
      FILTER_IDS.NO_DATE,
      FILTER_IDS.COMPLETED,
    ].includes(filter.id))
    .map(filter => ({
      ...filter,
      count: filter.id === FILTER_IDS.COMPLETED
        ? completedTasks.value.length
        : filterService.apply(focusTasks.value, filter.id, { referenceDate }).length,
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
const selectedWorkspaceTasks = computed(() => {
  if (selectedTimeFilter.value?.id === FILTER_IDS.COMPLETED) {
    return applySearch(completedTasks.value);
  }

  return filteredTasks.value;
});
const calendarSourceTasks = computed(() => applySearch(tasks.value));
const workspaceEmptyMessage = computed(() => {
  if (selectedTimeFilter.value?.id === FILTER_IDS.OVERDUE) {
    return 'No hay tareas vencidas.';
  }

  if (selectedTimeFilter.value?.id === FILTER_IDS.NO_DATE) {
    return 'No hay tareas sin fecha.';
  }

  if (selectedTimeFilter.value?.id === FILTER_IDS.THIS_WEEK) {
    return 'No hay tareas para esta semana.';
  }

  if (selectedTimeFilter.value?.id === FILTER_IDS.COMPLETED) {
    return 'Todavia no hay tareas completadas.';
  }

  return 'No hay tareas dentro de esta ventana de tiempo.';
});
const backlogInsights = computed(() => insightAnalyzer.analyze(openTasks.value, {
  referenceDate: new Date(),
}));
const visibleBacklogInsights = computed(() =>
  hasFeature(ENTITLEMENT_KEYS.PREMIUM_INSIGHTS) ? backlogInsights.value : [],
);
const dailyRecovery = computed(() => dailyRecoveryPlanner.build(openTasks.value, {
  referenceDate: new Date(),
}));
const backlogRescue = computed(() => backlogRescuePlanner.build(openTasks.value, {
  referenceDate: new Date(),
}));
const todayHealthSummary = computed(() => taskHealthAnalyzer.summarize(openTasks.value, {
  referenceDate: new Date(),
}));
const showOperabilityCards = computed(() =>
  resolvedView.value === 'today'
  && selectedTimeFilter.value?.id !== FILTER_IDS.COMPLETED
  && (dailyRecovery.value.shouldShow || backlogRescue.value.shouldShow),
);
const operabilityPanel = computed(() => {
  const recovery = dailyRecovery.value;
  const rescue = backlogRescue.value;
  const rescueItems = rescue.items ?? [];

  return {
    tone: recovery.isRecoveryMode ? 'warn' : 'steady',
    title: recovery.shouldShow ? recovery.headline : 'Enfoque del dia',
    message: recovery.shouldShow
      ? recovery.message
      : 'ListEA encontro tareas que conviene ajustar antes de que sigan enfriandose.',
    stateLabel: recovery.isRecoveryMode ? 'Activo' : 'En foco',
    priorityTasks: recovery.priorityTasks ?? [],
    quickWins: recovery.quickWins ?? [],
    cleanupMessage: recovery.cleanupMessage ?? '',
    rescueItems,
    rescueLabel: rescueItems.length
      ? `${rescueItems.length} ajuste${rescueItems.length === 1 ? '' : 's'} sugerido${rescueItems.length === 1 ? '' : 's'}`
      : 'Sin rescates',
  };
});
const summary = computed(() => ({
  pending: openTasks.value.length,
  overdue: openTasks.value.filter(task => task.dueAt && new Date(task.dueAt) < new Date()).length,
  today: filterService.apply(focusTasks.value, FILTER_IDS.TODAY, { referenceDate: new Date() }).length,
  followUp: followUpTasks.value.length,
  blocked: openTasks.value.filter(task => task.status === TASK_STATUS.BLOCKED).length,
  withoutDate: openTasks.value.filter(task => !task.getRelevantDate()).length,
}));
const heroCopy = computed(() => {
  if (resolvedView.value === 'follow-up') {
    return {
      eyebrow: 'Seguimiento',
      title: 'Nada importante se queda sin seguimiento.',
      description: 'Esperas, bloqueos y promesas en un solo lugar.',
    };
  }

  if (resolvedView.value === 'calendar') {
    return {
      eyebrow: 'Calendario',
      title: 'Planifica semana y mes sin perder seguimiento.',
      description: 'Fechas objetivo, follow-ups y cierres en un calendario privado.',
    };
  }

  return {
    eyebrow: 'Hoy',
    title: 'Haz lo que toca hoy con menos friccion.',
    description: 'Prioriza, ejecuta y sigue el hilo sin salir del dispositivo.',
  };
});
const summaryCards = computed(() => {
  if (resolvedView.value === 'follow-up') {
    return [
      { id: 'followUp', label: 'Seguimientos', value: summary.value.followUp },
      { id: 'blocked', label: 'Bloqueadas', value: summary.value.blocked },
      { id: 'overdue', label: 'Vencidas', value: summary.value.overdue },
    ];
  }

  if (resolvedView.value === 'calendar') {
    return [
      { id: 'pending', label: 'Abiertas', value: summary.value.pending },
      { id: 'followUp', label: 'Seguimientos', value: summary.value.followUp },
      { id: 'withoutDate', label: 'Sin fecha', value: summary.value.withoutDate },
    ];
  }

  return [
    { id: 'pending', label: 'Abiertas', value: summary.value.pending },
    { id: 'followUp', label: 'Seguimiento', value: summary.value.followUp },
    { id: 'withoutDate', label: 'Sin fecha', value: summary.value.withoutDate },
  ];
});
const activePaletteId = computed(() => hasFeature(ENTITLEMENT_KEYS.PREMIUM_THEMES)
  ? (preferences.value.colorPalette ?? COLOR_PALETTES.OCEAN)
  : COLOR_PALETTES.OCEAN);
const currentOperationalBrief = computed(() => operationalReportService.build(tasks.value, analytics.value, {
  referenceDate: new Date(),
  history: effectiveAssistantPreferences.value.briefHistory,
}));
const subscriptionPlanLabel = computed(() => `${LISTEA_PRO_MONTHLY_PLAN.label} · ${LISTEA_PRO_MONTHLY_PLAN.priceLabel}`);
const licenseSummary = computed(() => preferences.value.license?.licenseTier === LICENSE_TIERS.PRO
  ? `${LISTEA_PRO_MONTHLY_PLAN.label} activo en este dispositivo.`
  : 'ListEA Free activo. Tus tareas siguen siendo privadas y locales.');
const isProActive = computed(() => preferences.value.license?.licenseTier === LICENSE_TIERS.PRO);
const viewQuickActions = computed(() => {
  if (resolvedView.value === 'follow-up') {
    return [
      { id: 'search', label: 'Buscar' },
      { id: 'open-calendar', label: 'Calendario' },
      { id: 'open-dashboard', label: 'Panel' },
    ];
  }

  if (resolvedView.value === 'calendar') {
    if (!hasFeature(ENTITLEMENT_KEYS.PREMIUM_CALENDAR)) {
      return [
        { id: 'upgrade-calendar', label: 'ListEA Pro' },
        { id: 'search', label: 'Buscar' },
        { id: 'open-dashboard', label: 'Panel' },
      ];
    }

    return [
      { id: 'calendar-today', label: 'Hoy' },
      { id: 'search', label: 'Buscar' },
      { id: 'open-dashboard', label: 'Panel' },
    ];
  }

  return [
    { id: 'new-task', label: 'Nueva' },
    { id: 'show-overdue', label: 'Vencidas' },
    { id: 'search', label: 'Buscar' },
  ];
});

function formatTaskCount(value) {
  return `${value} ${value === 1 ? 'tarea' : 'tareas'}`;
}

function handleQuickAction(actionId) {
  if (actionId === 'new-task') {
    openComposerFromShortcut();
    return;
  }

  if (actionId === 'calendar-today') {
    if (!hasFeature(ENTITLEMENT_KEYS.PREMIUM_CALENDAR)) {
      requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_CALENDAR);
      return;
    }

    calendarRef.value?.goToToday?.();
    return;
  }

  if (actionId === 'search') {
    focusSearchField();
    return;
  }

  if (actionId === 'show-overdue') {
    activeFilterId.value = FILTER_IDS.OVERDUE;
    scrollToFocusContent();
    return;
  }

  if (actionId === 'open-calendar') {
    emit('navigate', 'calendar');
    return;
  }

  if (actionId === 'upgrade-calendar') {
    requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_CALENDAR);
    return;
  }

  if (actionId === 'open-dashboard') {
    emit('navigate', 'dashboard');
  }
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
  preferences.value.license = await subscriptionService.sync(preferences.value.license);
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
  clearTaskFocusTimer();
});
</script>

<template>
  <section class="tasksShell">
    <section v-if="showTaskWorkspace" class="topBar">
      <div class="topCopy">
        <p class="eyebrow">{{ heroCopy.eyebrow }}</p>
        <h1>{{ heroCopy.title }}</h1>
        <p class="panelText topHint">{{ heroCopy.description }}</p>
        <div class="quickActionRow">
          <button
            v-for="action in viewQuickActions"
            :key="action.id"
            type="button"
            class="quickActionButton"
            @click="handleQuickAction(action.id)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      <div class="topStats">
        <article v-for="card in summaryCards" :key="card.id" class="statCard">
          <strong>{{ card.value }}</strong>
          <span>{{ card.label }}</span>
        </article>
      </div>
    </section>

    <AddTask
      v-if="showTaskWorkspace"
      ref="addTaskRef"
      :voice-capture-enabled="hasFeature(ENTITLEMENT_KEYS.VOICE_CAPTURE)"
      @add="addTask"
      @voice-add="handleVoiceCaptured"
      @request-upgrade="requestUpgrade"
    />

    <transition name="timeSwap">
      <div
        v-if="uiFeedback && showTaskWorkspace"
        class="feedbackBanner"
        :data-tone="uiFeedback.tone"
        aria-live="polite"
        role="status"
      >
        <p>{{ uiFeedback.message }}</p>
        <div class="feedbackActions">
          <button
            v-if="uiFeedback.action"
            type="button"
            class="ghostButton"
            @click="handleUiFeedbackAction"
          >
            {{ uiFeedback.action.label }}
          </button>
          <button type="button" class="ghostButton feedbackClose" @click="dismissUiFeedback">
            Cerrar
          </button>
        </div>
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
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="search"
          placeholder="Buscar tarea, proyecto o tag"
        />
      </label>
    </section>

    <section v-if="resolvedView === 'today'" class="focusBoardGrid">
      <article ref="focusListPanelRef" class="panelCard focusListPanel">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Trabajo activo</p>
            <h3>{{ selectedTimeFilter.label }}</h3>
          </div>
          <div class="headerActions">
            <button type="button" class="ghostButton" @click="resetTaskWorkspaceView">Reiniciar vista</button>
            <span class="laneCount">{{ formatTaskCount(selectedWorkspaceTasks.length) }}</span>
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

        <div v-if="showOperabilityCards" class="operabilityGrid">
          <article class="assistantBoard" :data-tone="operabilityPanel.tone">
            <div class="assistantBoardHead">
              <div>
                <p class="eyebrow">Asistente del dia</p>
                <strong>{{ operabilityPanel.title }}</strong>
              </div>
              <span class="assistantStatePill" :data-tone="operabilityPanel.tone === 'warn' ? 'warn' : 'good'">
                {{ operabilityPanel.stateLabel }}
              </span>
            </div>

            <p class="panelText">{{ operabilityPanel.message }}</p>

            <div class="assistantSummaryRow">
              <span class="assistantMetaChip">Riesgo: {{ todayHealthSummary['at-risk'] }}</span>
              <span class="assistantMetaChip">Estancadas: {{ todayHealthSummary.stalled }}</span>
              <span class="assistantMetaChip">Vencidas: {{ todayHealthSummary.overdue }}</span>
              <span v-if="operabilityPanel.rescueItems.length" class="assistantMetaChip">{{ operabilityPanel.rescueLabel }}</span>
            </div>

            <section v-if="operabilityPanel.priorityTasks.length" class="assistantSection">
              <div>
                <p class="assistantSectionEyebrow">Prioridades</p>
                <strong class="assistantSectionTitle">Lo primero que conviene mover</strong>
              </div>

              <div class="assistantTaskRow">
                <button
                  v-for="item in operabilityPanel.priorityTasks"
                  :key="item.id"
                  type="button"
                  class="assistantTaskButton"
                  @click="focusTaskById(item.id, 'today', { showFeedback: false })"
                >
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.badge }}</span>
                </button>
              </div>
            </section>

            <section v-if="operabilityPanel.rescueItems.length" class="assistantSection">
              <div>
                <p class="assistantSectionEyebrow">Ajustes sugeridos</p>
                <strong class="assistantSectionTitle">Backlog rescue dentro del mismo flujo</strong>
              </div>

              <div class="rescueList">
                <button
                  v-for="item in operabilityPanel.rescueItems"
                  :key="item.id"
                  type="button"
                  class="rescueActionCard"
                  @click="focusTaskById(item.taskId, 'today', { edit: ['split', 'quick-step'].includes(item.actionId), showFeedback: false })"
                >
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.actionLabel }}</span>
                  <small>{{ item.reason }}</small>
                </button>
              </div>
            </section>

            <section
              v-if="operabilityPanel.quickWins.length || operabilityPanel.cleanupMessage"
              class="assistantSection assistantSectionSoft"
            >
              <div>
                <p class="assistantSectionEyebrow">Limpieza rapida</p>
                <strong class="assistantSectionTitle">Pequenas decisiones que despejan el dia</strong>
              </div>

              <div class="assistantMetaRow">
                <span
                  v-for="quickTask in operabilityPanel.quickWins"
                  :key="quickTask.id"
                  class="assistantMetaChip"
                >
                  {{ quickTask.title }} · {{ quickTask.minutes }}m
                </span>
                <span v-if="operabilityPanel.cleanupMessage" class="assistantMetaChip cleanup">
                  {{ operabilityPanel.cleanupMessage }}
                </span>
              </div>
            </section>
          </article>
        </div>

        <transition name="timeSwap" mode="out-in">
          <div :key="selectedTimeFilter.id" class="focusListWrap">
            <TodoList
              :todos="selectedWorkspaceTasks"
              :editing-task-id="editingTaskId"
              :empty-message="workspaceEmptyMessage"
              @toggle="toggleTask"
              @remove="removeTask"
              @update="updateTask"
              @toggle-subtask="toggleSubtask"
              @open-external="handleTaskLaunchRequest"
            />
          </div>
        </transition>
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
        <TodoList
          :todos="followUpTasks"
          :editing-task-id="editingTaskId"
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
    </section>

    <section v-else-if="resolvedView === 'calendar'" class="calendarGridView">
      <template v-if="hasFeature(ENTITLEMENT_KEYS.PREMIUM_CALENDAR)">
        <TaskCalendar
          ref="calendarRef"
          :tasks="calendarSourceTasks"
          :editing-task-id="editingTaskId"
          @toggle="toggleTask"
          @remove="removeTask"
          @update="updateTask"
          @toggle-subtask="toggleSubtask"
          @open-external="handleTaskLaunchRequest"
          @create-on-date="openComposerFromCalendar"
        />

        <article
          v-if="visibleBacklogInsights.length"
          class="panelCard insightsPanel"
        >
          <div class="sectionHeader">
            <div>
              <p class="eyebrow">Lectura del calendario</p>
              <h3>Senales que conviene resolver primero</h3>
            </div>
          </div>

          <div class="insightList">
            <article v-for="insight in visibleBacklogInsights" :key="insight.id" class="insightCard">
              <strong>{{ insight.title }}</strong>
              <p>{{ insight.message }}</p>
            </article>
          </div>
        </article>
      </template>

      <article v-else class="panelCard calendarUpgradeCard">
        <div class="sectionHeader">
          <div>
            <p class="eyebrow">Calendario premium</p>
            <h3>Planifica semana y mes desde una vista visual</h3>
          </div>
        </div>

        <p class="panelText">
          ListEA Pro desbloquea un calendario local con carga diaria, seguimientos y cierres para que organices sin salir del dispositivo.
        </p>

        <div class="calendarPreviewCard" aria-hidden="true">
          <div class="calendarPreviewHead">
            <strong>Abril 2026</strong>
            <span>Vista mensual</span>
          </div>
          <div class="calendarPreviewWeekdays">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mie</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sab</span>
            <span>Dom</span>
          </div>
          <div class="calendarPreviewDays">
            <span
              v-for="day in calendarPreviewDays"
              :key="day"
              class="calendarPreviewDay"
              :class="{ active: [8, 11, 15, 19, 24].includes(day) }"
            >
              {{ day }}
            </span>
          </div>
        </div>

        <div class="calendarBenefitList">
          <span class="previewChip">Mes completo en un vistazo</span>
          <span class="previewChip">Seguimientos visibles</span>
          <span class="previewChip">Nueva tarea desde un dia</span>
        </div>

        <div class="upgradePanel compactUpgrade">
          <strong>ListEA Pro convierte tu backlog en calendario de trabajo.</strong>
          <p class="panelText">Tu planeacion, ritmo mensual y seguimiento viven localmente.</p>
          <button type="button" class="primaryButton" @click="requestUpgrade(ENTITLEMENT_KEYS.PREMIUM_CALENDAR)">
            Ver ListEA Pro
          </button>
        </div>
      </article>
    </section>

    <section v-else-if="resolvedView === 'dashboard'" class="dashboardGrid">
      <ProductivityDashboard
        :analytics="analytics"
        :entitlements="preferences.license.entitlements"
        :license-tier="preferences.license.licenseTier"
        :operational-brief="currentOperationalBrief"
        :brief-history="effectiveAssistantPreferences.briefHistory"
        :tasks="tasks"
        @clear-analytics="clearAnalytics"
        @navigate="emit('navigate', $event)"
        @upgrade="requestUpgrade"
      />
    </section>

    <section v-else class="settingsGrid">
      <article class="panelCard">
        <p class="eyebrow">Privacidad</p>
        <h3>Todo vive en este dispositivo</h3>
        <p class="panelText">Sin cuentas, sin nube propia, sin sacar tus tareas del dispositivo.</p>
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
              {{ isProActive ? `${subscriptionPlanLabel}. Tus datos siguen viviendo aqui.` : 'Tus tareas siguen completas y privadas en el plan Free.' }}
            </span>
          </div>
          <p class="panelText">Pro suma asistente movil, briefings semanales, centro de control premium, calendario, apertura inteligente, voz a tarea y respaldo cifrado.</p>
          <div class="buttonRow">
            <button v-if="!isProActive" type="button" class="primaryButton" @click="subscribeToPro">
              Suscribirme a Pro
            </button>
            <button type="button" class="ghostButton" @click="restoreSubscription">
              Restaurar Pro
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
        <p class="panelText">Free cubre el aviso basico. Pro suma preparacion previa, riesgo y lectura semanal fuera de la app.</p>
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
            Free incluye avisos basicos. Pro suma avisos antes o despues.
          </p>

          <div class="buttonRow">
            <button type="button" class="primaryButton" @click="saveReminderSettings">
              Guardar preferencias
            </button>
          </div>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Asistente movil</p>
        <h3>Tu telefono te ayuda a actuar, no solo a recordar</h3>
        <p class="panelText">
          Prepara tareas antes de la hora, empuja compromisos en riesgo y deja lista la lectura operativa semanal.
        </p>
        <div class="settingsStack">
          <label class="checkboxRow">
            <input
              :checked="effectiveAssistantPreferences.assistantEnabled"
              type="checkbox"
              @change="setAssistantEnabled($event.target.checked)"
            />
            <span>Activar asistente movil</span>
          </label>

          <label class="fieldGroup">
            <span>Pre-recordatorio</span>
            <select
              class="detailField"
              :value="effectiveAssistantPreferences.preReminderOffset"
              @change="setPreReminderOffset($event.target.value)"
            >
              <option
                v-for="option in PRE_REMINDER_OPTIONS"
                :key="option.value"
                :value="option.value"
                :disabled="option.value > 0 && !preferences.license.entitlements.advancedReminders"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Tono del asistente</span>
            <select
              class="detailField"
              :value="effectiveAssistantPreferences.reminderPersonality"
              @change="setReminderPersonality($event.target.value)"
            >
              <option
                v-for="option in REMINDER_PERSONALITY_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <div class="fieldGroup">
            <span>Horas silenciosas</span>
            <div class="inlineFieldRow">
              <input
                class="detailField"
                type="time"
                :value="effectiveAssistantPreferences.quietHoursStart"
                @change="setAssistantPreferences({ quietHoursStart: $event.target.value })"
              />
              <input
                class="detailField"
                type="time"
                :value="effectiveAssistantPreferences.quietHoursEnd"
                @change="setAssistantPreferences({ quietHoursEnd: $event.target.value })"
              />
            </div>
          </div>

          <label class="fieldGroup">
            <span>Resumen semanal</span>
            <div class="inlineFieldRow">
              <select
                class="detailField"
                :value="effectiveAssistantPreferences.weeklyBriefDay"
                @change="setWeeklyBriefDay($event.target.value)"
              >
                <option v-for="day in WEEKDAY_OPTIONS" :key="day.value" :value="day.value">
                  {{ day.label }}
                </option>
              </select>
              <input
                class="detailField"
                type="time"
                :value="effectiveAssistantPreferences.weeklyBriefTime"
                @change="setWeeklyBriefTime($event.target.value)"
              />
            </div>
          </label>

          <label class="checkboxRow">
            <input
              :checked="effectiveAssistantPreferences.directOpenCompatibleApp"
              type="checkbox"
              @change="setDirectOpenCompatibleApp($event.target.checked)"
            />
            <span>Abrir directo la app compatible desde el recordatorio</span>
          </label>

          <div class="briefPreviewCard">
            <strong>Lectura semanal actual</strong>
            <p>{{ currentOperationalBrief.highlights[0] || 'ListEA preparara aqui tu lectura operativa.' }}</p>
            <small>{{ currentOperationalBrief.highlights[1] || 'Se construye solo con datos locales del dispositivo.' }}</small>
          </div>

          <p v-if="!preferences.license.entitlements.mobileAssistant" class="panelText">
            ListEA Free recuerda. Pro se comporta como asistente movil local-first.
          </p>
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
            El aviso basico es gratis. Pro suma duracion y filtros avanzados.
          </p>
        </div>
      </article>

      <article class="panelCard">
        <p class="eyebrow">Respaldo</p>
        <h3>Exporta e importa tus datos localmente</h3>
        <div class="settingsStack">
          <p class="panelText">Exporta e importa con un archivo local. El cifrado queda para Pro.</p>
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
  width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding-inline: var(--shell-pad-inline);
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.topBar,
.panelCard {
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.topBar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 4px 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
}

.topCopy {
  display: grid;
  gap: 6px;
  align-content: start;
  min-width: 0;
}

.topHint {
  max-width: none;
}

.topCopy h1,
.eyebrow {
  margin: 0;
  text-align: left;
}

.topCopy h1 {
  margin-top: 0.35rem;
  margin-bottom: 0.5rem;
  max-width: none;
  font-size: clamp(1.08rem, 5vw, 1.48rem);
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
  max-width: none;
  font-size: 0.92rem;
}

.topStats {
  display: flex;
  gap: 8px;
  align-self: stretch;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.topStats::-webkit-scrollbar {
  display: none;
}

.quickActionRow {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  margin-top: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.quickActionRow::-webkit-scrollbar {
  display: none;
}

.quickActionButton {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
  background: color-mix(in srgb, var(--surface) 58%, transparent);
  color: var(--text-main);
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
}

.feedbackBanner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0 0 16px;
  border-radius: 0;
  border: 0;
  border-left: 3px solid color-mix(in srgb, var(--accent) 42%, var(--line));
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.feedbackBanner[data-tone='success'] {
  border-left-color: color-mix(in srgb, #5f8d64 48%, var(--line));
}

.feedbackBanner[data-tone='error'] {
  border-left-color: color-mix(in srgb, #de6f4d 52%, var(--line));
}

.feedbackBanner[data-tone='info'] {
  border-left-color: color-mix(in srgb, var(--accent) 56%, var(--line));
}

.feedbackBanner p {
  margin: 0;
  text-align: left;
  font-weight: 600;
}

.feedbackActions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.upgradeBanner,
.upgradePanel {
  display: grid;
  gap: 12px;
  padding: 14px 0 0;
  border-radius: 0;
  border: 0;
  border-top: 1px dashed color-mix(in srgb, var(--accent) 34%, var(--line));
  background: transparent;
  box-shadow: none;
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
  gap: 4px;
  min-width: min(46vw, 168px);
  min-height: 78px;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--line));
  background: color-mix(in srgb, white 94%, var(--surface));
  box-shadow: 0 14px 28px rgba(15, 70, 98, 0.08);
  text-align: left;
  min-width: 0;
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
  padding: 10px 0 12px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  background: color-mix(in srgb, var(--app-bg-solid) 72%, transparent);
  backdrop-filter: blur(14px);
}

.searchField {
  display: block;
}

.timeFilterGrid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.timeFilterTile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  min-height: 72px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface) 64%, transparent);
  color: var(--text-main);
  text-align: left;
  line-height: 1.15;
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
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
}

.filterChip,
.ghostButton,
.primaryButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  line-height: 1.15;
  text-align: center;
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
.calendarGridView,
.dashboardGrid,
.settingsGrid {
  display: grid;
  gap: 14px;
}

.focusBoardGrid {
  grid-template-columns: 1fr;
}

.workflowGrid {
  grid-template-columns: 1fr;
}

.calendarGridView {
  grid-template-columns: 1fr;
}

.dashboardGrid {
  grid-template-columns: 1fr;
}

.settingsGrid {
  grid-template-columns: 1fr;
}

.panelCard {
  padding: 4px 0 0;
}

.calendarUpgradeCard {
  display: grid;
  gap: 16px;
  background: transparent;
}

.calendarPreviewCard {
  display: grid;
  gap: 12px;
  padding: 16px 0 0;
  border-radius: 24px;
  border: 0;
  background: transparent;
}

.calendarPreviewHead {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.calendarPreviewHead span {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.calendarPreviewWeekdays,
.calendarPreviewDays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendarPreviewWeekdays {
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.calendarPreviewDay {
  min-height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 8%, var(--line));
  background: color-mix(in srgb, var(--surface) 92%, white);
  font-weight: 600;
}

.calendarPreviewDay.active {
  background: color-mix(in srgb, var(--accent) 14%, white);
  border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
}

.calendarBenefitList {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.compactUpgrade {
  display: grid;
  gap: 10px;
}

.laneHeader,
.sectionHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-direction: column;
  margin-bottom: 14px;
}

.headerActions,
.headerToggleWrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
  justify-content: space-between;
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
  min-width: 0;
}

.focusListWrap {
  min-height: 120px;
}

.operabilityGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.assistantBoard {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--section-line-strong);
  background:
    linear-gradient(180deg, var(--section-tint) 0%, var(--section-tint-soft) 100%);
  box-shadow: var(--section-shadow-soft);
}

.assistantBoard[data-tone='warn'] {
  border-color: color-mix(in srgb, #c77c43 38%, var(--section-line-strong));
}

.assistantBoardHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.assistantSummaryRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.assistantSection {
  display: grid;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--section-line-strong) 72%, transparent);
}

.assistantSectionSoft {
  padding: 14px;
  border-top: 0;
  border-radius: 18px;
  background: color-mix(in srgb, var(--section-tint-soft) 72%, white);
}

.assistantSectionEyebrow {
  margin: 0 0 4px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-strong);
}

.assistantSectionTitle {
  display: block;
  text-align: left;
}

.assistantCard {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--line));
  background: color-mix(in srgb, white 92%, var(--surface));
  box-shadow: 0 14px 28px rgba(15, 70, 98, 0.08);
}

.assistantCardHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.assistantCardHead strong,
.assistantTaskButton strong,
.rescueActionCard strong,
.rescueActionCard small {
  display: block;
  text-align: left;
}

.assistantStatePill,
.assistantMetaChip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface) 82%, white);
  color: var(--text-main);
  font-weight: 700;
}

.assistantStatePill[data-tone='warn'] {
  color: #a14e1f;
}

.assistantStatePill[data-tone='good'] {
  color: #336346;
}

.assistantTaskRow,
.assistantMetaRow,
.rescueList {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-direction: column;
}

.assistantTaskButton,
.rescueActionCard {
  display: grid;
  gap: 4px;
  justify-items: start;
  text-align: left;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--line));
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--text-main);
}

.assistantTaskButton {
  flex: 1 1 180px;
  min-height: 72px;
  padding: 12px 14px;
}

.assistantTaskButton span,
.rescueActionCard span {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.assistantMetaChip.cleanup {
  white-space: normal;
  align-items: flex-start;
  padding-top: 8px;
  padding-bottom: 8px;
  border-radius: 18px;
}

.rescueActionCard {
  flex: 1 1 220px;
  padding: 12px 14px;
}

.rescueActionCard small {
  color: var(--text-muted);
}

.focusFilterBar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.focusFilterBar::-webkit-scrollbar {
  display: none;
}

.focusFilterTile {
  flex: 0 0 min(48vw, 170px);
  min-height: 62px;
  gap: 6px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--surface) 64%, transparent);
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

.insightCard {
  padding: 14px 0 0;
  border-radius: 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  background: transparent;
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
  grid-template-columns: 1fr;
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
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface) 64%, transparent);
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
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface) 64%, transparent);
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

.inlineFieldRow {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.briefPreviewCard {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--line));
  background: color-mix(in srgb, var(--surface) 64%, transparent);
  text-align: left;
}

.briefPreviewCard p,
.briefPreviewCard small {
  margin: 0;
}

.briefPreviewCard small {
  color: var(--text-muted);
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
  .topBar,
  .workflowGrid,
  .focusBoardGrid,
  .calendarGridView,
  .settingsGrid,
  .timeFilterGrid,
  .inlineFieldRow,
  .operabilityGrid {
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

}

@media (max-width: 1080px) {
  .topBar {
    grid-template-columns: 1fr;
  }

  .topStats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .focusFilterBar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .settingsGrid {
    grid-template-columns: 1fr;
  }

  .settingsGrid > .panelCard:first-child,
  .settingsGrid > .panelCard:nth-child(2) {
    grid-column: auto;
  }
}

@media (max-width: 820px) {
  .topCopy h1 {
    max-width: none;
  }

  .quickActionRow {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .quickActionRow::-webkit-scrollbar {
    display: none;
  }

  .quickActionButton {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .headerActions {
    width: 100%;
    justify-content: space-between;
  }

  .laneCount {
    min-width: 0;
    padding-inline: 12px;
  }
}

@media (max-width: 640px) {
  .tasksShell {
    gap: 12px;
    padding-inline: 12px;
  }

  .topBar,
  .panelCard {
    padding: 0;
    border-radius: 0;
  }

  .calendarPreviewWeekdays,
  .calendarPreviewDays {
    gap: 6px;
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
    min-width: 140px;
    min-height: 78px;
    padding: 14px 16px;
    border-radius: 20px;
  }

  .quickActionRow {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .quickActionRow::-webkit-scrollbar {
    display: none;
  }

  .quickActionButton {
    flex: 0 0 auto;
    white-space: nowrap;
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

  .feedbackActions {
    width: 100%;
  }

  .upgradeActions {
    flex-direction: column;
    align-items: stretch;
  }

  .filterBar {
    top: calc(56px + env(safe-area-inset-top));
    padding: 8px 0 10px;
    border-radius: 0;
  }

  .focusFilterBar {
    display: flex;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .assistantTaskRow,
  .assistantMetaRow,
  .rescueList {
    flex-direction: column;
  }

  .focusFilterBar::-webkit-scrollbar {
    display: none;
  }

  .focusFilterTile {
    flex: 0 0 min(48vw, 180px);
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

@media (min-width: 641px) {
  .panelText,
  .emptyText {
    font-size: 0.96rem;
  }

  .topStats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    overflow: visible;
    padding-bottom: 0;
    scrollbar-width: auto;
  }

  .statCard {
    min-width: 0;
  }

  .quickActionRow {
    flex-wrap: wrap;
    overflow: visible;
    padding-bottom: 0;
    scrollbar-width: auto;
  }

  .focusFilterBar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    padding-bottom: 0;
    scrollbar-width: auto;
  }

  .focusFilterTile {
    min-height: 60px;
    min-width: 0;
    flex: 1 1 auto;
  }

  .snippetActions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 861px) {
  .sectionHeader {
    flex-direction: row;
  }

  .headerActions,
  .headerToggleWrap {
    width: auto;
    justify-content: flex-start;
  }

  .operabilityGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .assistantTaskRow,
  .assistantMetaRow,
  .rescueList {
    flex-direction: row;
  }
}

@media (min-width: 961px) {
  .topBar {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.95fr);
    gap: 14px;
    padding: 8px 0 14px;
  }

  .topCopy h1 {
    max-width: 18ch;
    font-size: clamp(1.25rem, 4vw, 1.78rem);
  }

  .topHint {
    max-width: 52ch;
  }

  .topStats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .focusFilterBar {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .settingsGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
