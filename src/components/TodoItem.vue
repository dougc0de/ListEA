<script setup>
const emit  = defineEmits(['toggle', 'remove'])
const props = defineProps(
    { todo: {type:Object, required:true}
})

function toggleFunction () {
    emit('toggle', props.todo.id)
}

function removeFunction () {
    emit('remove', props.todo.id)
}


</script>

<template>
    <div class="todo-item">
    <input 
        type="checkbox" 
        :checked="props.todo.done" 
        @change="toggleFunction"
        :aria-checked="props.todo.done ? 'true' : 'false'"
        >

    <span :class = "{ done: props.todo.done }">
        {{ props.todo.title }}
    </span>
        
    <button class="delete" @click="removeFunction" aria-label="Borrar tarea"> 🗑️</button>

</div>

</template>

<style scoped>
.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;                 /* ← Fijado (antes decía 50xpx) */
  padding: 8px 12px;
  border: 1px solid rgb(255, 140, 0);
  border-radius: 10px;
  background: #fff;
}
.done { text-decoration: line-through; opacity: .75; }
.delete {
  margin-left: auto;
  border: none; background: transparent; cursor: pointer;
  font-size: 16px;
}
</style>