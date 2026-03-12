<script setup>
import { computed, ref, watch } from 'vue';

const emit = defineEmits(['toggle', 'remove', 'update', 'toggle-subtask']);
const props = defineProps({
  todo: { type: Object, required: true },
  isPremium: { type: Boolean, default: false },
});

const isEditing = ref(false);
const detailsOpen = ref(false);
const editableTitle = ref(props.todo.title);
const editableNotes = ref(props.todo.notes ?? '');
const editableReminderAt = ref(props.todo.reminderAt ?? '');
const editablePriority = ref(props.todo.priority ?? 'medium');
const editableTags = ref((props.todo.tags ?? []).join(', '));

const subtasksSummary = computed(() => {
  const total = props.todo.subtasks?.length ?? 0;
  const done = props.todo.subtasks?.filter(subtask => subtask.done).length ?? 0;
  return total ? `${done}/${total} subtareas` : 'Sin subtareas';
});

watch(
  () => props.todo,
  todo => {
    editableTitle.value = todo.title;
    editableNotes.value = todo.notes ?? '';
    editableReminderAt.value = todo.reminderAt ?? '';
    editablePriority.value = todo.priority ?? 'medium';
    editableTags.value = (todo.tags ?? []).join(', ');
  },
  { deep: true },
);

function toggleFunction() {
  emit('toggle', props.todo.id);
}

function removeFunction() {
  emit('remove', props.todo.id);
}

function saveFunction() {
  const nextTitle = editableTitle.value.trim();
  if (!nextTitle) return;

  emit('update', {
    id: props.todo.id,
    title: nextTitle,
    notes: editableNotes.value,
    reminderAt: editableReminderAt.value,
    priority: props.isPremium ? editablePriority.value : 'medium',
    tags: props.isPremium ? editableTags.value : [],
  });

  isEditing.value = false;
}

function cancelFunction() {
  editableTitle.value = props.todo.title;
  editableNotes.value = props.todo.notes ?? '';
  editableReminderAt.value = props.todo.reminderAt ?? '';
  editablePriority.value = props.todo.priority ?? 'medium';
  editableTags.value = (props.todo.tags ?? []).join(', ');
  isEditing.value = false;
}
</script>

<template>
  <article class="todo-item" :class="{ completed: props.todo.done }">
    <div class="todoMain">
      <label class="checkWrap">
        <input
          type="checkbox"
          :checked="props.todo.done"
          @change="toggleFunction"
          :aria-checked="props.todo.done ? 'true' : 'false'"
        >
      </label>

      <div class="todoContent">
        <template v-if="isEditing">
          <textarea
            v-model="editableTitle"
            class="editTitle"
            rows="2"
          />
        </template>
        <template v-else>
          <div class="titleRow">
            <h3 :class="{ done: props.todo.done }">
              {{ props.todo.title }}
            </h3>
            <span v-if="props.isPremium" class="priorityBadge" :class="props.todo.priority">
              {{ props.todo.priority }}
            </span>
          </div>
        </template>

        <p v-if="props.todo.reminderAt" class="reminderMeta">
          Recordatorio: {{ new Date(props.todo.reminderAt).toLocaleString() }}
        </p>

        <div v-if="props.isPremium && props.todo.tags?.length" class="tagRow">
          <span v-for="tag in props.todo.tags" :key="tag" class="tagChip">{{ tag }}</span>
        </div>

        <p v-if="props.todo.notes && !detailsOpen && !isEditing" class="snippetPreview">
          {{ props.todo.notes }}
        </p>

        <p v-if="props.isPremium && props.todo.subtasks?.length" class="subtaskMeta">
          {{ subtasksSummary }}
        </p>
      </div>

      <div class="todoActions">
        <button type="button" class="miniAction" @click="detailsOpen = !detailsOpen">
          {{ detailsOpen ? 'Cerrar' : 'Detalle' }}
        </button>
        <button
          v-if="!isEditing"
          type="button"
          class="miniAction"
          @click="isEditing = true"
        >
          Editar
        </button>
        <button
          v-else
          type="button"
          class="miniAction saveAction"
          @click="saveFunction"
        >
          Guardar
        </button>
        <button
          v-if="isEditing"
          type="button"
          class="miniAction"
          @click="cancelFunction"
        >
          Cancelar
        </button>
        <button class="delete" @click="removeFunction" aria-label="Borrar tarea">
          Eliminar
        </button>
      </div>
    </div>

    <div v-if="detailsOpen || isEditing" class="detailsPanel">
      <label class="detailField wideField">
        <span>Snippet privado</span>
        <textarea
          v-model="editableNotes"
          class="detailTextarea"
          rows="4"
          :readonly="!isEditing"
        />
      </label>

      <label class="detailField">
        <span>Fecha y hora</span>
        <input
          v-model="editableReminderAt"
          class="detailInput"
          type="datetime-local"
          :disabled="!isEditing"
        >
      </label>

      <template v-if="props.isPremium">
        <label class="detailField">
          <span>Prioridad</span>
          <select
            v-model="editablePriority"
            class="detailInput"
            :disabled="!isEditing"
          >
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </label>

        <label class="detailField wideField">
          <span>Tags</span>
          <input
            v-model="editableTags"
            class="detailInput"
            type="text"
            :disabled="!isEditing"
            placeholder="trabajo, estudio"
          >
        </label>

        <div v-if="props.todo.subtasks?.length" class="detailField wideField">
          <span>Subtareas</span>
          <div class="subtaskList">
            <label v-for="subtask in props.todo.subtasks" :key="subtask.id" class="subtaskItem">
              <input
                type="checkbox"
                :checked="subtask.done"
                @change="emit('toggle-subtask', { todoId: props.todo.id, subtaskId: subtask.id })"
              >
              <span :class="{ done: subtask.done }">{{ subtask.title }}</span>
            </label>
          </div>
        </div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.todo-item {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  border-radius: 24px;
  background: var(--surface);
  box-shadow: 0 10px 24px rgba(29, 42, 56, 0.05);
}

.todo-item.completed {
  border-color: color-mix(in srgb, var(--accent-strong) 28%, transparent);
  background: var(--surface-muted);
}

.todoMain {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
}

.checkWrap {
  padding-top: 6px;
}

.checkWrap input {
  width: 18px;
  height: 18px;
}

.todoContent {
  min-width: 0;
  text-align: left;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.todoContent h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
  color: var(--text-main);
}

.done {
  text-decoration: line-through;
  opacity: 0.7;
}

.priorityBadge,
.tagChip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.28rem 0.72rem;
  font-size: 0.78rem;
  text-transform: capitalize;
}

.priorityBadge {
  background: var(--surface-soft);
  color: var(--text-main);
}

.priorityBadge.high {
  background: rgba(220, 80, 80, 0.16);
}

.priorityBadge.medium {
  background: rgba(255, 179, 71, 0.18);
}

.priorityBadge.low {
  background: rgba(79, 165, 133, 0.18);
}

.tagRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.tagChip {
  background: var(--surface-soft);
  color: var(--text-muted);
}

.snippetPreview,
.reminderMeta,
.subtaskMeta {
  margin: 8px 0 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.snippetPreview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.editTitle,
.detailTextarea,
.detailInput {
  width: 100%;
  font: inherit;
  border-radius: 14px;
  border: 1px solid var(--line);
  padding: 12px 14px;
  background: var(--surface-muted);
  color: var(--text-main);
}

.todoActions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.miniAction {
  background: var(--surface-soft);
  color: var(--text-main);
  padding-inline: 0.9em;
}

.saveAction {
  background: var(--accent);
  color: var(--text-main);
}

.delete {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--text-main);
  border-color: var(--line);
}

.detailsPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding-top: 2px;
}

.detailField {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  color: var(--text-main);
  font-weight: 600;
}

.wideField {
  grid-column: 1 / -1;
}

.subtaskList {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--surface-muted);
}

.subtaskItem {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: var(--text-main);
}

@media (max-width: 760px) {
  .todoMain {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .todoActions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .detailsPanel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 540px) {
  .todo-item {
    padding: 16px;
    border-radius: 20px;
  }

  .todoActions button {
    width: 100%;
  }
}
</style>
