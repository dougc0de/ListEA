<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import FooterPage from './components/FooterPage.vue';
import TasksSection from './components/TasksSection.vue';
import WebMenu from './components/WebMenu.vue';
import { parseLaunchIntentFromLocation, subscribeToLaunchIntents } from './services/launchIntents';

const currentView = ref('today');
const launchIntent = ref(null);
let stopLaunchIntentSubscription = () => {};

function changeView(nextView) {
  currentView.value = nextView;
}

function applyLaunchIntent(nextIntent) {
  if (!nextIntent) return;

  if (nextIntent.view) {
    currentView.value = nextIntent.view;
  }

  launchIntent.value = {
    ...nextIntent,
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

onMounted(() => {
  applyLaunchIntent(parseLaunchIntentFromLocation());
  stopLaunchIntentSubscription = subscribeToLaunchIntents(intent => {
    applyLaunchIntent(intent);
  });
});

onBeforeUnmount(() => {
  stopLaunchIntentSubscription();
});
</script>

<template>
  <WebMenu :current-view="currentView" @navigate="changeView" />
  <main class="appShell">
    <TasksSection
      :current-view="currentView"
      :launch-intent="launchIntent"
      @navigate="changeView"
    />
  </main>
  <FooterPage />
</template>

<style scoped>
.appShell {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding:
    clamp(8px, 1.4vw, 18px)
    0
    max(18px, env(safe-area-inset-bottom));
}

.appShell > * {
  min-width: 0;
}

@media (max-width: 720px) {
  .appShell {
    padding-top: 8px;
  }
}
</style>
