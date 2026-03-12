<script setup>
import { ref } from 'vue';
import FooterPage from './components/FooterPage.vue';
import TasksSection from './components/TasksSection.vue';
import WebMenu from './components/WebMenu.vue';
import WelcomeComponent from './components/WelcomeComponent.vue';

const currentView = ref('home');
const currentPlanId = ref('free');

function changeView(nextView) {
  currentView.value = nextView;
}

function syncPlan(planId) {
  currentPlanId.value = planId;
}
</script>

<template>
  <WebMenu
    :current-view="currentView"
    :current-plan-id="currentPlanId"
    @navigate="changeView"
  />
  <main class="appShell">
    <WelcomeComponent />
    <TasksSection
      :current-view="currentView"
      @navigate="changeView"
      @plan-change="syncPlan"
    />
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
