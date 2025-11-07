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

 <div class="divisor"></div>   
<form @submit.prevent="onSubmit">
    <label for="todo-input" class="sr-only">
        Nueva tarea
    </label>
    <input
        class="planes"
        id="todo-input" 
        type="text" 
        v-model="title"
        placeholder="¿Que planes hacer?"
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

.divisor {
    margin: 2px;
}

.planes {
    padding: 12px;
    border-radius: 10px;
    border: 1px gray solid;
    margin: 0 10px;
}

.botonAgregar {
    background-color: rgb(224, 224, 224);
}
</style>