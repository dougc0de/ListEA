<script setup>
import { ref } from 'vue';
import FooterPage from './components/FooterPage.vue';
import TasksSection from './components/TasksSection.vue';
import WebMenu from './components/WebMenu.vue';

const currentView = ref('today');

function changeView(nextView) {
  currentView.value = nextView;
}
</script>

<template>
  <WebMenu :current-view="currentView" @navigate="changeView" />
  <main class="appShell">
    <TasksSection :current-view="currentView" @navigate="changeView" />
  </main>
  <FooterPage />
</template>

<style scoped>
.appShell {
  display: flex;
  flex-direction: column;
  padding: 10px 0 18px;
}
</style>
