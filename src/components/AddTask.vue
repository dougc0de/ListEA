<script setup>
import { ref } from 'vue';

const title = ref('');
const emit = defineEmits(['add'])



function onSubmit () {
    const t = title.value.trim()
    if(!t) return
    emit('add', t)
    title.value=''
}

</script>

<template>
<form @submit.prevent="onSubmit">
    <label for="todo-input" class="sr-only">
        Nueva tarea
    </label>
    <input
        id="todo-input" 
        type="text" 
        v-model="title"
        placeholder="Agrega tarea..."
        autocomplete="off">
    <button class="botonAgregar" type="submit">
        Agregar
    </button>
</form>
</template>

<style scoped>
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.botonAgregar {
    margin: 10px ;
}
</style>