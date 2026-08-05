<template>
  <section class="row">
    <!-- ================= LOGIN BOX ================= -->
    <div v-if="!currentUser" class="card login-card">
      <h3 class="title">Login Required</h3>
      <p class="muted">Sign in using your email and password (validated via <code>/items/user</code>).</p>

      <div class="login-grid">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" />
        </div>
      </div>

      <div class="actions" style="margin-top: 10px">
        <button class="btn btn-save" :disabled="authLoading" @click="manualLogin">
          {{ authLoading ? "Signing in…" : "Login" }}
        </button>
        <button class="btn btn-ghost" :disabled="authLoading" @click="clearFields">Clear</button>
      </div>

      <p v-if="authError" class="error-box">
        {{ authError }}
      </p>
    </div>

    <!-- ================= EDITOR ================= -->
    <div v-else class="card">
      <div class="header-row">
        <h3 class="title">Edit Attendance Log</h3>
        <div class="now-badge">
          <div class="time">{{ nowTime }}</div>
          <div class="date">{{ headerDateStr }}</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar no-print">
        <div class="field">
          <label>Date</label>
          <input type="date" v-model="selectedDate" />
        </div>

        <div class="field">
          <label>Department</label>
          <select v-model.number="deptFilter">
            <option :value="0">All</option>
            <option v-for="d in departments" :key="d.department_id" :value="d.department_id">
              {{ d.department_name }}
            </option>
          </select>
        </div>

        <div class="field field--search">
          <label>Search Employee</label>
          <div class="search-line">
            <input class="search-input" placeholder="Search by name or email" v-model="q" />
            <button type="button" class="btn secondary" @click="showInactive = !showInactive" style="margin-bottom: 0; min-width: max-content; height: 42px;">
              {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
            </button>
          </div>
        </div>

        <div class="field">
          <label>&nbsp;</label>
          <button class="btn btn-ghost" @click="handleLogout" :disabled="authLoading">Logout</button>
        </div>
      </div>

      <div class="table-wrap">
        <div v-if="loading" class="loading-note">Loading attendance…</div>

        <table v-else-if="ready">
          <thead>
          <tr>
            <th style="min-width:220px">Employee</th>
            <th>Time In</th>
            <th>Lunch Start</th>
            <th>Lunch End</th>
            <th>Break Start</th>
            <th>Break End</th>
            <th>Time Out</th>
            <th style="width:260px">Actions</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="row in displayRows" :key="row.key" :class="{ 'is-inactive': !isActiveUser(row.rawUser) }">
            <td>
              <div class="emp">
                <div class="name">
                  {{ row.empName }}
                  <span v-if="!isActiveUser(row.rawUser)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
                </div>
                <div class="dept">{{ row.deptName }}</div>
              </div>
            </td>

            <td><input type="time" step="60" v-model="edit[row.user_id].time_in" /></td>
            <td><input type="time" step="60" v-model="edit[row.user_id].lunch_start" /></td>
            <td><input type="time" step="60" v-model="edit[row.user_id].lunch_end" /></td>
            <td><input type="time" step="60" v-model="edit[row.user_id].break_start" /></td>
            <td><input type="time" step="60" v-model="edit[row.user_id].break_end" /></td>
            <td><input type="time" step="60" v-model="edit[row.user_id].time_out" /></td>

            <td class="actions">
              <button class="btn btn-save" @click="saveRow(row)" :disabled="saving[row.user_id]">
                {{ saving[row.user_id] ? "Saving..." : (row.log_id ? "Save" : "Create") }}
              </button>
              <button class="btn btn-ghost" @click="resetRow(row)" :disabled="saving[row.user_id]">
                Cancel
              </button>
              <button
                  v-if="!row.log_id"
                  class="btn btn-add"
                  @click="createRow(row)"
                  :disabled="saving[row.user_id]"
              >
                Add Log
              </button>
            </td>
          </tr>

          <tr v-if="displayRows.length === 0">
            <td colspan="8">No employees match the selected filters.</td>
          </tr>
          </tbody>
        </table>

        <div v-else class="loading-note">Preparing editor…</div>
      </div>

      <div class="bulk-actions no-print" v-if="ready">
        <button class="btn btn-save" @click="saveAll" :disabled="bulkSaving">
          {{ bulkSaving ? "Saving..." : "Save All Changes" }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import {
  fetchUsers,
  fetchDepartments,
  fetchAttendance,
  updateAttendanceLog,
  createAttendanceLog,
} from "../../services/api";
import { login, getCurrentUser, logout } from "../../services/auth";

/* ========== LOGIN (via /items/user) ========== */
const email = ref("");
const password = ref("");
const authLoading = ref(false);
const authError = ref("");
const currentUser = ref(getCurrentUser());

async function manualLogin() {
  try {
    authLoading.value = true;
    authError.value = "";
    const u = await login(email.value, password.value); // checks /items/user
    currentUser.value = u;
    await bootAfterAuth();
  } catch (e) {
    authError.value =
        e?.message ||
        e?.response?.data?.errors?.[0]?.message ||
        e?.response?.data?.message ||
        "Login failed";
  } finally {
    authLoading.value = false;
  }
}
function clearFields() {
  email.value = "";
  password.value = "";
}
function handleLogout() {
  logout();
  currentUser.value = null;
  users.value = [];
  departments.value = [];
  attendance.value = [];
  ready.value = false;
}

/* ========== EDITOR STATE ========== */
const users = ref([]);           // raw users (includes inactive)
const departments = ref([]);
const attendance = ref([]);

const nowTime = ref(dayjs().format("h:mm:ss A"));
let _nowTimer;

const selectedDate = ref(dayjs().format("YYYY-MM-DD"));
const deptFilter = ref(0);
const q = ref("");
const showInactive = ref(false);

const ready = ref(false);
const loading = ref(false);
const saving = ref({});
const bulkSaving = ref(false);

const headerDateStr = computed(
    () => `${dayjs(selectedDate.value).format("dddd")} - ${dayjs(selectedDate.value).format("MMM D, YYYY")}`
);

/* ----- Inactive / Active detection ----- */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) {
    // Directus binary style {type:'Buffer', data:[0|1]}
    return Number(v.data?.[0] ?? 0) !== 1;
  }
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true; // missing flag => treat as active
}
const activeUsers = computed(() =>
    Array.isArray(users.value) ? users.value.filter(isActiveUser) : []
);

/* Build maps (keep full for safety) */
const userById = computed(() => new Map(users.value.map((u) => [u.user_id, u])));
const departmentById = computed(() => new Map(departments.value.map((d) => [d.department_id, d])));

/* Attendance for selected date */
const rowsForActiveDate = computed(() =>
    attendance.value.filter((a) => a.log_date === selectedDate.value)
);

/* Combined rows: conditionally iterate over ACTIVE users or ALL users */
const combinedRows = computed(() => {
  const presentMap = new Map(rowsForActiveDate.value.map((r) => [r.user_id, r]));
  const baseUsers = showInactive.value ? users.value : activeUsers.value;
  return baseUsers.map((u) => {
    const row = presentMap.get(u.user_id) || null;
    const dept = departmentById.value.get(u.user_department) || {};
    return {
      key: `row-${u.user_id}`,
      user_id: u.user_id,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      deptName: dept.department_name || "",
      log_id: row?.log_id ?? row?.id ?? null,
      time_in: row?.time_in ?? null,
      lunch_start: row?.lunch_start ?? null,
      lunch_end: row?.lunch_end ?? null,
      break_start: row?.break_start ?? null,
      break_end: row?.break_end ?? null,
      time_out: row?.time_out ?? null,
      rawUser: u,
    };
  });
});

const edit = ref({});

/* ===== Normalizers ===== */
function normalizeToHHMM(src) {
  if (src == null || src === "") return "";
  let s = String(src).trim();
  if (s.includes("T")) s = s.split("T")[1];
  if (s.includes(" ")) s = s.split(" ").pop();
  s = s.replace(/Z$/i, "").replace(/[+-]\d{2}:\d{2}$/, "");
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})(\d{2})$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return "";
}
function toSaveDateTime(ymd, hhmm) {
  if (!hhmm) return null;
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const ss = (m[3] || "00").padStart(2, "0");
  return `${ymd}T${hh}:${mm}:${ss}`;
}

/* ===== Helpers ===== */
function initEditState() {
  const obj = {};
  for (const r of combinedRows.value) {
    obj[r.user_id] = {
      time_in: normalizeToHHMM(r.time_in),
      lunch_start: normalizeToHHMM(r.lunch_start),
      lunch_end: normalizeToHHMM(r.lunch_end),
      break_start: normalizeToHHMM(r.break_start),
      break_end: normalizeToHHMM(r.break_end),
      time_out: normalizeToHHMM(r.time_out),
    };
  }
  edit.value = obj;
  ready.value = true;
}
function resetRow(row) {
  edit.value[row.user_id] = {
    time_in: normalizeToHHMM(row.time_in),
    lunch_start: normalizeToHHMM(row.lunch_start),
    lunch_end: normalizeToHHMM(row.lunch_end),
    break_start: normalizeToHHMM(row.break_start),
    break_end: normalizeToHHMM(row.break_end),
    time_out: normalizeToHHMM(row.time_out),
  };
}
function getDeptIdForUser(userId) {
  const u = userById.value.get(userId);
  return u?.user_department ?? null;
}

/* ===== Filters ===== */
const displayRows = computed(() => {
  let rows = combinedRows.value;
  if (deptFilter.value) {
    rows = rows.filter(
        (r) => userById.value.get(r.user_id)?.user_department === deptFilter.value
    );
  }
  if (q.value) {
    const needle = q.value.toLowerCase();
    rows = rows.filter(
        (r) =>
            (r.empName || "").toLowerCase().includes(needle) ||
            (r.deptName || "").toLowerCase().includes(needle) ||
            String(r.user_id).includes(needle)
    );
  }
  return rows;
});

/* ===== Actions ===== */
async function reloadAttendanceOnly() {
  attendance.value = await fetchAttendance();
}
async function saveRow(row) {
  saving.value[row.user_id] = true;
  try {
    const deptId = getDeptIdForUser(row.user_id);
    if (deptId == null) {
      alert(`Cannot save: user ${row.user_id} has no department_id.`);
      return;
    }

    const payload = {
      log_date: selectedDate.value,
      user_id: row.user_id,
      department_id: deptId,
      time_in: toSaveDateTime(selectedDate.value, edit.value[row.user_id].time_in),
      lunch_start: toSaveDateTime(selectedDate.value, edit.value[row.user_id].lunch_start),
      lunch_end: toSaveDateTime(selectedDate.value, edit.value[row.user_id].lunch_end),
      break_start: toSaveDateTime(selectedDate.value, edit.value[row.user_id].break_start),
      break_end: toSaveDateTime(selectedDate.value, edit.value[row.user_id].break_end),
      time_out: toSaveDateTime(selectedDate.value, edit.value[row.user_id].time_out),
    };

    if (row.log_id) {
      await updateAttendanceLog(row.log_id, payload);
    } else {
      const created = await createAttendanceLog(payload);
      row.log_id = created?.log_id ?? created?.id ?? row.log_id;
    }

    await reloadAttendanceOnly();
    initEditState();
  } catch (e) {
    console.error("Save failed:", e?.response?.data ?? e);
    alert("Save failed:\n" + JSON.stringify(e?.response?.data ?? { message: e.message }, null, 2));
  } finally {
    saving.value[row.user_id] = false;
  }
}
async function createRow(row) { return saveRow(row); }
async function saveAll() {
  bulkSaving.value = true;
  try { for (const row of displayRows.value) await saveRow(row); }
  finally { bulkSaving.value = false; }
}

/* ===== Boot ===== */
async function bootAfterAuth() {
  loading.value = true;
  try {
    const [u, d, a] = await Promise.all([fetchUsers(), fetchDepartments(), fetchAttendance()]);
    users.value = u; departments.value = d; attendance.value = a;
    initEditState();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (currentUser.value) await bootAfterAuth();
  _nowTimer = setInterval(() => { nowTime.value = dayjs().format("h:mm:ss A"); }, 1000);
});
onUnmounted(() => { if (_nowTimer) clearInterval(_nowTimer); });
watch([selectedDate, attendance, users, showInactive], () => { if (currentUser.value) { ready.value = false; initEditState(); }});
</script>

<style scoped>
/* Header */
.header-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.title{font-size:22px;font-weight:800;margin:0}
.now-badge{display:inline-flex;flex-direction:column;align-items:flex-end;padding:10px 14px;border-radius:12px;background:#f3f4f6;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.now-badge .time{font-weight:900;font-size:28px;line-height:1.1}
.now-badge .date{font-size:14px;color:#4b5563;margin-top:2px}

/* Login card */
.login-card{max-width:520px;margin:20px auto}
.muted{color:#6b7280;margin:-6px 0 12px}
.login-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:640px){.login-grid{grid-template-columns:1fr}}

/* Toolbar */
.toolbar{display:grid;gap:14px;margin-bottom:10px}
.field label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}
select,.search-input,input[type="text"],input[type="search"],input[type="date"],input[type="time"],input[type="email"],input[type="password"]{
  width:100%;height:42px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px;outline:none;font-size:14px
}
.search-line{display:flex;align-items:center;gap:10px}

/* Table */
.table-wrap{margin-top:10px;overflow-x:auto}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{text-align:left;font-size:12px;color:#667085;font-weight:600;padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
tbody td{padding:12px;border-bottom:1px solid #f0f2f5;font-size:14px}
tbody tr:hover{background:#fafcff}

/* Buttons */
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{height:34px;padding:0 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid transparent;cursor:pointer}
.btn-save{background:#065f46;color:#fff}
.btn-ghost{background:#fff;color:#374151;border-color:#e5e7eb}
.btn-add{background:#2563eb;color:#fff}

/* Bulk actions */
.bulk-actions{margin-top:12px;display:flex;justify-content:flex-end}

/* Employee cell */
.emp .name{font-weight:600;line-height:1.2}
.emp .dept{font-size:12px;color:#667085;line-height:1.2}

/* Notices */
.loading-note{padding:12px;color:#6b7280}
.error-box{margin-top:12px;color:#b42318;background:#fef3f2;border:1px solid #fee2e2;border-radius:10px;padding:10px}

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
