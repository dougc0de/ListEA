<script setup>

</script>

<template>
<div class="menu">
<div class="logo">
    <img src="../assets/logo.png" alt="">
</div>
    
<nav>
    <button ref="#">Sobre Nosotos</button>
    <button ref="#">Contactanos</button>
    <button ref="#">Upgrade</button>
</nav>
</div>

</template>

<style scoped>
    .menu{
        display: flex;
        align-items: center;
        background-color: rgb(252, 239, 239);

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
        width: 200px;
        height: 130px;
    }
    .logo img {
        width: 100%;
        height: 100%;
    }

</style>