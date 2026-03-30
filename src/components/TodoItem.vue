<script setup>
import { computed, ref, watch } from 'vue';
import { ExecutionAdvisor } from '../domain/insights';
import { TaskAppLaunchResolver } from '../domain/taskAppLaunch';
import { TaskContextPresenter, toDateTimeInputValue } from '../domain/tasks';

const emit = defineEmits(['toggle', 'remove', 'update', 'toggle-subtask', 'task-action', 'open-external']);

const props = defineProps({
  todo: { type: Object, required: true },
  taskActions: { type: Array, default: () => [] },
});

const presenter = new TaskContextPresenter();
const advisor = new ExecutionAdvisor();
const appLaunchResolver = new TaskAppLaunchResolver();

const isEditing = ref(false);
const detailsOpen = ref(false);
const editableTitle = ref(props.todo.title);
const editableNotes = ref(props.todo.notes ?? '');
const editableProject = ref(props.todo.project ?? '');
const editableArea = ref(props.todo.area ?? '');
const editableDueAt = ref(props.todo.dueAt ? props.todo.dueAt.slice(0, 16) : '');
const editableFollowUpAt = ref(props.todo.followUpAt ? props.todo.followUpAt.slice(0, 16) : '');
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

function resetEditors(todo = props.todo) {
  editableTitle.value = todo.title;
  editableNotes.value = todo.notes ?? '';
  editableProject.value = todo.project ?? '';
  editableArea.value = todo.area ?? '';
  editableDueAt.value = toDateTimeInputValue(todo.dueAt);
  editableFollowUpAt.value = toDateTimeInputValue(todo.followUpAt);
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
  },
  { deep: true },
);

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

  emit('update', {
    id: props.todo.id,
    title: nextTitle,
    notes: editableNotes.value,
    project: editableProject.value,
    area: editableArea.value,
    dueAt: editableDueAt.value,
    followUpAt: editableFollowUpAt.value,
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
}

function cancelEdit() {
  resetEditors();
  isEditing.value = false;
}

function clearEditableDate(field) {
  if (field === 'dueAt') {
    editableDueAt.value = '';
    return;
  }

  editableFollowUpAt.value = '';
}

function openExternalAction(action) {
  emit('open-external', {
    taskId: props.todo.id,
    suggestionId: action.id,
  });
}
</script>

<template>
  <article class="taskCard" :class="todo.status">
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
            v-model="editableTitle"
            class="titleEditor"
            rows="2"
            @input="editError = ''"
          />
          <h3 v-else :class="{ completedTitle: todo.isCompleted() }">{{ todo.title }}</h3>
          <span class="statusBadge">{{ presenter.getStatusLabel(todo.status) }}</span>
        </div>

        <div class="chipRow">
          <span v-for="chip in contextChips" :key="chip" class="contextChip">{{ chip }}</span>
          <span class="contextChip recurrenceChip">{{ recurrenceLabel }}</span>
        </div>

        <p v-if="todo.notes && !isEditing" class="notesPreview">{{ todo.notes }}</p>
        <p v-if="detailsOpen || isEditing" class="advisorText">{{ nextAction }}</p>
      </div>
    </div>

    <div class="actionRow">
      <button type="button" class="ghostButton" @click="detailsOpen = !detailsOpen">
        {{ detailsOpen ? 'Ocultar detalle' : 'Ver detalle' }}
      </button>
      <button type="button" class="ghostButton" @click="emit('toggle', todo.id)">
        {{ todo.isCompleted() ? 'Reabrir' : 'Completar' }}
      </button>
      <button v-if="!isEditing" type="button" class="ghostButton" @click="isEditing = true">
        Editar
      </button>
      <button v-if="isEditing" type="button" class="primaryButton" @click="saveTask">
        Guardar
      </button>
      <button v-if="isEditing" type="button" class="ghostButton" @click="cancelEdit">
        Cancelar
      </button>
      <button type="button" class="dangerButton" @click="emit('remove', todo.id)">
        Eliminar
      </button>
    </div>

    <div v-if="!isEditing && taskActions.length" class="taskActionRow">
      <button
        v-for="action in taskActions"
        :key="action.id"
        type="button"
        :class="action.tone === 'primary' ? 'primaryButton' : 'ghostButton'"
        @click="emit('task-action', { taskId: todo.id, actionId: action.id })"
      >
        {{ action.label }}
      </button>
    </div>

    <div v-if="!isEditing && detailsOpen && externalAppActions.length" class="externalActionRow">
      <button
        v-for="action in externalAppActions"
        :key="action.id"
        type="button"
        class="externalActionButton"
        @click="openExternalAction(action)"
      >
        {{ action.label }}
      </button>
    </div>

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
          <input v-model="editableDueAt" class="detailField" type="datetime-local" :disabled="!isEditing" />
          <button v-if="isEditing && editableDueAt" type="button" class="clearFieldButton" @click="clearEditableDate('dueAt')">
            Limpiar
          </button>
        </div>
      </label>

      <label class="fieldGroup">
        <span>Seguimiento</span>
        <div class="fieldWithAction">
          <input v-model="editableFollowUpAt" class="detailField" type="datetime-local" :disabled="!isEditing" />
          <button v-if="isEditing && editableFollowUpAt" type="button" class="clearFieldButton" @click="clearEditableDate('followUpAt')">
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
.contextChip {
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
  font-size: 0.92rem;
}

.completedTitle {
  text-decoration: line-through;
  opacity: 0.7;
}

.actionRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.taskActionRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.externalActionRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 2px;
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

.advisorText {
  font-size: 0.88rem;
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

  .chipRow {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .chipRow::-webkit-scrollbar {
    display: none;
  }

  .actionRow,
  .taskActionRow,
  .externalActionRow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .actionRow button,
  .taskActionRow button,
  .externalActionRow button {
    width: 100%;
  }

  .taskActionRow,
  .externalActionRow {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .taskActionRow::-webkit-scrollbar,
  .externalActionRow::-webkit-scrollbar {
    display: none;
  }

  .taskActionRow button,
  .externalActionRow button {
    width: auto;
    flex: 0 0 auto;
    white-space: nowrap;
  }
}
</style>
