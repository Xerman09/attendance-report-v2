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

      <p v-if="authError" class="error-box">{{ authError }}</p>
    </div>

    <!-- ================= PER DAY APPROVAL ================= -->
    <div v-else class="card">
      <div class="header-row">
        <div class="header-left">
          <h3 class="title">Attendance Approval</h3>
          <p class="subtitle">Per-day approved minutes (Department #4 only)</p>
        </div>

        <div class="header-right">
          <button class="btn btn-ghost logout-btn" @click="handleLogout" :disabled="authLoading">
            Logout
          </button>

          <div class="now-badge">
            <div class="time">{{ nowTime }}</div>
            <div class="date">{{ headerDateStr }}</div>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar no-print">
        <div class="field">
          <label>Date</label>
          <div class="date-row">
            <button class="btn btn-ghost btn-square" @click="prevDay" :disabled="loading">‹</button>
            <input type="date" v-model="selectedDate" :disabled="loading" />
            <button class="btn btn-ghost btn-square" @click="nextDay" :disabled="loading">›</button>
          </div>
        </div>

        <div class="field field--search">
          <label>Search Employee</label>
          <input class="search-input" placeholder="Search by name / id" v-model="q" />
        </div>

        <div class="field">
          <label>&nbsp;</label>
          <button class="btn btn-save btn-wide" @click="saveAll" :disabled="bulkSaving || loading">
            {{ bulkSaving ? "Saving..." : "Save All Changes" }}
          </button>
        </div>
      </div>

      <div class="table-wrap">
        <div v-if="loading" class="loading-note">Loading approvals…</div>

        <table v-else>
          <thead>
            <tr>
              <th style="min-width:240px">Employee</th>
              <th style="width:150px">Work (mins)</th>
              <th style="width:150px">Late (mins)</th>
              <th style="width:180px">Undertime (mins)</th>
              <th style="width:180px">Overtime (mins)</th>
              <th style="min-width:260px">Remarks</th>
              <th style="width:150px">Status</th>
              <th style="width:240px">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="r in displayRows"
              :key="r._key"
              :class="{ 'row-missing': r.isMissing }"
            >
              <td>
                <div class="emp">
                  <div class="name">
                    {{ r.empName }}
                    <span v-if="r.isMissing" class="missing-tag">missing</span>
                  </div>
                  <div class="sub">#{{ r.employee_id }} • Dept 4</div>
                </div>
              </td>

              <td>
                <input class="min-input" type="number" min="0" v-model.number="edit[r._key].work_minutes" />
              </td>
              <td>
                <input class="min-input" type="number" min="0" v-model.number="edit[r._key].late_minutes" />
              </td>
              <td>
                <input class="min-input" type="number" min="0" v-model.number="edit[r._key].undertime_minutes" />
              </td>
              <td>
                <input class="min-input" type="number" min="0" v-model.number="edit[r._key].overtime_minutes" />
              </td>

              <td>
                <input class="remarks-input" type="text" placeholder="Optional remarks" v-model="edit[r._key].remarks" />
              </td>

              <td>
                <select class="status-select" v-model="edit[r._key].status">
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </td>

              <td class="actions">
                <button
                  class="btn btn-save"
                  :disabled="savingKey === r._key"
                  @click="saveRow(r)"
                >
                  {{ savingKey === r._key ? "Saving..." : (r.isMissing ? "Create & Save" : "Save") }}
                </button>

                <button
                  class="btn btn-ghost"
                  :disabled="savingKey === r._key"
                  @click="resetRow(r)"
                >
                  Reset
                </button>
              </td>
            </tr>

            <tr v-if="displayRows.length === 0">
              <td colspan="8">No employees match your search.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import {
  fetchUsers,
  fetchAttendanceApprovalsByDate,
  createAttendanceApproval,
  updateAttendanceApproval,
} from "../../services/api";
import { login, getCurrentUser, logout } from "../../services/auth";

/* ========== LOGIN ========== */
const email = ref("");
const password = ref("");
const authLoading = ref(false);
const authError = ref("");
const currentUser = ref(getCurrentUser());

async function manualLogin() {
  try {
    authLoading.value = true;
    authError.value = "";
    const u = await login(email.value, password.value);
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
  approvals.value = [];
}

/* ========== STATE ========== */
const users = ref([]);
const approvals = ref([]);
const loading = ref(false);

const savingKey = ref("");
const bulkSaving = ref(false);

const selectedDate = ref(dayjs().format("YYYY-MM-DD"));
const q = ref("");

const nowTime = ref(dayjs().format("h:mm:ss A"));
let _nowTimer;

const headerDateStr = computed(() => {
  const d = dayjs(selectedDate.value);
  return `${d.format("dddd")} - ${d.format("MMM D, YYYY")}`;
});

/* Dept constraint */
const DEPT_ID = 4;

/* Active user detection */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) return Number(v.data?.[0] ?? 0) !== 1;
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true;
}

const dept4Users = computed(() => {
  return (Array.isArray(users.value) ? users.value : [])
    .filter(isActiveUser)
    .filter((u) => Number(u.user_department) === DEPT_ID);
});

const approvalsByEmployeeId = computed(() => {
  const m = new Map();
  for (const a of approvals.value || []) {
    m.set(Number(a.employee_id), a);
  }
  return m;
});

/* Build rows for ALL dept4 users */
const rows = computed(() => {
  const list = dept4Users.value.map((u) => {
    const empId = Number(u.user_id);
    const a = approvalsByEmployeeId.value.get(empId) || null;

    const empName = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
    const approvalId = a?.approval_id ?? a?.id ?? null;

    return {
      _key: approvalId ? `appr-${approvalId}` : `d-${selectedDate.value}-${empId}`,
      isMissing: !a,
      approval_id: approvalId,
      employee_id: empId,
      date_schedule: selectedDate.value,

      empName,

      work_minutes: Number(a?.work_minutes ?? 0),
      late_minutes: Number(a?.late_minutes ?? 0),
      undertime_minutes: Number(a?.undertime_minutes ?? 0),
      overtime_minutes: Number(a?.overtime_minutes ?? 0),
      remarks: a?.remarks ?? "",
      status: a?.status ?? "approved",
    };
  });

  // sort by name
  return list.sort((a, b) => a.empName.localeCompare(b.empName));
});

const displayRows = computed(() => {
  let out = rows.value;
  if (q.value) {
    const needle = q.value.toLowerCase();
    out = out.filter((r) => {
      return (
        (r.empName || "").toLowerCase().includes(needle) ||
        String(r.employee_id).includes(needle)
      );
    });
  }
  return out;
});

/* ===== Edit state ===== */
const edit = ref({});

function clampNonNegInt(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function initEditState() {
  const obj = {};
  for (const r of rows.value) {
    obj[r._key] = {
      work_minutes: clampNonNegInt(r.work_minutes),
      late_minutes: clampNonNegInt(r.late_minutes),
      undertime_minutes: clampNonNegInt(r.undertime_minutes),
      overtime_minutes: clampNonNegInt(r.overtime_minutes),
      remarks: r.remarks ?? "",
      status: r.status === "rejected" ? "rejected" : "approved",
    };
  }
  edit.value = obj;
}

function resetRow(r) {
  edit.value[r._key] = {
    work_minutes: clampNonNegInt(r.work_minutes),
    late_minutes: clampNonNegInt(r.late_minutes),
    undertime_minutes: clampNonNegInt(r.undertime_minutes),
    overtime_minutes: clampNonNegInt(r.overtime_minutes),
    remarks: r.remarks ?? "",
    status: r.status === "rejected" ? "rejected" : "approved",
  };
}

/* ===== Load approvals for selected day ===== */
async function loadApprovalsForDay() {
  loading.value = true;
  try {
    const employeeIds = dept4Users.value.map((u) => Number(u.user_id));
    approvals.value = await fetchAttendanceApprovalsByDate(selectedDate.value, employeeIds);
    initEditState();
  } finally {
    loading.value = false;
  }
}

/* ===== Save logic (create if missing, patch if exists) ===== */
function getApprovedBy() {
  return Number(currentUser.value?.user_id ?? currentUser.value?.id ?? 0);
}

async function saveRow(row) {
  savingKey.value = row._key;
  try {
    const e = edit.value[row._key] || {};
    const payload = {
      employee_id: Number(row.employee_id),
      date_schedule: String(selectedDate.value),
      approved_by: getApprovedBy(),
      work_minutes: clampNonNegInt(e.work_minutes),
      late_minutes: clampNonNegInt(e.late_minutes),
      undertime_minutes: clampNonNegInt(e.undertime_minutes),
      overtime_minutes: clampNonNegInt(e.overtime_minutes),
      remarks: (e.remarks ?? "").trim() || null,
      status: e.status === "rejected" ? "rejected" : "approved",
    };

    if (row.isMissing) {
      await createAttendanceApproval(payload);
    } else {
      await updateAttendanceApproval(row.approval_id, payload);
    }

    await loadApprovalsForDay();
  } catch (err) {
    console.error("Save failed:", err?.response?.data ?? err);
    alert("Save failed:\n" + JSON.stringify(err?.response?.data ?? { message: err.message }, null, 2));
  } finally {
    savingKey.value = "";
  }
}

async function saveAll() {
  bulkSaving.value = true;
  try {
    for (const r of displayRows.value) {
      await saveRow(r);
    }
  } finally {
    bulkSaving.value = false;
  }
}

/* ===== Date navigation ===== */
function prevDay() {
  selectedDate.value = dayjs(selectedDate.value).subtract(1, "day").format("YYYY-MM-DD");
}
function nextDay() {
  selectedDate.value = dayjs(selectedDate.value).add(1, "day").format("YYYY-MM-DD");
}

/* ===== Boot ===== */
async function bootAfterAuth() {
  loading.value = true;
  try {
    users.value = await fetchUsers();
    await loadApprovalsForDay();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (currentUser.value) await bootAfterAuth();
  _nowTimer = setInterval(() => {
    nowTime.value = dayjs().format("h:mm:ss A");
  }, 1000);
});
onUnmounted(() => {
  if (_nowTimer) clearInterval(_nowTimer);
});

/* Reload approvals when date changes */
watch(selectedDate, async () => {
  if (!currentUser.value) return;
  await loadApprovalsForDay();
});

/* If users list changes (rare), rebuild */
watch(
  () => dept4Users.value.map((u) => u.user_id).join(","),
  async () => {
    if (!currentUser.value) return;
    await loadApprovalsForDay();
  }
);
</script>

<style scoped>
.row{width:100%}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.header-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.header-left .title{font-size:22px;font-weight:900;margin:0;letter-spacing:-.2px}
.subtitle{margin:4px 0 0;color:#6b7280;font-size:13px}
.header-right{display:flex;align-items:center;gap:10px}
.logout-btn{height:38px}
.now-badge{display:inline-flex;flex-direction:column;align-items:flex-end;padding:10px 12px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb}
.now-badge .time{font-weight:900;font-size:22px;line-height:1.1}
.now-badge .date{font-size:12px;color:#6b7280;margin-top:2px}

/* Login */
.login-card{max-width:520px;margin:20px auto}
.muted{color:#6b7280;margin:-6px 0 12px}
.error-box{margin-top:12px;color:#b42318;background:#fef3f2;border:1px solid #fee2e2;border-radius:10px;padding:10px}
.login-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:720px){.login-grid{grid-template-columns:1fr}}

/* Toolbar */
.toolbar{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:12px;margin-bottom:12px;background:#fbfdff;border:1px solid #e5e7eb;border-radius:14px;padding:14px}
@media (max-width:980px){.toolbar{grid-template-columns:1fr}}
.field label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}
.search-input,input[type="date"],input[type="email"],input[type="password"],select{
  width:100%;height:42px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px;outline:none;font-size:14px;background:#fff
}
.btn-wide{width:100%;height:42px}
.date-row{display:flex;gap:8px;align-items:center}
.btn-square{width:42px;display:inline-flex;align-items:center;justify-content:center}

/* Table */
.table-wrap{margin-top:10px;overflow-x:auto}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{text-align:left;font-size:12px;color:#667085;font-weight:700;padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
tbody td{padding:10px 12px;border-bottom:1px solid #f0f2f5;font-size:14px;vertical-align:middle}
tbody tr:hover{background:#fafcff}
.row-missing{background:#fbfdff}
.loading-note{padding:12px;color:#6b7280}

/* Inputs */
.min-input,.remarks-input,.status-select{
  width:100%;
  height:38px;
  padding:6px 10px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  outline:none;
  font-size:14px;
  background:#fff;
}

/* Employee cell */
.emp .name{font-weight:900;color:#111827;display:flex;align-items:center;gap:8px}
.emp .sub{font-size:12px;color:#6b7280;margin-top:2px}
.missing-tag{font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;border:1px solid #fde68a;background:#fffbeb;color:#92400e}

/* Buttons */
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{height:34px;padding:0 12px;border-radius:10px;font-weight:800;font-size:12px;border:1px solid transparent;cursor:pointer}
.btn-save{background:#065f46;color:#fff}
.btn-ghost{background:#fff;color:#374151;border-color:#e5e7eb}
</style>
