<script setup>
import { ref } from 'vue';
import AddTask from './AddTask.vue';
import TodoItem from './TodoItem.vue';
import TodoList from './TodoList.vue';

const todos = ref(
    [
        {id: 1, title:'Primer ejemplo', done: false},
    ]
)

function addTodo(title) {
    todos.value.push(
        {
            id: Date.now(), title, done:false}
    )
}

function toggleTodo(id){
    const t =  todos.value.find(t =>t.id===id)
    if (t) t.done = !t.done

}

function removeTodo(id) {
  todos.value = todos.value.filter(t => t.id !== id)
  if (t) t.done = !t.done

}

</script>

<template>

<div class="antesala">
    <p>Coloca las tareas o planes que completarás y luego marcarlas cuando esten terminadas.</p>
</div>

<section class="tasksSection">
    
    <AddTask @add="addTodo" />
    
    <div class="listScroll">
      <TodoList
        :todos="todos"
        @toggle="toggleTodo"
        @remove="removeTodo"
      />
    </div>
  

</section>

</template>

<style scoped>
.tasksSection{
  width:90%;
  max-width:900px;
  margin:24px auto;
  padding:16px;
  border:1px solid #d4d3d3;
  border-radius:2rem;
  background:#fff;
  display:flex;
  flex-direction:column;
  gap:16px;
  box-sizing:border-box;
}

/* scroll interno para la lista */
.listScroll{
  max-height:420px;
  overflow-y:auto;
  padding-right:4px;
  scroll-behavior:smooth;
}

/* opcional: scrollbar bonito (webkit) */
.listScroll::-webkit-scrollbar{ width:8px; }
.listScroll::-webkit-scrollbar-thumb{ background:#d3d3d3; border-radius:8px; }

.empty{ text-align:center; opacity:.75; }
</style>
