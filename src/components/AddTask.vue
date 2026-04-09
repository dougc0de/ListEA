<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ENTITLEMENT_KEYS } from '../domain/license';
import { QuickCaptureInterpreter } from '../domain/quickCapture';
import { ScreenshotTaskCaptureService } from '../services/screenshotTaskCaptureService';
import {
  VOICE_CAPTURE_STATES,
  VoiceTaskCaptureService,
} from '../services/voiceTaskCaptureService';
import {
  CAPTURE_SOURCES,
  TASK_DATE_PRECISION,
  TaskContextPresenter,
  buildTaskDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../domain/tasks';

const props = defineProps({
  voiceCaptureEnabled: { type: Boolean, default: false },
});

const emit = defineEmits(['add', 'voice-add', 'request-upgrade']);

const title = ref('');
const notes = ref('');
const project = ref('');
const area = ref('');
const dueDate = ref('');
const dueTime = ref('');
const dueHasTime = ref(false);
const followUpDate = ref('');
const followUpTime = ref('');
const followUpHasTime = ref(false);
const priority = ref('');
const status = ref('active');
const effortMinutes = ref('');
const tags = ref('');
const subtasks = ref('');
const recurrencePreset = ref('none');
const recurrenceInterval = ref(1);
const recurrenceMode = ref('fixed');
const recurrenceResetNotes = ref(true);
const advancedOpen = ref(false);
const composerOpen = ref(false);
const titleError = ref('');
const recurrenceError = ref('');
const titleField = ref(null);
const captureSource = ref(CAPTURE_SOURCES.MANUAL);
const screenshotInput = ref(null);
const screenshotBusy = ref(false);
const screenshotProgress = ref(0);
const screenshotStatus = ref('');
const screenshotError = ref('');
const voiceState = ref(VOICE_CAPTURE_STATES.IDLE);
const voiceWaveform = ref(Array.from({ length: 18 }, () => 0.12));
const voiceTranscript = ref('');
const voiceStatus = ref('');
const voiceError = ref('');
const voiceSupported = ref(true);
const voiceCapabilityChecked = ref(false);
const voiceSession = ref(null);

const interpreter = new QuickCaptureInterpreter();
const presenter = new TaskContextPresenter();
const screenshotCaptureService = new ScreenshotTaskCaptureService();
const voiceTaskCaptureService = new VoiceTaskCaptureService();
const captureTemplates = Object.freeze([
  { id: 'call', label: 'Llamada' },
  { id: 'email-follow-up', label: 'Correo pendiente' },
  { id: 'meeting', label: 'Reunion' },
  { id: 'proposal', label: 'Propuesta' },
  { id: 'billing-follow-up', label: 'Cobro/seguimiento' },
]);

const parsedSubtasks = computed(() =>
  subtasks.value
    .split('\n')
    .map(subtask => subtask.trim())
    .filter(Boolean),
);

const capturePreview = computed(() => interpreter.interpret(title.value));
const showScreenshotFeedback = computed(() => (
  screenshotBusy.value
  || Boolean(screenshotStatus.value)
  || Boolean(screenshotError.value)
));
const screenshotProgressWidth = computed(() => `${Math.max(4, Math.round(screenshotProgress.value * 100))}%`);
const screenshotButtonLabel = computed(() => (
  screenshotBusy.value ? 'Leyendo screenshot...' : 'Convertir screenshot en tarea'
));
const voiceCaptureActive = computed(() => [
  VOICE_CAPTURE_STATES.STARTING,
  VOICE_CAPTURE_STATES.RECORDING,
  VOICE_CAPTURE_STATES.STOPPING,
].includes(voiceState.value));
const showVoiceFeedback = computed(() => (
  voiceCaptureActive.value
  || Boolean(voiceStatus.value)
  || Boolean(voiceError.value)
  || Boolean(voiceTranscript.value)
));
const voiceButtonLabel = computed(() => {
  if (!props.voiceCaptureEnabled) return 'Voz Pro';
  if (voiceState.value === VOICE_CAPTURE_STATES.STARTING) return 'Preparando voz...';
  if (voiceState.value === VOICE_CAPTURE_STATES.RECORDING) return 'Detener y guardar';
  if (voiceState.value === VOICE_CAPTURE_STATES.STOPPING) return 'Guardando...';
  return 'Hablar tarea';
});
const voiceStatusTone = computed(() => (voiceError.value ? 'error' : 'info'));
const voiceCanOpenDraft = computed(() => Boolean(voiceTranscript.value.trim()) && Boolean(voiceError.value));
const composerHelperText = computed(() => (
  captureSource.value === CAPTURE_SOURCES.SCREENSHOT
    ? 'Ajusta lo detectado y guarda.'
    : 'Primero idea, luego estructura.'
));
const priorityLabels = Object.freeze({
  high: 'alta',
  medium: 'media',
  low: 'baja',
});
const recurrenceLabels = Object.freeze({
  none: 'Sin recurrencia',
  daily: 'Cada dia',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada ano',
  weekdays: 'Dias laborables',
  weekends: 'Fines de semana',
  'every-x-days': 'Cada 3 dias',
});

const previewItems = computed(() => {
  const items = [];
  if (capturePreview.value.title && capturePreview.value.title !== title.value.trim()) {
    items.push(`Accion sugerida: ${capturePreview.value.title}`);
  }
  if (capturePreview.value.dueAt) {
    items.push(`Fecha detectada: ${presenter.formatDate(capturePreview.value.dueAt, capturePreview.value.dueAtPrecision)}`);
  }
  if (capturePreview.value.followUpAt) {
    items.push(`Seguimiento detectado: ${presenter.formatDate(capturePreview.value.followUpAt, capturePreview.value.followUpAtPrecision)}`);
  }
  if (capturePreview.value.project || capturePreview.value.area) {
    items.push(`Contexto detectado: ${capturePreview.value.project || capturePreview.value.area}`);
  }
  if (capturePreview.value.tags.length) items.push(`Etiquetas: ${capturePreview.value.tags.join(', ')}`);
  if (capturePreview.value.notes) items.push('Notas separadas automaticamente');
  if (capturePreview.value.status === 'waiting') items.push('Estado sugerido: seguimiento');
  if (capturePreview.value.status === 'blocked') items.push('Estado sugerido: bloqueada');
  if (capturePreview.value.priority !== 'medium') {
    const label = priorityLabels[capturePreview.value.priority] ?? capturePreview.value.priority;
    items.push(`Prioridad sugerida: ${label}`);
  }
  if (capturePreview.value.recurrence.preset !== 'none') {
    const recurrenceLabel = recurrenceLabels[capturePreview.value.recurrence.preset] ?? capturePreview.value.recurrence.preset;
    items.push(`Recurrencia: ${recurrenceLabel}`);
  }
  return items;
});

function buildFutureDateInputValue(daysFromToday = 0) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysFromToday);
  nextDate.setHours(23, 59, 0, 0);
  return toDateInputValue(nextDate);
}

function setDateField(dateRef, timeRef, hasTimeRef, value = '', precision = '') {
  dateRef.value = toDateInputValue(value);
  hasTimeRef.value = precision === TASK_DATE_PRECISION.DATETIME;
  timeRef.value = hasTimeRef.value ? toTimeInputValue(value) : '';
}

function openComposer({ focus = true } = {}) {
  composerOpen.value = true;
  if (!focus) return;

  nextTick(() => {
    focusTitleField();
  });
}

function applyDraft(draft = {}) {
  if (!draft || typeof draft !== 'object') return;

  if (draft.title !== undefined) title.value = `${draft.title ?? ''}`;
  if (draft.notes !== undefined) notes.value = `${draft.notes ?? ''}`;
  if (draft.project !== undefined) project.value = `${draft.project ?? ''}`;
  if (draft.area !== undefined) area.value = `${draft.area ?? ''}`;
  if (draft.priority !== undefined) priority.value = `${draft.priority ?? ''}`;
  if (draft.status !== undefined) status.value = `${draft.status ?? 'active'}` || 'active';
  if (draft.effortMinutes !== undefined) effortMinutes.value = draft.effortMinutes ? `${draft.effortMinutes}` : '';
  if (draft.tags !== undefined) {
    tags.value = Array.isArray(draft.tags) ? draft.tags.join(', ') : `${draft.tags ?? ''}`;
  }
  if (draft.subtasks !== undefined) {
    subtasks.value = Array.isArray(draft.subtasks) ? draft.subtasks.join('\n') : `${draft.subtasks ?? ''}`;
  }
  if (draft.dueAt !== undefined) {
    setDateField(dueDate, dueTime, dueHasTime, draft.dueAt, draft.dueAtPrecision);
  }
  if (draft.followUpAt !== undefined) {
    setDateField(followUpDate, followUpTime, followUpHasTime, draft.followUpAt, draft.followUpAtPrecision);
  }
  if (draft.recurrence !== undefined) {
    recurrencePreset.value = draft.recurrence?.preset || 'none';
    recurrenceInterval.value = draft.recurrence?.interval || 1;
    recurrenceMode.value = draft.recurrence?.mode || 'fixed';
    recurrenceResetNotes.value = draft.recurrence?.resetNotes ?? true;
  }
  advancedOpen.value = Boolean(
    draft.notes
    || draft.project
    || draft.area
    || draft.dueAt
    || draft.followUpAt,
  );
}

function openComposerWithDraft(draft = {}) {
  resetForm();
  openComposer({ focus: false });
  applyDraft(draft);
  nextTick(() => {
    focusTitleField();
  });
}

function closeComposer() {
  composerOpen.value = false;
  advancedOpen.value = false;
  titleError.value = '';
  recurrenceError.value = '';
  screenshotStatus.value = '';
  screenshotError.value = '';
  screenshotProgress.value = 0;
}

function focusTitleField() {
  if (!titleField.value) return;

  titleField.value.focus({ preventScroll: true });
  titleField.value.setSelectionRange?.(titleField.value.value.length, titleField.value.value.length);
  titleField.value.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      titleField.value?.focus({ preventScroll: true });
    });
  }
}

function resetForm() {
  title.value = '';
  notes.value = '';
  project.value = '';
  area.value = '';
  dueDate.value = '';
  dueTime.value = '';
  dueHasTime.value = false;
  followUpDate.value = '';
  followUpTime.value = '';
  followUpHasTime.value = false;
  priority.value = '';
  status.value = 'active';
  effortMinutes.value = '';
  tags.value = '';
  subtasks.value = '';
  recurrencePreset.value = 'none';
  recurrenceInterval.value = 1;
  recurrenceMode.value = 'fixed';
  recurrenceResetNotes.value = true;
  advancedOpen.value = false;
  titleError.value = '';
  recurrenceError.value = '';
  captureSource.value = CAPTURE_SOURCES.MANUAL;
  screenshotStatus.value = '';
  screenshotError.value = '';
  screenshotProgress.value = 0;
}

function applyTemplate(templateId) {
  captureSource.value = CAPTURE_SOURCES.MANUAL;
  advancedOpen.value = true;
  titleError.value = '';
  recurrenceError.value = '';

  if (templateId === 'call') {
    title.value = 'Llamar a ';
    notes.value = 'Define el siguiente paso y deja un resumen corto.';
    project.value = 'Clientes';
    area.value = 'Trabajo';
    setDateField(dueDate, dueTime, dueHasTime);
    setDateField(followUpDate, followUpTime, followUpHasTime);
    priority.value = 'medium';
    status.value = 'active';
    effortMinutes.value = '15';
    tags.value = 'cliente, llamada';
    return;
  }

  if (templateId === 'email-follow-up') {
    title.value = 'Seguimiento de correo para ';
    notes.value = 'Confirma respuesta, siguiente paso y fecha prometida.';
    project.value = 'Clientes';
    area.value = 'Trabajo';
    setDateField(dueDate, dueTime, dueHasTime);
    followUpDate.value = buildFutureDateInputValue(1);
    followUpTime.value = '';
    followUpHasTime.value = false;
    priority.value = 'medium';
    status.value = 'waiting';
    effortMinutes.value = '10';
    tags.value = 'correo, seguimiento';
    return;
  }

  if (templateId === 'meeting') {
    title.value = 'Reunion con ';
    notes.value = 'Anota el objetivo, decision esperada y siguiente paso.';
    project.value = 'Trabajo';
    area.value = 'Trabajo';
    setDateField(dueDate, dueTime, dueHasTime);
    setDateField(followUpDate, followUpTime, followUpHasTime);
    priority.value = 'medium';
    status.value = 'active';
    effortMinutes.value = '45';
    tags.value = 'reunion';
    return;
  }

  if (templateId === 'proposal') {
    title.value = 'Preparar propuesta para ';
    notes.value = 'Deja alcance, fecha y cierre esperado.';
    project.value = 'Clientes';
    area.value = 'Trabajo';
    setDateField(dueDate, dueTime, dueHasTime);
    setDateField(followUpDate, followUpTime, followUpHasTime);
    priority.value = 'high';
    status.value = 'active';
    effortMinutes.value = '50';
    tags.value = 'propuesta, cliente';
    return;
  }

  title.value = 'Seguimiento de cobro ';
  notes.value = 'Confirma fecha de pago, evidencia y siguiente contacto.';
  project.value = 'Finanzas';
  area.value = 'Trabajo';
  setDateField(dueDate, dueTime, dueHasTime);
  followUpDate.value = buildFutureDateInputValue(2);
  followUpTime.value = '';
  followUpHasTime.value = false;
  priority.value = 'high';
  status.value = 'waiting';
  effortMinutes.value = '10';
  tags.value = 'cobro, seguimiento';
}

function clearDateField(field) {
  if (field === 'dueAt') {
    dueDate.value = '';
    dueTime.value = '';
    dueHasTime.value = false;
    recurrenceError.value = '';
    return;
  }

  followUpDate.value = '';
  followUpTime.value = '';
  followUpHasTime.value = false;
}

function handleScreenshotProgress(progressUpdate = {}) {
  const nextStatus = `${progressUpdate.status ?? ''}`.trim();
  const nextProgress = Number(progressUpdate.progress);

  if (nextStatus) {
    screenshotStatus.value = nextStatus;
  }

  if (Number.isFinite(nextProgress)) {
    screenshotProgress.value = Math.max(screenshotProgress.value, Math.min(Math.max(nextProgress, 0), 1));
  }
}

function shouldRevealAdvancedFromCapture(interpreted = {}) {
  return Boolean(
    interpreted.notes
    || interpreted.project
    || interpreted.area
    || interpreted.dueAt
    || interpreted.followUpAt
    || interpreted.tags?.length
    || interpreted.effortMinutes
    || interpreted.status === 'waiting'
    || interpreted.status === 'blocked'
    || interpreted.priority === 'high'
    || interpreted.priority === 'low'
    || interpreted.recurrence?.preset !== 'none',
  );
}

function applyScreenshotCapture(result) {
  const interpreted = result?.interpretation ?? {};

  resetForm();
  captureSource.value = CAPTURE_SOURCES.SCREENSHOT;
  title.value = interpreted.title || `${result?.rawText ?? ''}`.split('\n')[0]?.trim() || '';
  notes.value = interpreted.notes || '';
  project.value = interpreted.project || '';
  area.value = interpreted.area || '';
  setDateField(dueDate, dueTime, dueHasTime, interpreted.dueAt, interpreted.dueAtPrecision);
  setDateField(followUpDate, followUpTime, followUpHasTime, interpreted.followUpAt, interpreted.followUpAtPrecision);
  priority.value = interpreted.priority && interpreted.priority !== 'medium' ? interpreted.priority : '';
  status.value = interpreted.status || 'active';
  effortMinutes.value = interpreted.effortMinutes ? String(interpreted.effortMinutes) : '';
  tags.value = Array.isArray(interpreted.tags) ? interpreted.tags.join(', ') : '';
  recurrencePreset.value = interpreted.recurrence?.preset || 'none';
  recurrenceInterval.value = interpreted.recurrence?.interval || 1;
  recurrenceMode.value = interpreted.recurrence?.mode || 'fixed';
  recurrenceResetNotes.value = interpreted.recurrence?.resetNotes ?? true;
  advancedOpen.value = shouldRevealAdvancedFromCapture(interpreted);
}

function openScreenshotPicker() {
  if (voiceCaptureActive.value) return;
  screenshotError.value = '';
  screenshotStatus.value = '';
  screenshotProgress.value = 0;
  screenshotInput.value?.click();
}

async function handleScreenshotSelection(event) {
  const [file] = Array.from(event?.target?.files ?? []);
  if (event?.target) {
    event.target.value = '';
  }

  if (!file) {
    return;
  }

  screenshotBusy.value = true;
  screenshotError.value = '';
  screenshotStatus.value = 'Preparando screenshot';
  screenshotProgress.value = 0.04;
  openComposer({ focus: false });

  try {
    const result = await screenshotCaptureService.convert(file, {
      onProgress: handleScreenshotProgress,
    });

    applyScreenshotCapture(result);
    screenshotStatus.value = 'Screenshot convertido';
    screenshotProgress.value = 1;
    await nextTick();
    focusTitleField();
  } catch (error) {
    screenshotError.value = error?.message || 'No pudimos convertir el screenshot en tarea.';
    advancedOpen.value = true;
  } finally {
    screenshotBusy.value = false;
  }
}

function resetVoiceFeedback({ keepTranscript = false } = {}) {
  voiceStatus.value = '';
  voiceError.value = '';
  voiceWaveform.value = Array.from({ length: 18 }, () => 0.12);
  if (!keepTranscript) {
    voiceTranscript.value = '';
  }
}

function handleVoiceTranscriptUpdate(payload = {}) {
  const transcript = `${payload.transcript ?? ''}`.trim();
  if (!transcript) return;
  voiceTranscript.value = transcript;
  voiceStatus.value = payload.isFinal ? 'Tarea detectada.' : 'Escuchando...';
}

function handleVoiceWaveformUpdate(nextWaveform = []) {
  voiceWaveform.value = Array.isArray(nextWaveform) && nextWaveform.length
    ? nextWaveform
    : Array.from({ length: 18 }, () => 0.12);
}

function handleVoiceStateUpdate(nextState) {
  voiceState.value = nextState || VOICE_CAPTURE_STATES.IDLE;
}

async function syncVoiceSupport() {
  try {
    voiceSupported.value = await voiceTaskCaptureService.isSupported();
  } catch {
    voiceSupported.value = false;
  } finally {
    voiceCapabilityChecked.value = true;
  }
}

async function startVoiceCapture() {
  if (!props.voiceCaptureEnabled) {
    emit('request-upgrade', ENTITLEMENT_KEYS.VOICE_CAPTURE);
    return;
  }

  if (screenshotBusy.value) return;
  if (voiceCaptureActive.value) return;

  if (!voiceCapabilityChecked.value) {
    await syncVoiceSupport();
  }

  if (!voiceSupported.value) {
    voiceError.value = 'La captura por voz no esta disponible en este dispositivo o navegador.';
    return;
  }

  resetVoiceFeedback();
  voiceStatus.value = 'Preparando microfono...';
  const session = voiceTaskCaptureService.createSession({
    onStateChange: handleVoiceStateUpdate,
    onTranscript: handleVoiceTranscriptUpdate,
    onWaveform: handleVoiceWaveformUpdate,
  });

  voiceSession.value = session;

  try {
    await session.start();
    voiceStatus.value = 'Habla ahora. Cuando detengas, ListEA guarda la tarea.';
  } catch (error) {
    voiceSession.value = null;
    voiceState.value = VOICE_CAPTURE_STATES.ERROR;
    voiceError.value = error?.message || 'No pudimos iniciar la captura por voz.';
  }
}

async function stopVoiceCapture() {
  if (!voiceSession.value) return;

  try {
    const result = await voiceSession.value.stop();
    voiceStatus.value = 'Tarea guardada desde voz.';
    emit('voice-add', result);
  } catch (error) {
    voiceError.value = error?.message || 'No pudimos guardar la tarea por voz.';
  } finally {
    voiceSession.value = null;
    if (voiceState.value !== VOICE_CAPTURE_STATES.ERROR) {
      voiceState.value = VOICE_CAPTURE_STATES.IDLE;
    }
  }
}

async function cancelVoiceCapture() {
  if (voiceSession.value) {
    await voiceSession.value.cancel();
  }
  voiceSession.value = null;
  voiceState.value = VOICE_CAPTURE_STATES.IDLE;
  resetVoiceFeedback();
}

async function handleVoiceCaptureButton() {
  if (voiceCaptureActive.value) {
    await stopVoiceCapture();
    return;
  }

  await startVoiceCapture();
}

function openVoiceDraftFallback() {
  const interpreted = interpreter.interpret(voiceTranscript.value);
  openComposerWithDraft({
    ...interpreted,
    title: interpreted.title || voiceTranscript.value.trim(),
    source: CAPTURE_SOURCES.VOICE,
  });
  voiceError.value = '';
  voiceStatus.value = 'Borrador abierto para que ajustes los detalles.';
}

function onSubmit() {
  const interpreted = capturePreview.value;
  const nextTitle = title.value.trim() || (interpreted.title || '').trim();
  const resolvedDue = dueDate.value
    ? buildTaskDateTime(dueDate.value, dueTime.value, dueHasTime.value)
    : {
      value: interpreted.dueAt,
      precision: interpreted.dueAtPrecision,
    };
  const resolvedFollowUp = followUpDate.value
    ? buildTaskDateTime(followUpDate.value, followUpTime.value, followUpHasTime.value)
    : {
      value: interpreted.followUpAt,
      precision: interpreted.followUpAtPrecision,
    };
  const resolvedStatus = advancedOpen.value
    ? (status.value || interpreted.status || 'active')
    : (interpreted.status || status.value || 'active');
  const effectiveRecurrenceMode = recurrencePreset.value !== 'none' && !resolvedDue.value
    ? 'after-completion'
    : recurrenceMode.value;

  titleError.value = '';
  recurrenceError.value = '';

  if (!nextTitle) {
    titleError.value = 'Titulo requerido.';
    advancedOpen.value = true;
    return;
  }

  emit('add', {
    title: nextTitle,
    notes: notes.value.trim() || interpreted.notes || '',
    project: project.value.trim() || interpreted.project || '',
    area: area.value.trim() || interpreted.area || '',
    dueAt: resolvedDue.value,
    dueAtPrecision: resolvedDue.precision,
    followUpAt: resolvedFollowUp.value,
    followUpAtPrecision: resolvedFollowUp.precision,
    priority: priority.value || interpreted.priority,
    status: resolvedStatus,
    effortMinutes: effortMinutes.value || interpreted.effortMinutes || 20,
    tags: [tags.value, interpreted.tags.join(',')].filter(Boolean).join(','),
    subtasks: parsedSubtasks.value,
    source: captureSource.value,
    capturedAt: new Date().toISOString(),
    needsTriage: false,
    recurrence: {
      ...(recurrencePreset.value === 'none' ? interpreted.recurrence : {
        preset: recurrencePreset.value,
        interval: Math.max(Number(recurrenceInterval.value) || 1, 1),
        mode: effectiveRecurrenceMode,
        resetNotes: recurrenceResetNotes.value,
      }),
    },
  });

  resetForm();
  closeComposer();
}

defineExpose({
  openComposer,
  openComposerWithDraft,
  closeComposer,
  focusTitleField,
});

onMounted(() => {
  syncVoiceSupport();
});

onBeforeUnmount(() => {
  voiceSession.value?.cancel?.();
});
</script>

<template>
  <transition name="noteComposer" mode="out-in">
    <section
      v-if="!composerOpen"
      key="launcher"
      class="launcherCard"
    >
      <button
        type="button"
        class="launcherPrimaryButton"
        @click="openComposer"
      >
        Agregar tarea
      </button>
      <button
        type="button"
        class="launcherSecondaryButton"
        :disabled="screenshotBusy"
        @click="openScreenshotPicker"
      >
        {{ screenshotButtonLabel }}
      </button>
      <button
        type="button"
        class="launcherSecondaryButton"
        :disabled="screenshotBusy || voiceState === VOICE_CAPTURE_STATES.STARTING || voiceState === VOICE_CAPTURE_STATES.STOPPING"
        @click="handleVoiceCaptureButton"
      >
        {{ voiceButtonLabel }}
      </button>

      <div v-if="showScreenshotFeedback" class="screenshotFeedback" :class="{ error: screenshotError }" aria-live="polite">
        <div class="screenshotFeedbackMeta">
          <span>{{ screenshotError || screenshotStatus }}</span>
          <strong v-if="screenshotBusy">{{ screenshotProgressWidth }}</strong>
        </div>
        <div v-if="screenshotBusy" class="screenshotProgressTrack" aria-hidden="true">
          <span class="screenshotProgressFill" :style="{ width: screenshotProgressWidth }" />
        </div>
      </div>
    </section>

    <section v-else key="composer" class="composerCard">
      <div class="composerHeading">
        <div>
          <p class="eyebrow">Nueva tarea</p>
          <h2>Escribe como si fuera una nota.</h2>
        </div>
        <div class="composerHeadingActions">
          <button
            type="button"
            class="ghostButton"
            :disabled="screenshotBusy || voiceState === VOICE_CAPTURE_STATES.STARTING || voiceState === VOICE_CAPTURE_STATES.STOPPING"
            @click="handleVoiceCaptureButton"
          >
            {{ voiceButtonLabel }}
          </button>
          <button type="button" class="ghostButton" :disabled="screenshotBusy" @click="openScreenshotPicker">
            Screenshot
          </button>
          <button type="button" class="ghostButton" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? 'Ocultar detalle' : 'Agregar detalle' }}
          </button>
          <button type="button" class="ghostButton" @click="closeComposer">
            Cerrar
          </button>
        </div>
      </div>

      <form class="composerForm" @submit.prevent="onSubmit">
        <div v-if="showScreenshotFeedback" class="screenshotFeedback" :class="{ error: screenshotError }" aria-live="polite">
          <div class="screenshotFeedbackMeta">
            <span>{{ screenshotError || screenshotStatus }}</span>
            <strong v-if="screenshotBusy">{{ screenshotProgressWidth }}</strong>
          </div>
          <div v-if="screenshotBusy" class="screenshotProgressTrack" aria-hidden="true">
            <span class="screenshotProgressFill" :style="{ width: screenshotProgressWidth }" />
          </div>
        </div>

        <div class="templateRow">
          <button
            v-for="template in captureTemplates"
            :key="template.id"
            type="button"
            class="templateChip"
            @click="applyTemplate(template.id)"
          >
            {{ template.label }}
          </button>
        </div>

        <p class="fieldLabel">Titulo</p>
        <textarea
          ref="titleField"
          v-model="title"
          class="primaryField"
          aria-label="Titulo"
          autofocus
          :aria-invalid="titleError ? 'true' : 'false'"
          rows="3"
          placeholder="Ejemplo: llamar al cliente manana 10am #ventas urgente"
          @input="titleError = ''"
        />

        <p v-if="titleError" class="fieldError" role="alert">{{ titleError }}</p>

        <div v-if="previewItems.length" class="previewBox">
          <span v-for="item in previewItems" :key="item" class="previewChip">{{ item }}</span>
        </div>

        <div v-if="advancedOpen" class="advancedPanel">
          <label class="fieldGroup wide">
            <span>Notas breves</span>
            <textarea
              v-model="notes"
              class="detailField"
              rows="3"
              placeholder="Contexto util, no burocracia."
            />
          </label>

          <label class="fieldGroup">
            <span>Proyecto</span>
            <input v-model="project" class="detailField" type="text" placeholder="Trabajo" />
          </label>

          <label class="fieldGroup">
            <span>Fecha objetivo</span>
            <div class="fieldWithAction">
              <input v-model="dueDate" class="detailField" type="date" @input="recurrenceError = ''" />
              <input
                v-if="dueHasTime"
                v-model="dueTime"
                class="detailField"
                type="time"
                @input="recurrenceError = ''"
              />
              <label class="checkboxRow compactToggle">
                <input v-model="dueHasTime" type="checkbox" />
                <span>Agregar hora</span>
              </label>
              <button v-if="dueDate" type="button" class="clearFieldButton" @click="clearDateField('dueAt')">
                Limpiar
              </button>
            </div>
          </label>

          <label class="fieldGroup">
            <span>Seguimiento</span>
            <div class="fieldWithAction">
              <input v-model="followUpDate" class="detailField" type="date" />
              <input
                v-if="followUpHasTime"
                v-model="followUpTime"
                class="detailField"
                type="time"
              />
              <label class="checkboxRow compactToggle">
                <input v-model="followUpHasTime" type="checkbox" />
                <span>Agregar hora</span>
              </label>
              <button v-if="followUpDate" type="button" class="clearFieldButton" @click="clearDateField('followUpAt')">
                Limpiar
              </button>
            </div>
          </label>

          <label class="fieldGroup">
            <span>Area</span>
            <input v-model="area" class="detailField" type="text" placeholder="Personal" />
          </label>

          <label class="fieldGroup">
            <span>Prioridad</span>
            <select v-model="priority" class="detailField">
              <option value="">Sugerida</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Estado</span>
            <select v-model="status" class="detailField">
              <option value="active">Activa</option>
              <option value="blocked">Bloqueada</option>
              <option value="waiting">En espera</option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Esfuerzo en minutos</span>
            <input v-model="effortMinutes" class="detailField" type="number" min="5" step="5" />
          </label>

          <label class="fieldGroup wide">
            <span>Etiquetas</span>
            <input v-model="tags" class="detailField" type="text" placeholder="ventas, cliente, rapido" />
          </label>

          <label class="fieldGroup wide">
            <span>Subtareas</span>
            <textarea
              v-model="subtasks"
              class="detailField"
              rows="4"
              placeholder="Una accion por linea"
            />
          </label>

          <label class="fieldGroup">
            <span>Recurrencia</span>
            <select v-model="recurrencePreset" class="detailField" @change="recurrenceError = ''">
              <option value="none">Sin recurrencia</option>
              <option value="daily">Cada dia</option>
              <option value="weekly">Cada semana</option>
              <option value="monthly">Cada mes</option>
              <option value="yearly">Cada ano</option>
              <option value="weekdays">Dias laborables</option>
              <option value="weekends">Fines de semana</option>
              <option value="every-x-days">Cada 3 dias</option>
            </select>
          </label>

          <label v-if="recurrencePreset !== 'none'" class="fieldGroup">
            <span>Intervalo de recurrencia</span>
            <input v-model="recurrenceInterval" class="detailField" type="number" min="1" step="1" @input="recurrenceError = ''" />
          </label>

          <label class="fieldGroup">
            <span>Base de recurrencia</span>
            <select v-model="recurrenceMode" class="detailField" :disabled="recurrencePreset === 'none'" @change="recurrenceError = ''">
              <option value="fixed">Fecha original</option>
              <option value="after-completion">Despues de completar</option>
            </select>
          </label>

          <label class="checkboxRow wide">
            <input v-model="recurrenceResetNotes" type="checkbox" />
            <span>Limpiar notas temporales al crear la siguiente ocurrencia</span>
          </label>

          <p v-if="recurrenceError" class="fieldError wide" role="alert">{{ recurrenceError }}</p>
        </div>

        <div class="composerActions">
          <p class="helperText">{{ composerHelperText }}</p>
          <button class="submitButton" type="submit" :disabled="screenshotBusy">Agregar tarea</button>
        </div>
      </form>
    </section>
  </transition>

  <section v-if="showVoiceFeedback" class="voiceFeedback" :class="{ error: voiceStatusTone === 'error' }" aria-live="polite">
    <div class="voiceFeedbackHeader">
      <div>
        <p class="eyebrow">Voz</p>
        <strong>{{ voiceError || voiceStatus || 'ListEA escuchando...' }}</strong>
      </div>
      <div class="voiceFeedbackActions">
        <button
          v-if="voiceCaptureActive"
          type="button"
          class="submitButton voiceActionButton"
          @click="stopVoiceCapture"
        >
          Detener
        </button>
        <button
          v-if="voiceCaptureActive"
          type="button"
          class="ghostButton voiceActionButton"
          @click="cancelVoiceCapture"
        >
          Cancelar
        </button>
        <button
          v-if="voiceCanOpenDraft"
          type="button"
          class="ghostButton voiceActionButton"
          @click="openVoiceDraftFallback"
        >
          Abrir borrador
        </button>
      </div>
    </div>

    <div class="voiceWaveform" aria-hidden="true">
      <span
        v-for="(bar, index) in voiceWaveform"
        :key="`wave-${index}`"
        class="voiceWaveBar"
        :style="{ transform: `scaleY(${bar})` }"
      />
    </div>

    <p v-if="voiceTranscript" class="voiceTranscript">{{ voiceTranscript }}</p>
  </section>

  <input
    ref="screenshotInput"
    class="hiddenScreenshotInput"
    type="file"
    accept="image/*,.png,.jpg,.jpeg,.webp,.heic,.heif"
    @change="handleScreenshotSelection"
  />
</template>

<style scoped>
.launcherCard,
.composerCard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: clamp(18px, 4vw, 34px);
  border-radius: 30px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--section-tint-soft) 72%, white), color-mix(in srgb, var(--surface) 92%, white));
  border: 1px solid var(--section-line-strong);
  box-shadow: var(--section-shadow-soft);
}

.launcherPrimaryButton,
.launcherSecondaryButton {
  margin: 0.35rem auto;
  width: min(100%, 420px);
  align-self: center;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0 18px;
  border-radius: 999px;
  border: 4px solid var(--line);
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
}

.launcherPrimaryButton {
  background: color-mix(in srgb, var(--accent) 78%, #10232f);
  color: var(--accent-contrast);
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line));
}

.launcherSecondaryButton {
  background: color-mix(in srgb, var(--surface) 88%, var(--section-tint-soft));
  color: var(--text-main);
}

.composerHeading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid var(--hero-surface-border);
  background: var(--hero-surface);
  box-shadow: var(--hero-surface-shadow);
}

.composerHeadingActions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.composerHeading h2,
.helperText,
.eyebrow {
  margin: 0;
  text-align: left;
}

.composerHeading h2 {
  font-size: clamp(1rem, 3vw, 1.2rem);
  line-height: 1.1;
}

.composerHeading .eyebrow,
.composerHeading h2 {
  color: var(--hero-on);
}

.composerHeading .eyebrow {
  opacity: 0.88;
}

.composerHeading .ghostButton {
  border-color: var(--hero-chip-line);
  background: var(--hero-chip-surface);
  color: var(--hero-on);
}

.eyebrow {
  margin-bottom: 6px;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-strong);
  font-weight: 700;
}

.ghostButton,
.submitButton {
  border-radius: 999px;
  border: 1px solid var(--line);
}

.ghostButton {
  background: var(--secButton);
  color: var(--text-main);
}

.submitButton {
  background: var(--accent);
  color: var(--accent-contrast);
}

.composerForm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(calc(100% - var(--section-body-inset)), var(--section-body-max));
  margin-inline: auto;
}

.primaryField,
.detailField {
  width: 100%;
  border-radius: 18px;
  border: 1px solid var(--line);
  padding: 14px 16px;
  background: var(--surface-soft);
  color: var(--text-main);
  resize: vertical;
  font-size: 16px;
}

.primaryField {
  min-height: 88px;
}

.previewBox {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.templateRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.templateChip {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  color: var(--text-main);
  font-weight: 600;
}

.previewChip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  color: var(--text-main);
  font-size: 0.85rem;
}

.screenshotFeedback {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--line));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  color: var(--text-main);
}

.screenshotFeedback.error {
  border-color: color-mix(in srgb, #8b3a21 32%, var(--line));
  background: color-mix(in srgb, #8b3a21 10%, var(--surface));
}

.screenshotFeedbackMeta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  font-size: 0.92rem;
  text-align: left;
}

.screenshotProgressTrack {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 18%, var(--surface));
}

.screenshotProgressFill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 54%, white));
  transition: width 180ms ease;
}

.voiceFeedback {
  display: grid;
  gap: 12px;
  padding: 16px 0 0;
  border-radius: 0;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
  background: transparent;
  box-shadow: none;
  width: min(calc(100% - var(--section-body-inset)), var(--section-body-max));
  margin-inline: auto;
}

.voiceFeedback.error {
  border-color: color-mix(in srgb, #8b3a21 34%, var(--line));
}

.voiceFeedbackHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.voiceFeedbackHeader strong,
.voiceTranscript {
  display: block;
  text-align: left;
}

.voiceFeedbackActions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.voiceActionButton {
  min-height: 40px;
  padding-inline: 14px;
}

.voiceWaveform {
  display: grid;
  grid-template-columns: repeat(18, minmax(0, 1fr));
  gap: 6px;
  align-items: end;
  min-height: 58px;
}

.voiceWaveBar {
  height: 100%;
  min-height: 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 62%, white), var(--accent));
  transform-origin: center bottom;
  transition: transform 120ms ease;
}

.voiceTranscript {
  margin: 0;
  color: var(--text-main);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.advancedPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.fieldWithAction {
  width: 100%;
  display: grid;
  gap: 8px;
}

.fieldGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  font-weight: 600;
  color: var(--text-main);
}

.wide {
  grid-column: 1 / -1;
}

.checkboxRow {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  color: var(--text-main);
}

.compactToggle {
  font-size: 0.92rem;
  font-weight: 600;
}

.composerActions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.helperText {
  color: var(--text-muted);
  font-size: 0.92rem;
}

.clearFieldButton {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  color: var(--text-main);
}

.fieldError {
  margin: -4px 0 0;
  color: #8b3a21;
  text-align: left;
  font-size: 0.92rem;
  font-weight: 700;
}

.fieldLabel {
  margin: 0 0 -6px;
  text-align: left;
  font-weight: 700;
  color: var(--text-main);
}

.noteComposer-enter-active,
.noteComposer-leave-active {
  transition: opacity 240ms ease, transform 240ms ease, filter 240ms ease;
}

.noteComposer-enter-from,
.noteComposer-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(6px);
}

.hiddenScreenshotInput {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 960px) {
  .launcherPrimaryButton,
  .launcherSecondaryButton {
    width: min(100%, 360px);
  }
}

@media (max-width: 720px) {
  .launcherCard,
  .composerCard {
    gap: 12px;
    padding: 16px 14px;
    border-radius: 24px;
  }

  .primaryField {
    min-height: 76px;
  }

  .composerHeading,
  .composerActions,
  .advancedPanel,
  .composerHeadingActions,
  .voiceFeedbackHeader {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .ghostButton,
  .submitButton,
  .launcherPrimaryButton,
  .launcherSecondaryButton {
    width: 100%;
  }

  .templateRow,
  .previewBox {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .templateRow::-webkit-scrollbar,
  .previewBox::-webkit-scrollbar {
    display: none;
  }

  .templateChip,
  .previewChip {
    flex: 0 0 auto;
  }

  .voiceFeedbackActions {
    width: 100%;
  }

  .voiceFeedbackActions button {
    flex: 1 1 0;
  }

  .helperText {
    display: none;
  }

  .advancedPanel {
    display: grid;
  }
}
</style>
