<template>
  <footer class="footerpage">
    <p>© 2026 DA. Enterprise, LLC. Datos guardados localmente en este dispositivo.</p>
  </footer>
</template>

<style scoped>
:global(html, body, #app) {
  height: 100%;
  margin: 0;
}

:global(#app) {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.footerpage {
  margin-top: auto;
  background: var(--text-main);
  color: var(--surface);
  padding: 14px 18px;
}

.footerpage p {
  margin: 0;
  text-align: center;
  font-size: 0.88rem;
  font-weight: 600;
}
</style>
