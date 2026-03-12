<script setup>
import TodoItem from './TodoItem.vue';

const props = defineProps({
  todos: { type: Array, required: true },
  emptyMessage: { type: String, default: 'No hay tareas.' },
  isPremium: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle', 'remove', 'update', 'toggle-subtask']);
</script>

<template>
  <p v-if="props.todos.length === 0" class="empty">
    {{ props.emptyMessage }}
  </p>

  <div class="todo-list" v-else>
    <TodoItem
      v-for="t in props.todos"
      :key="t.id"
      :todo="t"
      :is-premium="props.isPremium"
      @toggle="id => emit('toggle', id)"
      @remove="id => emit('remove', id)"
      @update="payload => emit('update', payload)"
      @toggle-subtask="payload => emit('toggle-subtask', payload)"
    />
  </div>
</template>

<style scoped>
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  margin: 0;
  padding: 40px 18px;
  text-align: center;
  opacity: 0.78;
  border-radius: 20px;
  background: var(--surface);
  border: 1px dashed var(--line);
  color: var(--text-muted);
}
</style>
