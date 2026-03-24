<script setup>
import TodoItem from './TodoItem.vue';

const props = defineProps({
  todos: { type: Array, required: true },
  emptyMessage: { type: String, default: 'No hay tareas.' },
});

const emit = defineEmits(['toggle', 'remove', 'update', 'toggle-subtask']);
</script>

<template>
  <p v-if="props.todos.length === 0" class="empty">
    {{ props.emptyMessage }}
  </p>

  <div v-else class="todoList">
    <TodoItem
      v-for="todo in props.todos"
      :key="todo.id"
      :todo="todo"
      @toggle="emit('toggle', $event)"
      @remove="emit('remove', $event)"
      @update="emit('update', $event)"
      @toggle-subtask="emit('toggle-subtask', $event)"
    />
  </div>
</template>

<style scoped>
.todoList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  margin: 0;
  padding: 22px 18px;
  border-radius: 18px;
  border: 1px dashed var(--line);
  background: var(--surface-soft);
  color: var(--text-muted);
  text-align: center;
}
</style>
