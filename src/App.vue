<script setup>
import FooterPage from './components/FooterPage.vue';
import TasksSection from './components/TasksSection.vue';
import WebMenu from './components/WebMenu.vue';
import WelcomeComponent from './components/WelcomeComponent.vue';
</script>

<template>
  <WebMenu />
  <main class="appShell">
    <WelcomeComponent />
    <TasksSection />
  </main>
  <FooterPage />
</template>

<style scoped>
.appShell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
</style>
