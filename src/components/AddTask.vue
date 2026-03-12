<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  isPremium: { type: Boolean, default: false },
  templates: { type: Array, default: () => [] },
});

const title = ref('');
const notes = ref('');
const reminderAt = ref('');
const priority = ref('medium');
const tags = ref('');
const subtasks = ref('');
const advancedOpen = ref(false);
const emit = defineEmits(['add', 'apply-template']);

const parsedSubtasks = computed(() =>
  subtasks.value
    .split('\n')
    .map(subtask => subtask.trim())
    .filter(Boolean),
);

function onSubmit() {
  const t = title.value.trim();
  if (!t) return;

  emit('add', {
    title: t,
    notes: notes.value.trim(),
    reminderAt: reminderAt.value,
    priority: props.isPremium ? priority.value : 'medium',
    tags: props.isPremium ? tags.value : '',
    subtasks: props.isPremium ? parsedSubtasks.value : [],
  });

  title.value = '';
  notes.value = '';
  reminderAt.value = '';
  priority.value = 'medium';
  tags.value = '';
  subtasks.value = '';
  advancedOpen.value = false;
}
</script>

<template>
  <div class="inputButtonPlans">
    <div v-if="props.isPremium && props.templates.length" class="templateRow">
      <button
        v-for="template in props.templates"
        :key="template.id"
        type="button"
        class="templateChip"
        @click="emit('apply-template', template.id)"
      >
        {{ template.name }}
      </button>
    </div>

    <form class="taskComposer" @submit.prevent="onSubmit">
      <label for="todo-input" class="sr-only">
        Nueva tarea
      </label>
      <textarea
        id="todo-input"
        v-model="title"
        class="planes"
        placeholder="Que quieres hacer hoy?"
        autocomplete="off"
        rows="3"
      />

      <div class="composerActions" :class="{ stacked: advancedOpen }">
        <button
          type="button"
          class="toggleAdvanced"
          @click="advancedOpen = !advancedOpen"
        >
          {{ advancedOpen ? 'Ocultar detalle' : 'Agregar detalle' }}
        </button>

        <button class="botonAgregar" type="submit">
          Agregar
        </button>
      </div>

      <div v-if="advancedOpen" class="advancedPanel" :class="{ premiumGrid: props.isPremium }">
        <label class="fieldGroup wideField">
          <span>Snippet privado</span>
          <textarea
            v-model="notes"
            class="notesField"
            rows="4"
            placeholder="Ejemplo: contexto, pasos rapidos, links o ideas"
          />
        </label>

        <label class="fieldGroup">
          <span>Fecha y hora</span>
          <input
            v-model="reminderAt"
            class="dateField"
            type="datetime-local"
          >
        </label>

        <template v-if="props.isPremium">
          <label class="fieldGroup">
            <span>Prioridad</span>
            <select v-model="priority" class="selectField">
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </label>

          <label class="fieldGroup">
            <span>Tags</span>
            <input
              v-model="tags"
              class="dateField"
              type="text"
              placeholder="trabajo, salud, urgente"
            >
          </label>

          <label class="fieldGroup wideField">
            <span>Subtareas</span>
            <textarea
              v-model="subtasks"
              class="notesField"
              rows="4"
              placeholder="Una subtarea por linea"
            />
          </label>
        </template>
      </div>
    </form>
  </div>
</template>

<style scoped>
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

.inputButtonPlans {
  padding: 22px;
  border-radius: 28px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 12px 28px rgba(29, 42, 56, 0.06);
}

.templateRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.templateChip {
  background: var(--surface-soft);
  color: var(--text-main);
}

.taskComposer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.planes,
.notesField,
.dateField,
.selectField {
  width: 100%;
  border-radius: 18px;
  border: 1px solid var(--line);
  padding: 16px 18px;
  font: inherit;
  resize: vertical;
  background: var(--surface-muted);
  color: var(--text-main);
}

.planes {
  min-height: 108px;
}

.composerActions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.composerActions.stacked {
  flex-direction: column;
  align-items: stretch;
}

.composerActions.stacked .botonAgregar {
  order: 2;
}

.toggleAdvanced {
  background: var(--surface-soft);
  color: var(--text-main);
}

.botonAgregar {
  background: var(--accent);
  color: var(--text-main);
}

.advancedPanel {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr);
  gap: 16px;
}

.advancedPanel.premiumGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fieldGroup {
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

@media (max-width: 720px) {
  .inputButtonPlans {
    padding: 18px;
    border-radius: 22px;
  }

  .advancedPanel,
  .advancedPanel.premiumGrid {
    grid-template-columns: 1fr;
  }

  .composerActions {
    align-items: stretch;
  }

  .composerActions button {
    width: 100%;
  }
}
</style>
