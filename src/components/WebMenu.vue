<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { DrawerGestureController, NavigationCatalog } from '../domain/navigation';

const props = defineProps({
  currentView: { type: String, default: 'today' },
});

const emit = defineEmits(['navigate']);

const navigationCatalog = new NavigationCatalog();
const drawerGesture = new DrawerGestureController();
const menuOpen = ref(false);
const menuRoot = ref(null);
const utilityOpen = ref(false);
const primaryViews = computed(() => navigationCatalog.getPrimaryViews());
const utilityViews = computed(() => navigationCatalog.getUtilityViews());
const currentUtilityView = computed(() =>
  utilityViews.value.some(view => view.id === props.currentView),
);

const MENU_ICONS = Object.freeze({
  today: 'M12 3.75a.75.75 0 0 1 .75.75v1.1h3.2a2.8 2.8 0 0 1 2.8 2.8v7.6a2.8 2.8 0 0 1-2.8 2.8H8.05a2.8 2.8 0 0 1-2.8-2.8v-7.6a2.8 2.8 0 0 1 2.8-2.8h3.2V4.5a.75.75 0 0 1 .75-.75Zm3.95 4.3H8.05a1.3 1.3 0 0 0-1.3 1.3v.8h10.5v-.8a1.3 1.3 0 0 0-1.3-1.3Zm1.3 3.9H6.75v4.95a1.3 1.3 0 0 0 1.3 1.3h7.9a1.3 1.3 0 0 0 1.3-1.3v-4.95Z',
  'follow-up': 'M12 3.25a8.75 8.75 0 1 1-6.19 2.56A8.72 8.72 0 0 1 12 3.25Zm0 1.5a7.25 7.25 0 1 0 5.13 2.12A7.2 7.2 0 0 0 12 4.75Zm-.75 3.5a.75.75 0 0 1 1.5 0v3.28l2.1 1.22a.75.75 0 1 1-.75 1.3l-2.48-1.43a.75.75 0 0 1-.37-.65V8.25Z',
  calendar: 'M7.75 3.5a.75.75 0 0 1 .75.75V5h7V4.25a.75.75 0 0 1 1.5 0V5h.25A2.75 2.75 0 0 1 20 7.75v9.5A2.75 2.75 0 0 1 17.25 20h-10.5A2.75 2.75 0 0 1 4 17.25v-9.5A2.75 2.75 0 0 1 6.75 5H7V4.25a.75.75 0 0 1 .75-.75ZM5.5 9.5v7.75c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9.5h-13Zm8.75 2.25a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75h4.5Z',
  dashboard: 'M4 6.75A2.75 2.75 0 0 1 6.75 4h3.5A2.75 2.75 0 0 1 13 6.75v3.5A2.75 2.75 0 0 1 10.25 13h-3.5A2.75 2.75 0 0 1 4 10.25v-3.5Zm10.75-2.75h2.5A2.75 2.75 0 0 1 20 6.75v1.5A2.75 2.75 0 0 1 17.25 11h-2.5A2.75 2.75 0 0 1 12 8.25v-1.5A2.75 2.75 0 0 1 14.75 4ZM4 15.75A2.75 2.75 0 0 1 6.75 13h1.5A2.75 2.75 0 0 1 11 15.75v2.5A2.75 2.75 0 0 1 8.25 21h-1.5A2.75 2.75 0 0 1 4 18.25v-2.5ZM14.75 12h2.5A2.75 2.75 0 0 1 20 14.75v3.5A2.75 2.75 0 0 1 17.25 21h-2.5A2.75 2.75 0 0 1 12 18.25v-3.5A2.75 2.75 0 0 1 14.75 12Z',
  settings: 'M10.42 3.97a1.75 1.75 0 0 1 3.16 0l.29.64c.17.38.58.59.99.52l.7-.11a1.75 1.75 0 0 1 1.83 2.57l-.35.61a.96.96 0 0 0 0 .96l.35.61a1.75 1.75 0 0 1-1.83 2.57l-.7-.11a.92.92 0 0 0-.99.52l-.29.64a1.75 1.75 0 0 1-3.16 0l-.29-.64a.92.92 0 0 0-.99-.52l-.7.11a1.75 1.75 0 0 1-1.83-2.57l.35-.61a.96.96 0 0 0 0-.96l-.35-.61A1.75 1.75 0 0 1 8.44 5.02l.7.11c.41.07.82-.14.99-.52l.29-.64ZM12 8.25a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5Z',
  more: 'M12 5.75a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5Zm0 5a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5Zm0 5a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5Z',
  chevron: 'M8.47 9.97a.75.75 0 0 1 1.06 0L12 12.44l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06Z',
});

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

function toggleUtilityMenu() {
  utilityOpen.value = !utilityOpen.value;
}

function getIconPath(iconId) {
  return MENU_ICONS[iconId] ?? MENU_ICONS.more;
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

watch(
  () => props.currentView,
  nextView => {
    if (utilityViews.value.some(view => view.id === nextView)) {
      utilityOpen.value = true;
    }
  },
  { immediate: true },
);

watch(
  () => menuOpen.value,
  nextOpen => {
    if (!nextOpen && !currentUtilityView.value) {
      utilityOpen.value = false;
    }
  },
);
</script>

<template>
  <header ref="menuRoot" class="menuShell">
    <div class="menuBar">
      <button type="button" class="brandButton" @click="navigateTo('today')">
        <img src="../assets/logo.png" alt="Logo de ListEA" class="brandLogo" />
        <div class="brandCopy">
          <strong>ListEA</strong>
          <span>Hoy, seguimiento y calendario</span>
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
      <div class="drawerGroup">
        <p class="drawerGroupLabel">Flujo diario</p>
        <button
          v-for="view in primaryViews"
          :key="view.id"
          type="button"
          class="drawerItem"
          :class="{ active: currentView === view.id }"
          @click="navigateTo(view.id)"
        >
          <span class="drawerIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path :d="getIconPath(view.icon)" />
            </svg>
          </span>
          <span class="drawerItemLabel">{{ view.label }}</span>
        </button>
      </div>

      <div class="drawerGroup drawerGroupSecondary">
        <button
          type="button"
          class="drawerDisclosure"
          :aria-expanded="utilityOpen ? 'true' : 'false'"
          @click="toggleUtilityMenu"
        >
          <span class="drawerDisclosureLabel">
            <span class="drawerIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path :d="getIconPath('more')" />
              </svg>
            </span>
            <span>Mas</span>
          </span>
          <span class="drawerChevron" :class="{ open: utilityOpen }" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path :d="getIconPath('chevron')" />
            </svg>
          </span>
        </button>

        <div v-if="utilityOpen" class="utilityStack">
          <button
            v-for="view in utilityViews"
            :key="view.id"
            type="button"
            class="drawerItem drawerItemSecondary"
            :class="{ active: currentView === view.id }"
            @click="navigateTo(view.id)"
          >
            <span class="drawerIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path :d="getIconPath(view.icon)" />
              </svg>
            </span>
            <span class="drawerItemLabel">{{ view.label }}</span>
          </button>
        </div>
      </div>
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
  padding-top: env(safe-area-inset-top);
  background: color-mix(in srgb, var(--app-bg-solid) 85%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.menuBar {
  width: 100%;
  margin: 0;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 var(--shell-pad-inline);
}

.brandButton {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
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
  width: 94px;
  height: 38px;
  border-radius: 16px;
  object-fit: contain;
  object-position: center;
  display: block;
  padding: 0;
}

.brandCopy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.brandCopy strong {
  font-size: 0.98rem;
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brandCopy span {
  color: var(--text-muted);
  font-size: 0.78rem;
  max-width: min(38vw, 260px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  left: 0;
  transform: translateY(calc(-100% - 18px));
  width: 100%;
  max-height: min(70vh, 520px);
  padding:
    calc(72px + env(safe-area-inset-top))
    var(--shell-pad-inline)
    calc(14px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: color-mix(in srgb, var(--surface) 92%, white);
  transition: transform 220ms ease, opacity 220ms ease;
  box-shadow: 0 20px 50px rgba(18, 28, 44, 0.14);
  z-index: 31;
  overflow-y: auto;
  opacity: 0;
  border-radius: 0 0 32px 32px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-top: 0;
}

.drawer.active {
  transform: translateY(0);
  opacity: 1;
}

.drawerGroup {
  display: grid;
  gap: 8px;
}

.drawerGroupSecondary {
  padding-top: 2px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}

.drawerGroupLabel {
  margin: 0;
  padding: 0 6px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.drawerDisclosure,
.drawerItem {
  min-height: 50px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--text-main);
  text-align: left;
}

.drawerDisclosure,
.drawerItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawerItem {
  justify-content: flex-start;
}

.drawerDisclosureLabel {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.drawerItemLabel {
  font-weight: 700;
}

.drawerIcon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 92%, white);
}

.drawerIcon svg,
.drawerChevron svg {
  width: 18px;
  height: 18px;
}

.drawerIcon path,
.drawerChevron path {
  fill: currentColor;
}

.drawerChevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms ease;
}

.drawerChevron.open {
  transform: rotate(180deg);
}

.utilityStack {
  display: grid;
  gap: 8px;
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

@media (max-width: 900px) {
  .menuBar {
    min-height: 60px;
    gap: 8px;
  }

  .brandLogo {
    width: 84px;
    height: 34px;
    border-radius: 14px;
  }

  .brandCopy span {
    max-width: min(34vw, 180px);
  }
}

@media (max-width: 640px) {
  .menuBar {
    min-height: 56px;
    padding-inline: 12px;
  }

  .drawer {
    padding: calc(68px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
    border-radius: 0 0 24px 24px;
  }

  .brandLogo {
    width: 88px;
    height: 36px;
  }

  .brandCopy span {
    display: none;
  }

  .brandCopy strong {
    font-size: 0.95rem;
  }

  .drawerItem,
  .drawerDisclosure {
    min-height: 46px;
  }
}

@media (max-width: 420px) {
  .brandButton {
    gap: 10px;
  }

  .brandLogo {
    width: 74px;
    height: 30px;
  }

  .brandCopy strong {
    font-size: 0.9rem;
  }

  .menuTrigger {
    width: 42px;
    height: 42px;
    border-radius: 14px;
  }
}
</style>
