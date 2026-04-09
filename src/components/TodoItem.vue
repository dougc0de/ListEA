<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { ExecutionAdvisor } from '../domain/insights';
import { TaskHealthAnalyzer } from '../domain/operability';
import { TaskAppLaunchResolver } from '../domain/taskAppLaunch';
import {
  TASK_DATE_PRECISION,
  TaskContextPresenter,
  buildTaskDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../domain/tasks';

const emit = defineEmits(['toggle', 'remove', 'update', 'toggle-subtask', 'task-action', 'open-external']);

const props = defineProps({
  todo: { type: Object, required: true },
  taskActions: { type: Array, default: () => [] },
  forceEdit: { type: Boolean, default: false },
});

const presenter = new TaskContextPresenter();
const advisor = new ExecutionAdvisor();
const healthAnalyzer = new TaskHealthAnalyzer();
const appLaunchResolver = new TaskAppLaunchResolver();

const isEditing = ref(false);
const detailsOpen = ref(false);
const overflowOpen = ref(false);
const cardRef = ref(null);
const titleEditorRef = ref(null);
const editableTitle = ref(props.todo.title);
const editableNotes = ref(props.todo.notes ?? '');
const editableProject = ref(props.todo.project ?? '');
const editableArea = ref(props.todo.area ?? '');
const editableDueDate = ref('');
const editableDueTime = ref('');
const editableDueHasTime = ref(false);
const editableFollowUpDate = ref('');
const editableFollowUpTime = ref('');
const editableFollowUpHasTime = ref(false);
const editablePriority = ref(props.todo.priority ?? 'medium');
const editableStatus = ref(props.todo.status ?? 'active');
const editableEnergy = ref(props.todo.energy ?? 'medium');
const editableImpact = ref(props.todo.impact ?? 'medium');
const editableEffort = ref(props.todo.effortMinutes ?? 20);
const editableTags = ref((props.todo.tags ?? []).join(', '));
const editableSubtasks = ref((props.todo.subtasks ?? []).map(subtask => subtask.title).join('\n'));
const editableRecurrencePreset = ref(props.todo.recurrence?.preset ?? 'none');
const editableRecurrenceMode = ref(props.todo.recurrence?.mode ?? 'fixed');
const editableRecurrenceResetNotes = ref(props.todo.recurrence?.resetNotes ?? true);
const editError = ref('');

const contextChips = computed(() => presenter.buildTaskContext(props.todo));
const nextAction = computed(() => advisor.suggest(props.todo));
const taskHealth = computed(() => healthAnalyzer.analyze(props.todo));
const taskGuidance = computed(() => [taskHealth.value.reason, nextAction.value].filter(Boolean).join(' '));
const recurrenceLabel = computed(() => {
  const labels = {
    daily: 'Cada dia',
    weekly: 'Cada semana',
    monthly: 'Cada mes',
    yearly: 'Cada ano',
    weekdays: 'Dias laborables',
    weekends: 'Fines de semana',
    'every-x-days': 'Cada X dias',
    none: 'Sin recurrencia',
  };

  return labels[props.todo.recurrence?.preset ?? 'none'] || 'Sin recurrencia';
});

const subtaskRows = computed(() =>
  props.todo.subtasks.map(subtask => presenter.buildSubtaskContext(props.todo, subtask)),
);
const visibleTags = computed(() => props.todo.tags ?? []);
const subtaskPreviewRows = computed(() => subtaskRows.value.slice(0, 3));
const hiddenSubtaskCount = computed(() => Math.max(subtaskRows.value.length - subtaskPreviewRows.value.length, 0));
const externalAppActions = computed(() => appLaunchResolver.resolve(props.todo));
const primaryTaskAction = computed(() => props.taskActions[0] ?? null);
const secondaryTaskActions = computed(() => props.taskActions.slice(1));
const visibleExternalActions = computed(() => externalAppActions.value.slice(0, 2));
const secondaryExternalActions = computed(() => externalAppActions.value.slice(2));

function setEditableDateParts(dateRef, timeRef, hasTimeRef, value = '', precision = '') {
  dateRef.value = toDateInputValue(value);
  hasTimeRef.value = precision === TASK_DATE_PRECISION.DATETIME;
  timeRef.value = hasTimeRef.value ? toTimeInputValue(value) : '';
}

function resetEditors(todo = props.todo) {
  editableTitle.value = todo.title;
  editableNotes.value = todo.notes ?? '';
  editableProject.value = todo.project ?? '';
  editableArea.value = todo.area ?? '';
  setEditableDateParts(editableDueDate, editableDueTime, editableDueHasTime, todo.dueAt, todo.dueAtPrecision);
  setEditableDateParts(
    editableFollowUpDate,
    editableFollowUpTime,
    editableFollowUpHasTime,
    todo.followUpAt,
    todo.followUpAtPrecision,
  );
  editablePriority.value = todo.priority ?? 'medium';
  editableStatus.value = todo.status ?? 'active';
  editableEnergy.value = todo.energy ?? 'medium';
  editableImpact.value = todo.impact ?? 'medium';
  editableEffort.value = todo.effortMinutes ?? 20;
  editableTags.value = (todo.tags ?? []).join(', ');
  editableSubtasks.value = (todo.subtasks ?? []).map(subtask => subtask.title).join('\n');
  editableRecurrencePreset.value = todo.recurrence?.preset ?? 'none';
  editableRecurrenceMode.value = todo.recurrence?.mode ?? 'fixed';
  editableRecurrenceResetNotes.value = todo.recurrence?.resetNotes ?? true;
  editError.value = '';
}

watch(
  () => props.todo,
  todo => {
    resetEditors(todo);
    if (!isEditing.value) {
      overflowOpen.value = false;
    }
  },
  { deep: true },
);

watch(
  () => props.forceEdit,
  shouldForceEdit => {
    if (!shouldForceEdit || props.todo.isCompleted()) return;
    startEditing();
  },
);

function focusEditor() {
  nextTick(() => {
    cardRef.value?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });
    titleEditorRef.value?.focus?.({ preventScroll: true });
  });
}

function saveTask() {
  const nextTitle = editableTitle.value.trim();
  if (!nextTitle) {
    editError.value = 'Titulo requerido';
    return;
  }

  editError.value = '';

  const currentSubtasksByTitle = new Map(
    props.todo.subtasks.map(subtask => [subtask.title.toLowerCase(), subtask.done]),
  );
  const nextDueAt = buildTaskDateTime(
    editableDueDate.value,
    editableDueTime.value,
    editableDueHasTime.value,
  );
  const nextFollowUpAt = buildTaskDateTime(
    editableFollowUpDate.value,
    editableFollowUpTime.value,
    editableFollowUpHasTime.value,
  );

  emit('update', {
    id: props.todo.id,
    title: nextTitle,
    notes: editableNotes.value,
    project: editableProject.value,
    area: editableArea.value,
    dueAt: nextDueAt.value,
    dueAtPrecision: nextDueAt.precision,
    followUpAt: nextFollowUpAt.value,
    followUpAtPrecision: nextFollowUpAt.precision,
    priority: editablePriority.value,
    status: editableStatus.value,
    energy: editableEnergy.value,
    impact: editableImpact.value,
    effortMinutes: Number(editableEffort.value) || 20,
    tags: editableTags.value,
    subtasks: editableSubtasks.value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
      .map(title => ({
        title,
        done: currentSubtasksByTitle.get(title.toLowerCase()) ?? false,
      })),
    recurrence: {
      preset: editableRecurrencePreset.value,
      interval: editableRecurrencePreset.value === 'every-x-days' ? 3 : 1,
      mode: editableRecurrenceMode.value,
      resetNotes: editableRecurrenceResetNotes.value,
    },
  });

  detailsOpen.value = true;
  isEditing.value = false;
  overflowOpen.value = false;
}

function startEditing() {
  detailsOpen.value = true;
  isEditing.value = true;
  overflowOpen.value = false;
  focusEditor();
}

function cancelEdit() {
  resetEditors();
  isEditing.value = false;
}

function clearEditableDate(field) {
  if (field === 'dueAt') {
    editableDueDate.value = '';
    editableDueTime.value = '';
    editableDueHasTime.value = false;
    return;
  }

  editableFollowUpDate.value = '';
  editableFollowUpTime.value = '';
  editableFollowUpHasTime.value = false;
}

function openExternalAction(action) {
  emit('open-external', {
    taskId: props.todo.id,
    suggestionId: action.id,
  });
}
</script>

<template>
  <article ref="cardRef" class="taskCard" :class="todo.status" :data-task-id="todo.id">
    <div class="taskHeader">
      <label class="checkWrap">
        <input
          type="checkbox"
          :checked="todo.isCompleted()"
          @change="emit('toggle', todo.id)"
        />
      </label>

      <div class="taskCopy">
        <div class="titleRow">
          <textarea
            v-if="isEditing"
            ref="titleEditorRef"
            v-model="editableTitle"
            class="titleEditor"
            rows="2"
            @input="editError = ''"
          />
          <h3 v-else :class="{ completedTitle: todo.isCompleted() }">{{ todo.title }}</h3>
          <span class="statusBadge">{{ presenter.getStatusLabel(todo.status) }}</span>
          <span class="healthBadge" :data-state="taskHealth.state">{{ taskHealth.label }}</span>
        </div>

        <div class="chipRow">
          <span v-for="chip in contextChips" :key="chip" class="contextChip">{{ chip }}</span>
          <span class="contextChip recurrenceChip">{{ recurrenceLabel }}</span>
        </div>

        <p v-if="todo.notes && !isEditing" class="notesPreview">{{ todo.notes }}</p>
        <p v-if="detailsOpen || isEditing" class="advisorText">{{ taskGuidance }}</p>
      </div>
    </div>

    <div v-if="!isEditing" class="actionRow">
      <button
        v-for="action in visibleExternalActions"
        :key="action.id"
        type="button"
        :class="action === visibleExternalActions[0] ? 'primaryButton actionPrimary' : 'ghostButton externalVisibleButton'"
        @click="openExternalAction(action)"
      >
        {{ action.label }}
      </button>
      <button
        v-if="primaryTaskAction"
        type="button"
        :class="primaryTaskAction.tone === 'primary' ? 'primaryButton' : 'ghostButton'"
        @click="emit('task-action', { taskId: todo.id, actionId: primaryTaskAction.id })"
      >
        {{ primaryTaskAction.label }}
      </button>
      <button type="button" class="ghostButton" @click="emit('toggle', todo.id)">
        {{ todo.isCompleted() ? 'Reabrir' : 'Completar' }}
      </button>
      <button type="button" class="ghostButton moreButton" :class="{ active: overflowOpen }" @click="overflowOpen = !overflowOpen">
        {{ overflowOpen ? 'Menos' : 'Mas' }}
      </button>
    </div>

    <div v-else class="actionRow">
      <button type="button" class="primaryButton" @click="saveTask">
        Guardar
      </button>
      <button type="button" class="ghostButton" @click="cancelEdit">
        Cancelar
      </button>
    </div>

    <transition name="overflowSwap">
      <div v-if="!isEditing && overflowOpen" class="overflowPanel">
        <div class="overflowActionGrid">
          <button type="button" class="ghostButton" @click="detailsOpen = !detailsOpen">
            {{ detailsOpen ? 'Ocultar detalle' : 'Ver detalle' }}
          </button>
          <button type="button" class="ghostButton" @click="startEditing">
            Editar
          </button>
          <button
            v-for="action in secondaryTaskActions"
            :key="action.id"
            type="button"
            :class="action.tone === 'primary' ? 'primaryButton' : 'ghostButton'"
            @click="emit('task-action', { taskId: todo.id, actionId: action.id })"
          >
            {{ action.label }}
          </button>
          <button
            v-for="action in secondaryExternalActions"
            :key="action.id"
            type="button"
            class="externalActionButton"
            @click="openExternalAction(action)"
          >
            {{ action.label }}
          </button>
          <button type="button" class="dangerButton" @click="emit('remove', todo.id)">
            Eliminar
          </button>
        </div>
      </div>
    </transition>

    <p v-if="editError" class="editError" role="alert">{{ editError }}</p>

    <div v-if="detailsOpen || isEditing" class="detailsPanel">
      <label class="fieldGroup wide">
        <span>Notas</span>
        <textarea v-model="editableNotes" class="detailField" rows="3" :readonly="!isEditing" />
      </label>

      <label class="fieldGroup">
        <span>Proyecto</span>
        <input v-model="editableProject" class="detailField" type="text" :readonly="!isEditing" />
      </label>

      <label class="fieldGroup">
        <span>Area</span>
        <input v-model="editableArea" class="detailField" type="text" :readonly="!isEditing" />
      </label>

      <label class="fieldGroup">
        <span>Fecha objetivo</span>
        <div class="fieldWithAction">
          <input v-model="editableDueDate" class="detailField" type="date" :disabled="!isEditing" />
          <input
            v-if="editableDueHasTime || isEditing"
            v-model="editableDueTime"
            class="detailField"
            type="time"
            :disabled="!isEditing || !editableDueHasTime"
          />
          <label v-if="isEditing" class="checkboxRow compactToggle">
            <input v-model="editableDueHasTime" type="checkbox" />
            <span>Agregar hora</span>
          </label>
          <button v-if="isEditing && editableDueDate" type="button" class="clearFieldButton" @click="clearEditableDate('dueAt')">
            Limpiar
          </button>
        </div>
      </label>

      <label class="fieldGroup">
        <span>Seguimiento</span>
        <div class="fieldWithAction">
          <input v-model="editableFollowUpDate" class="detailField" type="date" :disabled="!isEditing" />
          <input
            v-if="editableFollowUpHasTime || isEditing"
            v-model="editableFollowUpTime"
            class="detailField"
            type="time"
            :disabled="!isEditing || !editableFollowUpHasTime"
          />
          <label v-if="isEditing" class="checkboxRow compactToggle">
            <input v-model="editableFollowUpHasTime" type="checkbox" />
            <span>Agregar hora</span>
          </label>
          <button v-if="isEditing && editableFollowUpDate" type="button" class="clearFieldButton" @click="clearEditableDate('followUpAt')">
            Limpiar
          </button>
        </div>
      </label>

      <label class="fieldGroup">
        <span>Prioridad</span>
        <select v-model="editablePriority" class="detailField" :disabled="!isEditing">
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </label>

      <label class="fieldGroup">
        <span>Estado</span>
        <select v-model="editableStatus" class="detailField" :disabled="!isEditing">
          <option value="active">Activa</option>
          <option value="blocked">Bloqueada</option>
          <option value="waiting">En espera</option>
        </select>
      </label>

      <label class="fieldGroup">
        <span>Energia</span>
        <select v-model="editableEnergy" class="detailField" :disabled="!isEditing">
          <option value="deep">Profunda</option>
          <option value="medium">Media</option>
          <option value="light">Ligera</option>
        </select>
      </label>

      <label class="fieldGroup">
        <span>Impacto</span>
        <select v-model="editableImpact" class="detailField" :disabled="!isEditing">
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
        </select>
      </label>

      <label class="fieldGroup">
        <span>Esfuerzo (min)</span>
        <input v-model="editableEffort" class="detailField" type="number" min="5" step="5" :readonly="!isEditing" />
      </label>

      <label class="fieldGroup wide">
        <span>Etiquetas</span>
        <input v-model="editableTags" class="detailField" type="text" :readonly="!isEditing" />
      </label>

      <div v-if="!isEditing && visibleTags.length" class="fieldGroup wide">
        <span>Etiquetas visibles</span>
        <div class="tagList">
          <span v-for="tag in visibleTags" :key="tag" class="tagChip">#{{ tag }}</span>
        </div>
      </div>

      <label class="fieldGroup">
        <span>Recurrencia</span>
        <select v-model="editableRecurrencePreset" class="detailField" :disabled="!isEditing">
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
        <select v-model="editableRecurrenceMode" class="detailField" :disabled="!isEditing || editableRecurrencePreset === 'none'">
          <option value="fixed">Fecha original</option>
          <option value="after-completion">Despues de completar</option>
        </select>
      </label>

      <label class="checkboxRow wide">
        <input v-model="editableRecurrenceResetNotes" type="checkbox" :disabled="!isEditing" />
        <span>Limpiar notas transitorias en la siguiente ocurrencia</span>
      </label>

      <label v-if="isEditing" class="fieldGroup wide">
        <span>Subtareas</span>
        <textarea v-model="editableSubtasks" class="detailField" rows="4" />
      </label>

      <div v-else-if="subtaskRows.length" class="fieldGroup wide">
        <span>Subtareas con contexto</span>
        <div class="subtaskList">
          <label v-for="row in subtaskRows" :key="row.id" class="subtaskRow">
            <input
              type="checkbox"
              :checked="row.done"
              @change="emit('toggle-subtask', { taskId: todo.id, subtaskId: row.id })"
            />
            <div>
              <strong :class="{ completedTitle: row.done }">{{ row.title }}</strong>
              <small>{{ row.context }}</small>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div v-if="!isEditing && visibleTags.length" class="tagList">
      <span v-for="tag in visibleTags" :key="`inline-${tag}`" class="tagChip">#{{ tag }}</span>
    </div>

    <div v-if="!isEditing && subtaskPreviewRows.length" class="subtaskPreviewList">
      <div v-for="row in subtaskPreviewRows" :key="`preview-${row.id}`" class="subtaskPreviewItem">
        <strong :class="{ completedTitle: row.done }">{{ row.title }}</strong>
      </div>
      <span v-if="hiddenSubtaskCount" class="subtaskOverflow">+{{ hiddenSubtaskCount }} subtarea(s)</span>
    </div>
  </article>
</template>

<style scoped>
.taskCard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--card-shadow);
}

.taskCard.blocked {
  border-color: color-mix(in srgb, #cf7c34 45%, var(--line));
}

.taskCard.waiting {
  border-color: color-mix(in srgb, #4670aa 45%, var(--line));
}

.taskCard.completed {
  opacity: 0.8;
}

.taskHeader {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.checkWrap {
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
}

.checkWrap input {
  width: 18px;
  height: 18px;
}

.taskCopy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  text-align: left;
}

.titleRow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.titleRow h3 {
  margin: 0;
  font-size: 1.08rem;
  overflow-wrap: anywhere;
}

.titleEditor,
.detailField {
  width: 100%;
  border-radius: 16px;
  border: 1px solid var(--line);
  padding: 12px 14px;
  background: var(--surface-soft);
  color: var(--text-main);
  font-size: 16px;
}

.statusBadge,
.contextChip,
.healthBadge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-main);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.healthBadge[data-state='new'] {
  background: color-mix(in srgb, #6da86a 16%, var(--surface));
}

.healthBadge[data-state='active'] {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.healthBadge[data-state='at-risk'] {
  background: color-mix(in srgb, #e2a85e 20%, var(--surface));
}

.healthBadge[data-state='stalled'] {
  background: color-mix(in srgb, #8f82b5 18%, var(--surface));
}

.healthBadge[data-state='overdue'] {
  background: color-mix(in srgb, #d98164 22%, var(--surface));
}

.healthBadge[data-state='completed'] {
  background: color-mix(in srgb, #6da86a 12%, var(--surface));
}

.recurrenceChip {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.chipRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tagList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tagChip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--text-main);
  font-size: 0.8rem;
  font-weight: 600;
}

.notesPreview,
.advisorText {
  margin: 0;
  color: var(--text-muted);
}

.advisorText {
  font-size: 0.9rem;
}

.completedTitle {
  text-decoration: line-through;
  opacity: 0.7;
}

.actionRow,
.overflowActionGrid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.overflowPanel {
  padding: 12px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-soft) 74%, white);
  border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
}

.overflowActionGrid {
  width: 100%;
}

.actionPrimary {
  flex: 1 1 180px;
}

.externalVisibleButton {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--line));
}

.moreButton.active {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.ghostButton,
.primaryButton,
.dangerButton {
  border-radius: 999px;
  border: 1px solid var(--line);
}

.ghostButton {
  background: var(--surface-soft);
  color: var(--text-main);
}

.primaryButton {
  background: var(--accent);
  color: var(--accent-contrast);
}

.dangerButton {
  background: color-mix(in srgb, #e88d80 18%, var(--surface));
  color: var(--text-main);
}

.detailsPanel {
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
  color: var(--text-main);
  font-weight: 600;
}

.wide {
  grid-column: 1 / -1;
}

.checkboxRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.compactToggle {
  font-size: 0.92rem;
  font-weight: 600;
}

.subtaskList {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.subtaskPreviewList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtaskPreviewItem {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface-soft);
  text-align: left;
}

.subtaskOverflow {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: left;
}

.editError {
  margin: -4px 0 0;
  color: #8b3a21;
  text-align: left;
  font-size: 0.9rem;
  font-weight: 700;
}

.subtaskRow {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--surface-soft);
}

.subtaskRow small {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
  font-weight: 500;
}

.externalActionButton,
.clearFieldButton {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  color: var(--text-main);
  font-weight: 700;
}

.notesPreview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.overflowSwap-enter-active,
.overflowSwap-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.overflowSwap-enter-from,
.overflowSwap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 720px) {
  .taskCard {
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
  }

  .taskHeader {
    gap: 10px;
  }

  .titleRow {
    flex-direction: column;
    align-items: flex-start;
  }

  .detailsPanel {
    grid-template-columns: 1fr;
  }

  .chipRow,
  .actionRow {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .chipRow::-webkit-scrollbar,
  .actionRow::-webkit-scrollbar {
    display: none;
  }

  .actionRow button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .overflowActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overflowActionGrid button {
    width: 100%;
  }
}

@media (max-width: 960px) {
  .detailsPanel {
    grid-template-columns: 1fr;
  }

  .titleRow {
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .taskCard {
    padding: 12px;
    border-radius: 16px;
  }

  .titleRow h3 {
    font-size: 1rem;
  }

  .statusBadge,
  .contextChip,
  .healthBadge,
  .tagChip {
    min-height: 30px;
    font-size: 0.76rem;
  }

  .overflowActionGrid {
    grid-template-columns: 1fr;
  }
}
</style>
