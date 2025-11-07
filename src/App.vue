<script setup>
import FooterPage from './components/FooterPage.vue';
import TasksSection from './components/TasksSection.vue';
import WebMenu from './components/WebMenu.vue';
import WelcomeComponent from './components/WelcomeComponent.vue';


</script>

<template>
  <WebMenu />
  <WelcomeComponent />
  <TasksSection />
  <FooterPage />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
