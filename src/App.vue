<template>
  <div class="layout">
    <Sidebar :isOpen="sidebarOpen" @close="sidebarOpen = false" />
    <!-- shift content only when sidebar is open -->
    <div class="content" :class="{ shifted: sidebarOpen }">
      <header class="topbar no-print">
        <button
          class="hamburger"
          @click="toggleSidebar"
          aria-label="Toggle menu"
          :aria-expanded="sidebarOpen"
          aria-controls="sidebar"
        >
          ☰
        </button>
        <h1 class="topbar-title">Attendance Report</h1>
        <div></div>
      </header>
      <main class="main">
        <div class="container"><router-view /></div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import Sidebar from "./components/Sidebar.vue";

const sidebarOpen = ref(false);
const toggleSidebar = () => (sidebarOpen.value = !sidebarOpen.value);

onMounted(() => {
  // start open on wide screens if you like; keep toggle working everywhere
  if (window.innerWidth >= 960) sidebarOpen.value = true;
});
</script>
