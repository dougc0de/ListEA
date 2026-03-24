<script setup>
import { computed, ref } from 'vue';
import { DrawerGestureController, NavigationCatalog } from '../domain/navigation';

const props = defineProps({
  currentView: { type: String, default: 'today' },
});

const emit = defineEmits(['navigate']);

const navigationCatalog = new NavigationCatalog();
const drawerGesture = new DrawerGestureController();
const menuOpen = ref(false);
const views = computed(() => navigationCatalog.getMenuViews());

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

function navigateTo(viewId) {
  emit('navigate', viewId);
  closeMenu();
}

function onSwipeStart(event) {
  drawerGesture.begin(event.changedTouches[0].clientX, window.innerWidth);
}

function onSwipeEnd(event) {
  if (drawerGesture.shouldOpen(event.changedTouches[0].clientX)) {
    menuOpen.value = true;
  }
}
</script>

<template>
  <header class="menuShell">
    <div class="menuBar">
      <button type="button" class="brandButton" @click="navigateTo('today')">
        <img src="../assets/logo.png" alt="Logo de ListEA" class="brandLogo" />
        <div class="brandCopy">
          <strong>ListEA</strong>
          <span>Local-first que piensa contigo</span>
        </div>
      </button>

      <button
        type="button"
        class="menuTrigger"
        :class="{ active: menuOpen }"
        aria-label="Abrir menu"
        @click="toggleMenu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>

    <nav class="drawer" :class="{ active: menuOpen }">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        class="drawerItem"
        :class="{ active: currentView === view.id }"
        @click="navigateTo(view.id)"
      >
        {{ view.label }}
      </button>
    </nav>

    <div v-if="menuOpen" class="overlay" @click="closeMenu"></div>

    <div
      class="swipeZone"
      @touchstart.passive="onSwipeStart"
      @touchend.passive="onSwipeEnd"
    ></div>
  </header>
</template>

<style scoped>
.menuShell {
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, var(--app-bg-solid) 85%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.menuBar {
  width: min(960px, calc(100% - 24px));
  margin: 0 auto;
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.brandButton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.brandButton:hover {
  transform: none;
  border-color: transparent;
}

.brandLogo {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 10px 24px rgba(28, 39, 59, 0.12);
}

.brandCopy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.brandCopy span {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.menuTrigger {
  width: 44px;
  height: 44px;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 0;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--surface);
}

.menuTrigger span {
  display: block;
  width: 22px;
  height: 2px;
  margin: 0 auto;
  background: var(--text-main);
  transition: transform 160ms ease, opacity 160ms ease;
}

.menuTrigger.active span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.menuTrigger.active span:nth-child(2) {
  opacity: 0;
}

.menuTrigger.active span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: min(320px, calc(100vw - 18px));
  height: 100vh;
  padding: 92px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface);
  transform: translateX(100%);
  transition: transform 180ms ease;
  box-shadow: -20px 0 50px rgba(18, 28, 44, 0.14);
  z-index: 31;
}

.drawer.active {
  transform: translateX(0);
}

.drawerItem {
  min-height: 52px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--text-main);
  text-align: left;
}

.drawerItem.active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 18, 28, 0.34);
  z-index: 29;
}

.swipeZone {
  position: fixed;
  top: 0;
  right: 0;
  width: 24px;
  height: 100vh;
  z-index: 28;
}

@media (max-width: 640px) {
  .menuBar {
    width: min(100% - 20px, 960px);
  }

  .brandCopy span {
    display: none;
  }

  .brandCopy strong {
    font-size: 0.95rem;
  }
}
</style>
