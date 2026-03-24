<script setup>
import { computed, ref } from 'vue';
import { QuickCaptureInterpreter } from '../domain/quickCapture';

const emit = defineEmits(['add']);

const title = ref('');
const notes = ref('');
const project = ref('');
const area = ref('');
const dueAt = ref('');
const followUpAt = ref('');
const priority = ref('');
const status = ref('active');
const energy = ref('medium');
const impact = ref('medium');
const effortMinutes = ref('');
const tags = ref('');
const subtasks = ref('');
const recurrencePreset = ref('none');
const recurrenceMode = ref('fixed');
const recurrenceResetNotes = ref(true);
const advancedOpen = ref(false);

const interpreter = new QuickCaptureInterpreter();

const parsedSubtasks = computed(() =>
  subtasks.value
    .split('\n')
    .map(subtask => subtask.trim())
    .filter(Boolean),
);

const capturePreview = computed(() => interpreter.interpret(title.value));

const previewItems = computed(() => {
  const items = [];
  if (capturePreview.value.dueAt) items.push(`Fecha detectada: ${new Date(capturePreview.value.dueAt).toLocaleString()}`);
  if (capturePreview.value.project) items.push(`Proyecto: ${capturePreview.value.project}`);
  if (capturePreview.value.tags.length) items.push(`Tags: ${capturePreview.value.tags.join(', ')}`);
  if (capturePreview.value.priority !== 'medium') items.push(`Prioridad sugerida: ${capturePreview.value.priority}`);
  if (capturePreview.value.recurrence.preset !== 'none') items.push(`Recurrencia: ${capturePreview.value.recurrence.preset}`);
  return items;
});

function resetForm() {
  title.value = '';
  notes.value = '';
  project.value = '';
  area.value = '';
  dueAt.value = '';
  followUpAt.value = '';
  priority.value = '';
  status.value = 'active';
  energy.value = 'medium';
  impact.value = 'medium';
  effortMinutes.value = '';
  tags.value = '';
  subtasks.value = '';
  recurrencePreset.value = 'none';
  recurrenceMode.value = 'fixed';
  recurrenceResetNotes.value = true;
  advancedOpen.value = false;
}

function onSubmit() {
  const interpreted = capturePreview.value;
  const nextTitle = (interpreted.title || title.value).trim();

  if (!nextTitle) return;

  emit('add', {
    title: nextTitle,
    notes: notes.value.trim(),
    project: project.value.trim() || interpreted.project,
    area: area.value.trim() || interpreted.area,
    dueAt: dueAt.value || interpreted.dueAt,
    followUpAt: followUpAt.value,
    priority: priority.value || interpreted.priority,
    status: status.value,
    energy: energy.value,
    impact: impact.value,
    effortMinutes: effortMinutes.value || interpreted.effortMinutes || 20,
    tags: [tags.value, interpreted.tags.join(',')].filter(Boolean).join(','),
    subtasks: parsedSubtasks.value,
    recurrence: {
      ...(recurrencePreset.value === 'none' ? interpreted.recurrence : {
        preset: recurrencePreset.value,
        interval: recurrencePreset.value === 'every-x-days' ? 3 : 1,
        mode: recurrenceMode.value,
        resetNotes: recurrenceResetNotes.value,
      }),
    },
  });

  resetForm();
}
</script>

<template>
  <section class="composerCard">
    <div class="composerHeading">
      <div>
        <p class="eyebrow">Nueva tarea</p>
        <h2>Escribe y guarda.</h2>
      </div>
      <button type="button" class="ghostButton" @click="advancedOpen = !advancedOpen">
        {{ advancedOpen ? 'Ocultar detalle' : 'Agregar detalle' }}
      </button>
    </div>

    <form class="composerForm" @submit.prevent="onSubmit">
      <textarea
        v-model="title"
        class="primaryField"
        rows="3"
        placeholder="Ejemplo: llamar al cliente manana 10am #ventas urgente"
      />

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
          <input v-model="project" class="detailField" type="text" placeholder="Clientes" />
        </label>

        <label class="fieldGroup">
          <span>Area</span>
          <input v-model="area" class="detailField" type="text" placeholder="Trabajo" />
        </label>

        <label class="fieldGroup">
          <span>Fecha objetivo</span>
          <input v-model="dueAt" class="detailField" type="datetime-local" />
        </label>

        <label class="fieldGroup">
          <span>Follow-up</span>
          <input v-model="followUpAt" class="detailField" type="datetime-local" />
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
          <span>Energia</span>
          <select v-model="energy" class="detailField">
            <option value="deep">Profunda</option>
            <option value="medium">Media</option>
            <option value="light">Ligera</option>
          </select>
        </label>

        <label class="fieldGroup">
          <span>Impacto</span>
          <select v-model="impact" class="detailField">
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>
        </label>

        <label class="fieldGroup">
          <span>Esfuerzo en minutos</span>
          <input v-model="effortMinutes" class="detailField" type="number" min="5" step="5" />
        </label>

        <label class="fieldGroup wide">
          <span>Tags</span>
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
          <select v-model="recurrencePreset" class="detailField">
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

        <label class="fieldGroup">
          <span>Base de recurrencia</span>
          <select v-model="recurrenceMode" class="detailField" :disabled="recurrencePreset === 'none'">
            <option value="fixed">Fecha original</option>
            <option value="after-completion">Despues de completar</option>
          </select>
        </label>

        <label class="checkboxRow wide">
          <input v-model="recurrenceResetNotes" type="checkbox" />
          <span>Limpiar notas temporales al crear la siguiente ocurrencia</span>
        </label>
      </div>

      <div class="composerActions">
        <p class="helperText">Natural si quieres, detallada si hace falta.</p>
        <button class="submitButton" type="submit">Agregar tarea</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
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

.composerHeading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
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
  background: var(--surface-soft);
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
}

.primaryField {
  min-height: 88px;
}

.previewBox {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

@media (max-width: 720px) {
  .composerCard {
    padding: 14px;
    border-radius: 22px;
  }

  .composerHeading,
  .composerActions,
  .advancedPanel {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .ghostButton,
  .submitButton {
    width: 100%;
  }

  .advancedPanel {
    display: grid;
  }
}
</style>
