<script>

</script>

<template>
    <div class="footerpage">
        <p>© 2025 DA Enterprise LLC. Todos los derechos reservados.</p>
    </div>
</template>

<style scoped>

:global(html,body,#app){height:100%;margin:0}
:global(#app){min-height:100vh;display:flex;flex-direction:column}

:global(#app) {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Haz que el footer baje con margin-top:auto */
.footerpage {
  margin-top: auto;
  background-color: gray;
  color: #fff;
  padding: 9px 10px;
}

.footerpage p {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>