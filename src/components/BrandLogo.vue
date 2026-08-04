<script setup lang="ts">
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<template><img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" /></template>

<style scoped>
.brand-logo { width: 36px; height: 36px; flex: none; }
</style>
