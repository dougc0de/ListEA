<template>
  <section class="welcome">
    <p class="kicker">Lista privada para telefono y escritorio</p>
    <h1><span>List-EA</span></h1>
    <p class="summary">
      Organiza tus pendientes sin nube y con privacidad.
    </p>
  </section>
</template>

<style scoped>
.welcome {
  width: min(1120px, calc(100% - 32px));
  margin: 28px auto 8px;
  text-align: left;
}

.kicker {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent-strong);
}

h1 {
  margin: 0;
}

h1 span {
  font-family: Poppins, Sora, Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  font-weight: 800;
  font-size: clamp(3rem, 8vw, 5.6rem);
  letter-spacing: -0.04em;
  line-height: 0.95;
  display: inline-block;
  color: var(--text-main);
  text-shadow: 0 12px 24px color-mix(in srgb, var(--accent-strong) 20%, transparent);
}

.summary {
  margin: 14px 0 0;
  max-width: 60ch;
  color: var(--text-muted);
  font-size: 1.02rem;
}

@media (max-width: 640px) {
  .welcome {
    width: min(100% - 20px, 1120px);
    margin-top: 22px;
  }
}
</style>
