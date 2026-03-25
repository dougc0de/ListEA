<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { DrawerGestureController, NavigationCatalog } from '../domain/navigation';

const props = defineProps({
  currentView: { type: String, default: 'today' },
});

const emit = defineEmits(['navigate']);

const navigationCatalog = new NavigationCatalog();
const drawerGesture = new DrawerGestureController();
const menuOpen = ref(false);
const menuRoot = ref(null);
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

function onDocumentPointerDown(event) {
  if (!menuOpen.value) return;

  const root = menuRoot.value;
  if (root && !root.contains(event.target)) {
    closeMenu();
  }
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <header ref="menuRoot" class="menuShell">
    <div class="menuBar">
      <button type="button" class="brandButton" @click="navigateTo('today')">
        <img src="../assets/logo.png" alt="Logo de ListEA" class="brandLogo" />
        <div class="brandCopy">
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
  margin: 1rem;
  margin-left: 2rem;
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
  left: 50%;
  transform: translate(-50%, calc(-100% - 18px));
  width: min(960px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  padding: 84px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface);
  transition: transform 220ms ease, opacity 220ms ease;
  box-shadow: 0 20px 50px rgba(18, 28, 44, 0.14);
  z-index: 31;
  overflow-y: auto;
  opacity: 0;
  border-radius: 0 0 28px 28px;
  border: 1px solid var(--line);
  border-top: 0;
}

.drawer.active {
  transform: translate(-50%, 0);
  opacity: 1;
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

  .drawer {
    width: min(100% - 16px, 960px);
    padding: 80px 14px 14px;
    border-radius: 0 0 22px 22px;
  }

  .brandCopy span {
    display: none;
  }

  .brandCopy strong {
    font-size: 0.95rem;
  }
}
</style>
