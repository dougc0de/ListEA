<script setup>
import TodoItem from './TodoItem.vue';

const props = defineProps({todos : {type: Array, required: true}});
const emit = defineEmits(['toggle', 'remove']);
</script>

<template>
  <p v-if="props.todos.length === 0" class="empty">
    No hay tareas. ¡Agrega una! 🌱
  </p>

  <div class="todo-list" v-else>
    <TodoItem
      v-for="t in props.todos"
      :key="t.id"
      :todo="t"
      @toggle="id => emit('toggle', id)"
      @remove="id => emit('remove', id)"
    />
  </div>

</template>

<style scoped>
.todo-list{
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty{
  text-align: center;
  opacity: .75;
  padding: .75rem 0;
}
</style>