<template>
  <section class="row">
    <div class="card">
      <h3 class="title" style="font-size: 18px; margin-bottom: 12px">Employee Reports</h3>

      <div
          class="toolbar no-print"
          style="display: flex; gap: 12px; flex-wrap: wrap; align-items: end"
      >
        <div>
          <label>Department</label>
          <select v-model.number="department">
            <option :value="0">All</option>
            <option
                v-for="d in departments"
                :key="d.department_id"
                :value="d.department_id"
            >
              {{ d.department_name }}
            </option>
          </select>
        </div>
        <div style="min-width: 260px; flex: 1">
          <label>Search Employee</label>
          <input placeholder="Search by name or email" v-model="q" />
        </div>
        <div>
          <button class="secondary" @click="showInactive = !showInactive" style="margin-bottom: 0;">
            {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
          </button>
        </div>
      </div>

      <div class="spacer"></div>

      <div class="table-wrap">
        <table>
          <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th style="width: 1%">Actions</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="u in filteredEmployees" :key="u.user_id" :class="{ 'is-inactive': !isActiveUser(u) }">
            <td>
              <div class="emp-cell">
                <div class="emp-name">
                  {{ u.user_fname }} {{ u.user_lname }}
                  <span v-if="!isActiveUser(u)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
                </div>
                <div class="emp-pos">{{ u.user_position || "—" }}</div>
              </div>
            </td>
            <td>{{ deptName(u.user_department) }}</td>
            <td>
              <button
                  class="primary"
                  @click="$router.push({ name: 'employee', params: { id: u.user_id } })"
              >
                View Attendance
              </button>
            </td>
          </tr>
          <tr v-if="filteredEmployees.length === 0">
            <td colspan="3">No employees found.</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchUsers, fetchDepartments } from "../../services/api";

const users = ref([]);
const departments = ref([]);
const department = ref(0);
const q = ref("");
const showInactive = ref(false);

/* -------- Inactive detection (same rule as in Today's Attendance) -------- */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) {
    // Directus Buffer style: { type: 'Buffer', data: [0|1,...] }
    return Number(v.data?.[0] ?? 0) !== 1;
  }
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  // If missing, assume active
  return true;
}
const activeUsers = computed(() =>
    Array.isArray(users.value) ? users.value.filter(isActiveUser) : []
);

const deptMap = computed(() => {
  const m = new Map();
  for (const d of departments.value) m.set(d.department_id, d.department_name);
  return m;
});
const deptName = (id) => deptMap.value.get(id) || "";

/* Use ACTIVE users for listing, search and department filtering */
const filteredEmployees = computed(() => {
  let rows = showInactive.value ? [...(users.value || [])] : [...activeUsers.value];
  if (department.value) rows = rows.filter((u) => u.user_department === department.value);
  if (q.value) {
    const needle = q.value.toLowerCase();
    rows = rows.filter(
        (u) =>
            `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.toLowerCase().includes(needle) ||
            String(u.user_id).includes(needle) ||
            (u.user_email || "").toLowerCase().includes(needle)
    );
  }
  return rows;
});

onMounted(async () => {
  const [u, d] = await Promise.all([fetchUsers(), fetchDepartments()]);
  users.value = u;
  departments.value = d;
});
</script>

<style scoped>
.table-wrap table {
  width: 100%;
  border-collapse: collapse;
}
.table-wrap thead th {
  text-align: left;
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  color: #667085;
  font-weight: 600;
}
.table-wrap tbody td {
  padding: 12px;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: top;
  font-size: 14px;
}
.emp-cell {
  line-height: 1.2;
}
.emp-name {
  font-weight: 700;
}
.emp-pos {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
.primary {
  padding: 8px 12px;
  background: #111827;
  color: #fff;
  border: 1px solid #111827;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.primary:hover {
  filter: brightness(1.05);
}
.secondary {
  padding: 8px 12px;
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.secondary:hover {
  background: #e5e7eb;
}
.is-inactive {
  opacity: 0.75;
  background-color: #fef2f2 !important;
}
</style>
