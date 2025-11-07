<script setup>
import { ref } from 'vue'

// Estado reactivo del menú
const menuAbierto = ref(false)

// Métodos
const toggleMenu = () => {
  menuAbierto.value = !menuAbierto.value
}

const cerrarMenu = () => {
  menuAbierto.value = false
}
</script>

<template>
<div class="menu">
<div class="logo">
    <img src="../assets/logo.png" alt="">
</div>
<button 
    class="hamburger" :class=" {'active': menuAbierto }"
    @click="toggleMenu"
>
    <span class="line"></span>
    <span class="line"></span>
</button>
</div>

<!-- 
<nav class="nav-Menu" id="navMenu">
    <button ref="#">Sobre Nosotos</button>
    <button ref="#">Contactanos</button>
    <button ref="#">Upgrade</button>
</nav> -->

<div 
    v-if="menuAbierto" 
    class="overlay" 
    @click="cerrarMenu"
  ></div>


</template>

<style scoped>
    .menu{
        display: flex;
        align-items: center;
        background-color: rgb(252, 239, 239);
        width: 100%;
        height: 85px;
        

    }
    
    nav {
        display: flex;
        flex-direction: row;
        gap: 1rem;

    }

    nav button {
        background-color: orange;
        color: white;
        padding: 1rem 0.5rem;
    }

    .logo{
        width: 150px;
        height: 100px;
        margin: 0 30px;
        margin-top: 5px;
    }
    .logo img {
        width: 100%;
        height: 100%;
    }

 .hamburger {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #333;
  border: none;
  padding: 10px;
  cursor: pointer;
  z-index: 1000;
  border-radius: 5px;
}

.line {
  display: block;
  width: 25px;
  height: 3px;
  background: white;
  margin: 5px 0;
  transition: all 0.3s ease;
}

.nav-menu {
  position: fixed;
  top: 0;
  right: -300px;
  width: 300px;
  height: 100vh;
  background: #333;
  transition: right 0.3s ease;
  z-index: 999;
  padding: 80px 20px 20px;
}

.nav-menu.active {
  right: 0;
}

.hamburger.active .line:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.active .line:nth-child(2) {
  opacity: 0;
}

.hamburger.active .line:nth-child(3) {
  transform: rotate(-45deg) translate(7px, -6px);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

/* Estilos del menú */
.nav-menu ul {
  list-style: none;
}

.nav-menu li {
  margin-bottom: 15px;
}

.nav-menu a {
  color: white;
  text-decoration: none;
  font-size: 18px;
  display: block;
  padding: 10px;
  border-radius: 5px;
  transition: background 0.3s ease;
}

.nav-menu a:hover {
  background: #555;
}

</style>