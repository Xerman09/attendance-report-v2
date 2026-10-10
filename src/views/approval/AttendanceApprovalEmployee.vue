<template>
  <section class="row">
    <!-- ================= LOGIN BOX ================= -->
    <div v-if="!currentUser" class="card login-card">
      <h3 class="title">Login Required</h3>
      <p class="muted">
        Sign in using your email and password (validated via <code>/items/user</code>).
      </p>

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

    <!-- ================= PER EMPLOYEE APPROVAL VIEW ================= -->
    <div v-else class="card">
      <div class="header-row">
        <div class="header-left">
          <h3 class="title">Attendance Approval</h3>
          <p class="subtitle">Editable per-day approved minutes</p>
        </div>

        <div class="header-right">
          <button class="btn btn-ghost logout-btn" @click="handleLogout" :disabled="authLoading">
            Logout
          </button>
          <div class="now-badge">
            <div class="time">{{ nowTime }}</div>
            <div class="date">{{ todayStr }}</div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls no-print">
        <div class="controls-top">
          <div class="field field--dept">
            <label>Department</label>
            <select v-model.number="selectedDepartmentId">
              <option :value="0">All Departments</option>
              <option v-for="d in departments" :key="d.department_id" :value="d.department_id">
                {{ d.department_name }} ({{ d.department_id }})
              </option>
            </select>
          </div>

          <div class="field field--employee">
            <label>Employee</label>
            <select v-model.number="selectedEmployeeId">
              <option :value="0">Select employee…</option>
              <option 
                v-for="u in usersFiltered" 
                :key="u.user_id" 
                :value="u.user_id"
                :style="!isActiveUser(u) ? { backgroundColor: '#fef2f2', color: '#991b1b' } : {}"
              >
                {{ formatUserLabel(u) }}
              </option>
            </select>
          </div>

          <div class="field field--search">
            <label>Search Employee</label>
            <div style="display: flex; gap: 8px;">
              <input class="search-input" placeholder="Search by name / id" v-model="q" style="flex: 1;" />
              <button type="button" class="btn secondary" @click="showInactive = !showInactive" style="height: 42px;">
                {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
              </button>
            </div>
          </div>
        </div>

        <div class="controls-bottom">
          <div class="field">
            <label>Show Range (From)</label>
            <input type="date" v-model="dateFrom" :disabled="!selectedEmployeeId" />
          </div>

          <div class="field">
            <label>Show Range (To)</label>
            <input type="date" v-model="dateTo" :disabled="!selectedEmployeeId" />
          </div>

          <div class="field field--btn">
            <label>&nbsp;</label>
            <button class="btn btn-ghost btn-wide" @click="resetToLast20Days" :disabled="!selectedEmployeeId">
              Last 20 Days
            </button>
          </div>

          <div class="field">
            <label>Quick Day</label>
            <input type="date" v-model="dayFilter" :disabled="!selectedEmployeeId" />
          </div>

          <div class="field field--btn">
            <label>&nbsp;</label>
            <button class="btn btn-ghost btn-wide" @click="clearDayFilter" :disabled="!dayFilter">
              Clear Day
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="table-wrap">
        <div v-if="loading" class="loading-note">Loading approvals…</div>

        <div v-else-if="!selectedEmployeeId" class="empty-state">
          <div class="empty-title">Select an employee</div>
          <div class="empty-sub">Choose a department and employee to view/edit approvals.</div>
        </div>

        <template v-else>
          <div class="emp-meta">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="emp-meta__name">{{ selectedEmployeeName }}</div>
              <span v-if="isFlexibleScheduleUser(selectedEmployee?.is_flexible_schedule)" class="pill pill-muted" style="font-size: 11px; font-weight: 700;">
                Flexible Schedule
              </span>
            </div>
            <div class="emp-meta__sub">
              Department ID: {{ selectedEmployeeDeptId ?? "—" }}
              <span class="dot">•</span>
              Showing: {{ effectiveFrom }} to {{ effectiveTo }}
              <span v-if="dayFilter" class="dot">•</span>
              <span v-if="dayFilter">Quick day: {{ dayFilter }}</span>
            </div>
          </div>

          <table v-if="dateRows.length > 0">
            <thead>
              <tr>
                <th style="min-width:130px">Date</th>
                <th style="width:150px">Work (mins)</th>
                <th style="width:150px">Late (mins)</th>
                <th style="width:180px">Undertime (mins)</th>
                <th style="width:180px">Overtime (mins)</th>
                <th style="min-width:260px">Remarks</th>
                <th style="width:150px">Status</th>
                <th style="width:220px">Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="r in dateRows"
                :key="r._key"
                :class="{
                  'row-highlight': r.date_schedule === dayFilter,
                  'row-missing': r.isMissing,
                }"
              >
                <td>
                  <div class="date-chip">{{ r.date_schedule }}</div>
                  <div v-if="r.isMissing" class="mini-missing">missing</div>
                </td>

                <!-- Editable mins -->
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

                <!-- Editable remarks -->
                <td>
                  <input class="remarks-input" type="text" placeholder="Optional remarks" v-model="edit[r._key].remarks" />
                </td>

                <!-- Editable status -->
                <td>
                  <select class="status-select" v-model="edit[r._key].status">
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </td>

                <!-- Actions -->
                <td class="actions">
                  <button
                    class="btn btn-save"
                    :disabled="savingKey === r._key"
                    @click="saveApprovalRow(r)"
                  >
                    {{ savingKey === r._key ? "Saving..." : (r.isMissing ? "Create & Save" : "Save") }}
                  </button>

                  <button
                    class="btn btn-ghost"
                    :disabled="savingKey === r._key"
                    @click="resetRowEdits(r)"
                  >
                    Reset
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="loading-note">No dates to display.</div>
        </template>
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
  fetchAttendanceApprovalsByEmployeeRange,
  createAttendanceApproval,
  updateAttendanceApproval,
  isFlexibleScheduleUser,
} from "../../services/api";
import { login, getCurrentUser, logout } from "../../services/auth";

/* ================= LOGIN ================= */
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
  departments.value = [];
  approvals.value = [];
  selectedDepartmentId.value = 0;
  selectedEmployeeId.value = 0;
}

/* ================= DATA ================= */
const users = ref([]);
const departments = ref([]);
const approvals = ref([]);
const loading = ref(false);

const nowTime = ref(dayjs().format("h:mm:ss A"));
const todayStr = ref(dayjs().format("dddd - MMM D, YYYY"));
let _nowTimer;

const q = ref("");
const selectedDepartmentId = ref(0);
const showInactive = ref(false);

/* Active detection */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) return Number(v.data?.[0] ?? 0) !== 1;
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true;
}
const activeUsers = computed(() => (Array.isArray(users.value) ? users.value.filter(isActiveUser) : []));

const usersFiltered = computed(() => {
  let rows = showInactive.value ? users.value : activeUsers.value;

  if (selectedDepartmentId.value) {
    rows = rows.filter((u) => Number(u.user_department) === selectedDepartmentId.value);
  }

  if (q.value) {
    const needle = q.value.toLowerCase();
    rows = rows.filter((u) => {
      const name = `${u.user_fname || ""} ${u.user_lname || ""}`.toLowerCase();
      return name.includes(needle) || String(u.user_id).includes(needle);
    });
  }
  return rows.slice().sort((a, b) => {
    const an = `${a.user_lname || ""} ${a.user_fname || ""}`.trim().toLowerCase();
    const bn = `${b.user_lname || ""} ${b.user_fname || ""}`.trim().toLowerCase();
    return an.localeCompare(bn);
  });
});
function formatUserLabel(u) {
  const name = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
  const inactiveStr = isActiveUser(u) ? "" : " (Inactive)";
  return `${name} (#${u.user_id})${inactiveStr}`;
}

/* Employee selection */
const selectedEmployeeId = ref(0);
const selectedEmployee = computed(
  () => activeUsers.value.find((u) => Number(u.user_id) === Number(selectedEmployeeId.value)) || null,
);
const selectedEmployeeName = computed(() => {
  const u = selectedEmployee.value;
  return u ? `${u.user_fname || ""} ${u.user_lname || ""}`.trim() : "";
});
const selectedEmployeeDeptId = computed(() => selectedEmployee.value?.user_department ?? null);

/* Date range */
const dateFrom = ref(dayjs().subtract(19, "day").format("YYYY-MM-DD"));
const dateTo = ref(dayjs().format("YYYY-MM-DD"));
const dayFilter = ref("");

function resetToLast20Days() {
  const anchor = dateTo.value || dayjs().format("YYYY-MM-DD");
  dateFrom.value = dayjs(anchor).subtract(19, "day").format("YYYY-MM-DD");
  dateTo.value = anchor;
}
function clearDayFilter() {
  dayFilter.value = "";
}
const effectiveFrom = computed(() => dateFrom.value);
const effectiveTo = computed(() => dateTo.value);

/* Build inclusive date list */
function buildDateList(fromYmd, toYmd) {
  const out = [];
  let cur = dayjs(fromYmd);
  const end = dayjs(toYmd);
  if (!cur.isValid() || !end.isValid()) return out;
  if (cur.isAfter(end)) return out;

  while (cur.isSame(end) || cur.isBefore(end)) {
    out.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "day");
  }
  return out;
}

/* Load approvals for employee + range */
async function loadApprovals() {
  if (!selectedEmployeeId.value) return;
  approvals.value = await fetchAttendanceApprovalsByEmployeeRange(
    selectedEmployeeId.value,
    effectiveFrom.value,
    effectiveTo.value,
  );
}

/* Map approvals by date */
const approvalByDate = computed(() => {
  const m = new Map();
  for (const a of approvals.value || []) {
    m.set(String(a.date_schedule), a);
  }
  return m;
});

/* Rows derived from date list */
const dateRows = computed(() => {
  if (!selectedEmployeeId.value) return [];
  const dates = buildDateList(effectiveFrom.value, effectiveTo.value);

  return dates.map((d) => {
    const a = approvalByDate.value.get(d) || null;
    if (!a) {
      return {
        _key: `d-${d}`,
        isMissing: true,
        approval_id: null,
        date_schedule: d,
        work_minutes: 0,
        late_minutes: 0,
        undertime_minutes: 0,
        overtime_minutes: 0,
        remarks: "",
        status: "approved",
      };
    }
    const id = a.approval_id ?? a.id;
    return {
      _key: `appr-${id}`,
      isMissing: false,
      approval_id: id,
      date_schedule: String(a.date_schedule),
      work_minutes: Number(a.work_minutes ?? 0),
      late_minutes: Number(a.late_minutes ?? 0),
      undertime_minutes: Number(a.undertime_minutes ?? 0),
      overtime_minutes: Number(a.overtime_minutes ?? 0),
      remarks: a.remarks ?? "",
      status: a.status ?? "approved",
    };
  });
});

/* ===== Edit state per row ===== */
const edit = ref({});

function clampNonNegInt(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function initEditState() {
  const obj = {};
  for (const r of dateRows.value) {
    obj[r._key] = {
      work_minutes: clampNonNegInt(r.work_minutes),
      late_minutes: clampNonNegInt(r.late_minutes),
      undertime_minutes: clampNonNegInt(r.undertime_minutes),
      overtime_minutes: clampNonNegInt(r.overtime_minutes),
      remarks: r.remarks ?? "",
      status: r.status ?? "approved",
    };
  }
  edit.value = obj;
}

function resetRowEdits(r) {
  edit.value[r._key] = {
    work_minutes: clampNonNegInt(r.work_minutes),
    late_minutes: clampNonNegInt(r.late_minutes),
    undertime_minutes: clampNonNegInt(r.undertime_minutes),
    overtime_minutes: clampNonNegInt(r.overtime_minutes),
    remarks: r.remarks ?? "",
    status: r.status ?? "approved",
  };
}

/* ===== Save (create or update) ===== */
const savingKey = ref("");

async function saveApprovalRow(row) {
  savingKey.value = row._key;
  try {
    const approvedBy = Number(currentUser.value?.user_id ?? currentUser.value?.id ?? 0);

    const e = edit.value[row._key] || {};
    const payload = {
      employee_id: Number(selectedEmployeeId.value),
      date_schedule: String(row.date_schedule),
      approved_by: approvedBy,
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

    await loadApprovals();
    initEditState();
  } catch (err) {
    console.error("Save approval failed:", err?.response?.data ?? err);
    alert(
      "Save approval failed:\n" +
        JSON.stringify(err?.response?.data ?? { message: err.message }, null, 2),
    );
  } finally {
    savingKey.value = "";
  }
}

/* ===== Boot ===== */
async function bootAfterAuth() {
  loading.value = true;
  try {
    const [uList, dList] = await Promise.all([fetchUsers(), fetchDepartments()]);
    users.value = uList;
    departments.value = dList;
    dateTo.value = dayjs().format("YYYY-MM-DD");
    dateFrom.value = dayjs(dateTo.value).subtract(19, "day").format("YYYY-MM-DD");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (currentUser.value) await bootAfterAuth();
  _nowTimer = setInterval(() => {
    nowTime.value = dayjs().format("h:mm:ss A");
    todayStr.value = dayjs().format("dddd - MMM D, YYYY");
  }, 1000);
});
onUnmounted(() => {
  if (_nowTimer) clearInterval(_nowTimer);
});

watch(
  () => selectedDepartmentId.value,
  () => {
    selectedEmployeeId.value = 0;
  },
);

/* Load approvals on employee change */
watch(
  () => selectedEmployeeId.value,
  async (v) => {
    if (!v) {
      approvals.value = [];
      dayFilter.value = "";
      edit.value = {};
      return;
    }
    dateTo.value = dayjs().format("YYYY-MM-DD");
    dateFrom.value = dayjs(dateTo.value).subtract(19, "day").format("YYYY-MM-DD");
    dayFilter.value = "";
    await loadApprovals();
    initEditState();
  },
);

/* Reload + rebuild edit when range changes */
watch([dateFrom, dateTo], async () => {
  if (!selectedEmployeeId.value) return;
  await loadApprovals();
  initEditState();
});

/* Re-init edit when dateRows changes (e.g., after load) */
watch(
  () => dateRows.value.map((r) => r._key).join("|"),
  () => {
    if (selectedEmployeeId.value) initEditState();
  },
);
</script>

<style scoped>
/* Base / layout */
.row{width:100%}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}

/* Header */
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

/* Controls */
.controls{background:#fbfdff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:12px}
.controls-top{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:12px}
.controls-bottom{display:grid;grid-template-columns:1fr 1fr .7fr 1fr .7fr;gap:12px;margin-top:12px}
@media (max-width:980px){
  .controls-top{grid-template-columns:1fr}
  .controls-bottom{grid-template-columns:1fr 1fr}
}
.field label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}
select,.search-input,input[type="date"],input[type="email"],input[type="password"]{
  width:100%;height:42px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px;outline:none;font-size:14px;background:#fff
}
.btn-wide{width:100%;height:42px}

/* Meta */
.emp-meta{padding:12px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;margin-bottom:10px}
.emp-meta__name{font-weight:900;font-size:16px;color:#111827}
.emp-meta__sub{font-size:12px;color:#6b7280;margin-top:4px}
.dot{margin:0 8px}

/* Table */
.table-wrap{margin-top:10px;overflow-x:auto}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{text-align:left;font-size:12px;color:#667085;font-weight:700;padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
tbody td{padding:10px 12px;border-bottom:1px solid #f0f2f5;font-size:14px;vertical-align:middle}
tbody tr:hover{background:#fafcff}
.row-highlight{background:#fff7ed !important}
.row-missing{background:#fbfdff}
.loading-note{padding:12px;color:#6b7280}

/* Inputs in table */
.min-input{
  width:100%;
  height:38px;
  padding:6px 10px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  outline:none;
  font-size:14px;
}
.remarks-input{
  width:100%;
  height:38px;
  padding:6px 10px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  outline:none;
  font-size:14px;
}
.status-select{
  width:100%;
  height:38px;
  padding:6px 10px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  outline:none;
  font-size:14px;
  background:#fff;
}

/* Buttons */
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{height:34px;padding:0 12px;border-radius:10px;font-weight:800;font-size:12px;border:1px solid transparent;cursor:pointer}
.btn-save{background:#065f46;color:#fff}
.btn-ghost{background:#fff;color:#374151;border-color:#e5e7eb}

/* Date chip */
.date-chip{display:inline-flex;padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;font-weight:900;color:#374151}
.mini-missing{margin-top:6px;font-size:11px;color:#6b7280}
.empty-state{border:1px dashed #e5e7eb;border-radius:14px;padding:18px;background:#fbfdff}
.empty-title{font-weight:900;color:#111827;font-size:15px}
.empty-sub{margin-top:4px;color:#6b7280;font-size:13px}

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
</style>
