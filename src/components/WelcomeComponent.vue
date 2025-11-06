<script setup>

let name = prompt('Coloca tu nombre: ');

</script>

<template>
    <h1> <span>List-EA </span> </h1>
    <h3> Bienvenido {{ name }}</h3>

</template>

<style scoped> 


h1 span {
font-family: Poppins, Sora, Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  font-weight: 800;
  font-size: clamp(36px, 6vw, 64px);
  letter-spacing: .2px;
  line-height: 1;
  display: inline-block;
  text-shadow:
    0 1px 0 rgba(0,0,0,.04),
    0 12px 24px rgba(229,57,53,.22); /* glow rojo sutil */
}

/* “List” con degradado rojo */
.logo-word{
  background: linear-gradient(180deg, #E53935 10%, #C62828 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* “EA” rojo profundo + subrayado cálido */
.logo-ea{
  color: #C62828;
  letter-spacing: .6px;
  position: relative;
  padding-inline: 2px;
}
.logo-ea::after{
  content: "";
  position: absolute;
  left: -2px; right: -2px;
  bottom: -6px;
  height: 6px;
  background: #FDECEC;                     /* subrayado */
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(229,57,53,.12);
}

</style>