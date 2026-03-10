<template>
  <aside :class="['sidebar', { open: isOpen }]">
    <div class="brand">
      <span class="logo">{{ logoText }}</span>
      <div class="brand-text">
        <strong>{{ companyName }}</strong>
        <!-- <small>Attendance Report</small> -->
      </div>
    </div>
    <nav>
      <!-- Attendance Report Menu -->
      <button
        class="nav-item parent"
        @click="toggleAttendanceReport"
        aria-expanded="attendanceReport"
      >
        <div class="parent-title">
          <span class="parent-icon">📋</span>
          <span>Attendance Report</span>
        </div>
        <span class="chev" :class="{ rot: attendanceReport }">▾</span>
      </button>
      <div v-if="attendanceReport" class="children">
        <router-link
          class="nav-item child"
          :class="{ active: $route.name === 'todays-attendance' }"
          :to="{ name: 'todays-attendance' }"
        >
          Todays Attendance
        </router-link>
        <router-link
          class="nav-item child"
          :class="{ active: $route.name === 'employee-reports' }"
          :to="{ name: 'employee-reports' }"
        >
          Employee Reports
        </router-link>
        <router-link
          class="nav-item child"
          :class="{ active: $route.name === 'department-reports' }"
          :to="{ name: 'department-reports' }"
        >
          Department Reports
        </router-link>
        <router-link
          class="nav-item child"
          :class="{ active: $route.name === 'summary-reports' }"
          :to="{ name: 'summary-reports' }"
        >
          Summary Reports
        </router-link>

        <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'manage-attendance' }"
            :to="{ name: 'manage-attendance' }"
        >
          Manage Attendance
        </router-link>

        <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'edit-attendance' }"
            :to="{ name: 'edit-attendance' }"
        >
          Edit Attendance
        </router-link>
                <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'edit-employee-attendance' }"
            :to="{ name: 'edit-employee-attendance' }"
        >
          Edit Employee Attendance
        </router-link>
      </div>

      <button
        class="nav-item parent"
        @click="toggleWageManagement"
        aria-expanded="wageManagement"
      >
        <div class="parent-title">
          <span class="parent-icon">📋</span>
          <span>EDIT Attendance</span>  
        </div>
        <span class="chev" :class="{ rot: wageManagement }">▾</span>
      </button>
        <div v-if="wageManagement" class="children">
          <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'manage-approved-attendance-employee' }"
            :to="{ name: 'manage-approved-attendance-employee' }"
          >
            MANAGE APPROVED ATTENDANCE (EMPLOYEE)
          </router-link>
        </div> 

        <div v-if="wageManagement" class="children">
          <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'manage-approved-attendance-daily' }"
            :to="{ name: 'manage-approved-attendance-daily' }"
          >
            MANAGE APPROVED ATTENDANCE (DAILY)
          </router-link>
        </div> 
        
                <div v-if="wageManagement" class="children">
          <router-link
            class="nav-item child"
            :class="{ active: $route.name === 'manage-approved-attendance-cutoff' }"
            :to="{ name: 'manage-approved-attendance-cutoff' }"
          >
            MANAGE APPROVED ATTENDANCE (CUTOFF)
          </router-link>
        </div> 

      
    </nav>
  </aside>
</template>

<script setup>
import { ref, computed } from "vue";
defineProps({ isOpen: { type: Boolean, default: false } });

const companyName = import.meta.env.VITE_COMPANY_NAME || "Attendance Report";
const logoText = computed(() => {
  if (!companyName) return "AR";
  return companyName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
});

const attendanceReport = ref(false);
const wageManagement = ref(false);
const toggleAttendanceReport = () => (attendanceReport.value = !attendanceReport.value);
const toggleWageManagement = () => (wageManagement.value = !wageManagement.value);
</script>
