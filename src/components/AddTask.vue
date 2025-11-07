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
<div class="inputButtonPlans">
<form @submit.prevent="onSubmit">
    <label for="todo-input" class="sr-only">
        Nueva tarea
    </label>
    <textarea
        class="planes"
        id="todo-input" 
        type="text" 
        v-model="title"
        placeholder="¿Que planes hacer?"
        autocomplete="off"></textarea>
    <div class="buttonAdd"> 
    <button class="botonAgregar" type="submit">
        Agregar
    </button>
    </div>
</form>
</div>
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
    padding: 45px 30px;
    border-radius: 10px;
    border: 1px gray solid;
    margin: 0 20px;
    width: 40vw;
}

.botonAgregar {
    background-color: rgb(224, 224, 224);
}

.inputButtonPlans {
    margin: 10px 10px 0px;


}

.buttonAdd{
    margin: 5px;
}

</style>