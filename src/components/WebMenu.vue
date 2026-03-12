<script setup>
import { ref } from 'vue';

const menuAbierto = ref(false);

const toggleMenu = () => {
  menuAbierto.value = !menuAbierto.value;
};

const cerrarMenu = () => {
  menuAbierto.value = false;
};
</script>

<template>
  <header class="menu">
    <div class="menuInner">
      <div class="brand">
        <div class="logo">
          <img src="../assets/logo.png" alt="Logo de List-EA">
        </div>
        <div class="brandCopy">
          <strong>List-EA</strong>
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
      <button type="button" @click="cerrarMenu">Privacidad local</button>
      <button type="button" @click="cerrarMenu">Recordatorios</button>
      <button type="button" @click="cerrarMenu">Responsive ready</button>
    </nav>

    <div
      v-if="menuAbierto"
      class="overlay"
      @click="cerrarMenu"
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
  background: var(--text-main);
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
  background: white;
  margin: 0 auto;
  transition: all 0.3s ease;
}

.navMenu {
  position: fixed;
  top: 0;
  right: -320px;
  width: min(320px, calc(100vw - 24px));
  height: 100vh;
  padding: 108px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--text-main);
  transition: right 0.3s ease;
  z-index: 21;
}

.navMenu.active {
  right: 0;
}

.navMenu button {
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.08);
  color: white;
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
