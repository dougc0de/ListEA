<script setup>
import { computed, nextTick, ref } from 'vue';
import { QuickCaptureInterpreter } from '../domain/quickCapture';
import { toDateTimeInputValue } from '../domain/tasks';

const emit = defineEmits(['add']);

const title = ref('');
const notes = ref('');
const project = ref('');
const area = ref('');
const dueAt = ref('');
const followUpAt = ref('');
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

const interpreter = new QuickCaptureInterpreter();
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
  if (capturePreview.value.dueAt) items.push(`Fecha detectada: ${new Date(capturePreview.value.dueAt).toLocaleString()}`);
  if (capturePreview.value.followUpAt) items.push(`Seguimiento detectado: ${new Date(capturePreview.value.followUpAt).toLocaleString()}`);
  if (capturePreview.value.project || capturePreview.value.area) {
    items.push(`Area detectada: ${capturePreview.value.project || capturePreview.value.area}`);
  }
  if (capturePreview.value.tags.length) items.push(`Etiquetas: ${capturePreview.value.tags.join(', ')}`);
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

function buildFutureInputValue(daysFromToday = 0, hours = 9, minutes = 0) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysFromToday);
  nextDate.setHours(hours, minutes, 0, 0);
  return toDateTimeInputValue(nextDate);
}

function openComposer() {
  composerOpen.value = true;
  nextTick(() => {
    focusTitleField();
  });
}

function closeComposer() {
  composerOpen.value = false;
  advancedOpen.value = false;
  titleError.value = '';
  recurrenceError.value = '';
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
  dueAt.value = '';
  followUpAt.value = '';
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
}

function applyTemplate(templateId) {
  advancedOpen.value = true;
  titleError.value = '';
  recurrenceError.value = '';

  if (templateId === 'call') {
    title.value = 'Llamar a ';
    notes.value = 'Define el siguiente paso y deja un resumen corto.';
    project.value = 'Clientes';
    area.value = 'Trabajo';
    dueAt.value = '';
    followUpAt.value = '';
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
    dueAt.value = '';
    followUpAt.value = buildFutureInputValue(1, 9, 0);
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
    dueAt.value = '';
    followUpAt.value = '';
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
    dueAt.value = '';
    followUpAt.value = '';
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
  dueAt.value = '';
  followUpAt.value = buildFutureInputValue(2, 9, 0);
  priority.value = 'high';
  status.value = 'waiting';
  effortMinutes.value = '10';
  tags.value = 'cobro, seguimiento';
}

function clearDateField(field) {
  if (field === 'dueAt') {
    dueAt.value = '';
    recurrenceError.value = '';
    return;
  }

  followUpAt.value = '';
}

function onSubmit() {
  const interpreted = capturePreview.value;
  const nextTitle = title.value.trim() || (interpreted.title || '').trim();
  const resolvedDueAt = dueAt.value || interpreted.dueAt;
  const resolvedFollowUpAt = followUpAt.value || interpreted.followUpAt;
  const resolvedStatus = advancedOpen.value
    ? (status.value || interpreted.status || 'active')
    : (interpreted.status || status.value || 'active');
  const effectiveRecurrenceMode = recurrencePreset.value !== 'none' && !resolvedDueAt
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
    notes: notes.value.trim(),
    project: project.value.trim() || interpreted.project || '',
    area: area.value.trim() || interpreted.area || '',
    dueAt: resolvedDueAt,
    followUpAt: resolvedFollowUpAt,
    priority: priority.value || interpreted.priority,
    status: resolvedStatus,
    effortMinutes: effortMinutes.value || interpreted.effortMinutes || 20,
    tags: [tags.value, interpreted.tags.join(',')].filter(Boolean).join(','),
    subtasks: parsedSubtasks.value,
    source: 'manual',
    capturedAt: new Date().toISOString(),
    needsTriage: !advancedOpen.value,
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
</script>

<template>
  <transition name="noteComposer" mode="out-in">
    <button
      v-if="!composerOpen"
      key="launcher"
      type="button"
      class="launcherButtonOnly"
      @click="openComposer"
    >
      Agregar tarea
    </button>

    <section v-else key="composer" class="composerCard">
      <div class="composerHeading">
        <div>
          <p class="eyebrow">Nueva tarea</p>
          <h2>Escribe como si fuera una nota.</h2>
        </div>
        <div class="composerHeadingActions">
          <button type="button" class="ghostButton" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? 'Ocultar detalle' : 'Agregar detalle' }}
          </button>
          <button type="button" class="ghostButton" @click="closeComposer">
            Cerrar
          </button>
        </div>
      </div>

      <form class="composerForm" @submit.prevent="onSubmit">
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
              <input v-model="dueAt" class="detailField" type="datetime-local" @input="recurrenceError = ''" />
              <button v-if="dueAt" type="button" class="clearFieldButton" @click="clearDateField('dueAt')">
                Limpiar
              </button>
            </div>
          </label>

          <label class="fieldGroup">
            <span>Seguimiento</span>
            <div class="fieldWithAction">
              <input v-model="followUpAt" class="detailField" type="datetime-local" />
              <button v-if="followUpAt" type="button" class="clearFieldButton" @click="clearDateField('followUpAt')">
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
          <p class="helperText">Primero idea, luego estructura.</p>
          <button class="submitButton" type="submit">Agregar tarea</button>
        </div>
      </form>
    </section>
  </transition>
</template>

<style scoped>
.launcherButtonOnly,
.composerCard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 28px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
}

.launcherButtonOnly {
  margin: 0.5rem;
  width: clamp(180px, 50%, 320px);
  align-self: center;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  cursor: pointer;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 700;
  font-size: 1rem;
}

.composerHeading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
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

@media (max-width: 960px) {
  .launcherButtonOnly {
    width: min(60%, 280px);
  }
}

@media (max-width: 720px) {
  .launcherButtonOnly,
  .composerCard {
    gap: 12px;
    padding: 12px;
    border-radius: 18px;
  }

  .primaryField {
    min-height: 76px;
  }

  .composerHeading,
  .composerActions,
  .advancedPanel,
  .composerHeadingActions {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .ghostButton,
  .submitButton,
  .launcherButtonOnly {
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

  .helperText {
    display: none;
  }

  .advancedPanel {
    display: grid;
  }
}
</style>
