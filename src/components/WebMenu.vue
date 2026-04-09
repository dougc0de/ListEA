<script setup>
import { computed, ref } from 'vue';
import { DrawerGestureController, NavigationCatalog } from '../domain/navigation';

const props = defineProps({
  currentView: { type: String, default: 'home' },
  currentPlanId: { type: String, default: 'free' },
});
const emit = defineEmits(['navigate']);

const menuAbierto = ref(false);
const navigationCatalog = new NavigationCatalog();
const drawerGesture = new DrawerGestureController();
const menuViews = computed(() => navigationCatalog.getMenuViews(props.currentPlanId));

const toggleMenu = () => {
  menuAbierto.value = !menuAbierto.value;
};

const cerrarMenu = () => {
  menuAbierto.value = false;
};

function navigateTo(view) {
  if (view.disabled) return;
  emit('navigate', view.id);
  cerrarMenu();
}

function goHome() {
  emit('navigate', 'home');
  cerrarMenu();
}

function onSwipeStart(event) {
  drawerGesture.begin(event.changedTouches[0].clientX, window.innerWidth);
}

function onSwipeEnd(event) {
  if (drawerGesture.shouldOpen(event.changedTouches[0].clientX)) {
    menuAbierto.value = true;
  }
}
</script>

<template>
  <header class="menu">
    <div class="menuInner">
      <div class="brand">
        <div class="logo">
          <img src="../assets/logo.png" alt="Logo de List-EA">
        </div>
        <div class="brandCopy">
          <strong>ListEA</strong>
          <span>Todo local-first</span>
        </div>
      </div>

      <button
        class="hamburger"
        :class="{ active: menuAbierto }"
        @click="toggleMenu"
        aria-label="Abrir menu"
        type="button"
      >
        <span class="line"></span>
        <span class="line"></span>
        <span class="line"></span>
      </button>
    </div>

    <nav class="navMenu" :class="{ active: menuAbierto }">
      <button
        type="button"
        class="menuPrimary"
        :class="{ active: props.currentView === 'home' }"
        @click="goHome"
      >
        Inicio
      </button>

      <button
        v-for="view in menuViews"
        :key="view.id"
        type="button"
        class="menuPrimary"
        :class="{ active: props.currentView === view.id, disabled: view.disabled }"
        :disabled="view.disabled"
        @click="navigateTo(view)"
      >
        <span>{{ view.label }}</span>
        <small v-if="view.disabled">Premium</small>
      </button>
    </nav>

    <div
      v-if="menuAbierto"
      class="overlay"
      @click="cerrarMenu"
    ></div>

    <div
      class="swipeZone"
      @touchstart.passive="onSwipeStart"
      @touchend.passive="onSwipeEnd"
    ></div>
  </header>
</template>

<style scoped>
.menu {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(14px);
  background: var(--nav-bg);
  border-bottom: 1px solid var(--line);
}

.menuInner {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brandCopy {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.brandCopy strong {
  color: var(--text-main);
}

.brandCopy span {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.logo {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(29, 42, 56, 0.1);
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hamburger {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  background: var(--menu-trigger-bg);
  border: none;
  width: 48px;
  height: 48px;
  padding: 0;
  z-index: 22;
}

.line {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--menu-trigger-line);
  margin: 0 auto;
  transition: all 0.3s ease;
}

.navMenu {
  position: fixed;
  top: 0;
  right: 0;
  width: min(380px, calc(100vw - 18px));
  height: 100vh;
  padding: 108px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--menu-panel-bg);
  color: var(--menu-panel-text);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 21;
}

.navMenu.active {
  transform: translateX(0);
}

.menuPrimary {
  width: 100%;
  text-align: left;
  background: var(--menu-item-bg);
  color: var(--menu-panel-text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 58px;
}

.menuPrimary.active {
  background: var(--menu-item-active);
}

.menuPrimary.disabled {
  opacity: 0.54;
}

.menuPrimary small {
  color: var(--menu-panel-muted);
}

.hamburger.active .line:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.active .line:nth-child(2) {
  opacity: 0;
}

.hamburger.active .line:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.36);
  z-index: 19;
}

.swipeZone {
  position: fixed;
  top: 0;
  right: 0;
  width: 24px;
  height: 100vh;
  z-index: 18;
  pointer-events: auto;
}

@media (max-width: 640px) {
  .menuInner {
    width: min(100% - 20px, 1120px);
    min-height: 74px;
  }

  .brandCopy span {
    display: none;
  }

  .logo {
    width: 52px;
    height: 52px;
  }
}
</style>
