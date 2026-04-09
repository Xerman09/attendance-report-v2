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

      <p v-if="authError" class="error-box">
        {{ authError }}
      </p>
    </div>

    <!-- ================= PER EMPLOYEE EDITOR ONLY ================= -->
    <div v-else class="card">
      <div class="header-row">
        <div class="header-left">
          <h3 class="title">Edit Attendance</h3>
          <p class="subtitle">Per-employee attendance log editor</p>
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
          <div class="field field--employee">
            <label>Employee</label>
            <select v-model.number="selectedEmployeeId">
              <option :value="0">Select employee…</option>
              <option v-for="u in filteredActiveUsers" :key="u.user_id" :value="u.user_id">
                {{ formatUserLabel(u) }}
              </option>
            </select>
          </div>

          <div class="field field--search">
            <label>Search Employee</label>
            <input
              class="search-input"
              placeholder="Search by name / department / id"
              v-model="q"
            />
          </div>
        </div>

        <div class="controls-bottom">
          <div class="field">
            <label>Cutoff</label>
            <select v-model="cutoff" :disabled="!selectedEmployeeId">
              <option value="26-10">26 - 10</option>
              <option value="11-25">11 - 25</option>
            </select>
          </div>

          <div class="field">
            <label>Month</label>
            <input type="month" v-model="monthPick" :disabled="!selectedEmployeeId" />
          </div>

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
        <div v-if="loading" class="loading-note">Loading attendance…</div>

        <div v-else-if="!selectedEmployeeId" class="empty-state">
          <div class="empty-title">Select an employee</div>
          <div class="empty-sub">Choose an employee to view and edit their attendance records.</div>
        </div>

        <template v-else>
          <div class="emp-meta">
            <div class="emp-meta__name">{{ selectedEmployeeName }}</div>
            <div class="emp-meta__sub">
              Department: {{ selectedEmployeeDeptName || "—" }}
              <span class="dot">•</span>
              Showing: {{ effectiveFrom }} to {{ effectiveTo }}
              <span v-if="dayFilter" class="dot">•</span>
              <span v-if="dayFilter">Quick day: {{ dayFilter }}</span>
            </div>
          </div>

          <!-- Create record on a specific day if missing -->
          <div v-if="selectedEmployeeId && dayFilter && dayMissing" class="inline-note no-print">
            <div class="inline-note__text">
              No attendance record found for <b>{{ dayFilter }}</b>.
            </div>
            <button
              class="btn btn-add"
              :disabled="creatingDayRecord"
              @click="createRecordForDay(dayFilter)"
            >
              {{ creatingDayRecord ? "Creating..." : "Create record" }}
            </button>
          </div>

          <table v-if="visibleRecords.length > 0">
            <thead>
              <tr>
                <th style="min-width:130px">Date</th>
                <th>Time In</th>
                <th>Lunch Start</th>
                <th>Lunch End</th>
                <th>Break Start</th>
                <th>Break End</th>
                <th>Time Out</th>
                <th style="width:210px">Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="r in visibleRecords"
                :key="r._key"
                :class="{
                  'row-highlight': r._key === highlightedKey,
                  'row-missing': r.is_missing
                }"
              >
                <td>
                  <div class="date-chip">
                    {{ r.log_date }}
                    <span v-if="r.is_missing" class="missing-badge">(Missing)</span>
                  </div>
                </td>

                <td><input type="time" step="60" v-model="empEdit[r._key].time_in" /></td>
                <td><input type="time" step="60" v-model="empEdit[r._key].lunch_start" /></td>
                <td><input type="time" step="60" v-model="empEdit[r._key].lunch_end" /></td>
                <td><input type="time" step="60" v-model="empEdit[r._key].break_start" /></td>
                <td><input type="time" step="60" v-model="empEdit[r._key].break_end" /></td>
                <td><input type="time" step="60" v-model="empEdit[r._key].time_out" /></td>

                <td class="actions">
                  <button
                    class="btn"
                    :class="r.is_missing ? 'btn-add' : 'btn-save'"
                    :disabled="empSaving[r._key]"
                    @click="saveRecord(r)"
                  >
                    <span v-if="empSaving[r._key]">Saving...</span>
                    <span v-else>{{ r.is_missing ? "Create" : "Save" }}</span>
                  </button>
                  <button class="btn btn-ghost" :disabled="empSaving[r._key]" @click="resetRecord(r)">
                    Cancel
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="loading-note">
            No records found for this employee in the selected range.
          </div>
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
  fetchAttendance,
  updateAttendanceLog,
  createAttendanceLog,
  computeCutoffRange,
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
  departments.value = [];
  attendance.value = [];
  selectedEmployeeId.value = 0;
  empEdit.value = {};
}

/* ========== STATE ========== */
const users = ref([]);
const departments = ref([]);
const attendance = ref([]);

const nowTime = ref(dayjs().format("h:mm:ss A"));
const todayStr = ref(dayjs().format("dddd - MMM D, YYYY"));
let _nowTimer;

const q = ref("");
const loading = ref(false);

/* ----- Active detection ----- */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) return Number(v.data?.[0] ?? 0) !== 1;
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true;
}

const activeUsers = computed(() =>
  Array.isArray(users.value) ? users.value.filter(isActiveUser) : [],
);

const userById = computed(() => new Map(users.value.map((u) => [u.user_id, u])));
const departmentById = computed(() => new Map(departments.value.map((d) => [d.department_id, d])));

const filteredActiveUsers = computed(() => {
  let rows = activeUsers.value;

  if (q.value) {
    const needle = q.value.toLowerCase();
    rows = rows.filter((u) => {
      const dept = departmentById.value.get(u.user_department) || {};
      const name = `${u.user_fname || ""} ${u.user_lname || ""}`.toLowerCase();
      return (
        name.includes(needle) ||
        String(u.user_id).includes(needle) ||
        String(dept.department_name || "").toLowerCase().includes(needle)
      );
    });
  }

  return rows.slice().sort((a, b) => {
    const an = `${a.user_lname || ""} ${a.user_fname || ""}`.trim().toLowerCase();
    const bn = `${b.user_lname || ""} ${b.user_fname || ""}`.trim().toLowerCase();
    return an.localeCompare(bn);
  });
});

function formatUserLabel(u) {
  const dept = departmentById.value.get(u.user_department) || {};
  const name = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
  return `${name} — ${dept.department_name || "No Dept"} (#${u.user_id})`;
}

/* ===== Employee selection ===== */
const selectedEmployeeId = ref(0);
const selectedEmployee = computed(() => userById.value.get(selectedEmployeeId.value) || null);
const selectedEmployeeName = computed(() => {
  const u = selectedEmployee.value;
  if (!u) return "";
  return `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
});
const selectedEmployeeDeptName = computed(() => {
  const u = selectedEmployee.value;
  if (!u) return "";
  return departmentById.value.get(u.user_department)?.department_name || "";
});

function getDeptIdForUser(userId) {
  const u = userById.value.get(userId);
  return u?.user_department ?? null;
}

/* ===== Date range controls (anchored to dateTo) ===== */
const cutoff = ref("26-10");
const monthPick = ref(dayjs().format("YYYY-MM"));
const dateFrom = ref(dayjs().subtract(19, "day").format("YYYY-MM-DD"));
const dateTo = ref(dayjs().format("YYYY-MM-DD"));
const dayFilter = ref("");

function resetToLast20Days() {
  const anchor = dateTo.value || dayjs().format("YYYY-MM-DD");
  const from = dayjs(anchor).subtract(19, "day").format("YYYY-MM-DD");
  dateFrom.value = from;
  dateTo.value = anchor;
}
function clearDayFilter() {
  dayFilter.value = "";
}

const effectiveFrom = computed(() => dateFrom.value || dayjs(dateTo.value).subtract(19, "day").format("YYYY-MM-DD"));
const effectiveTo = computed(() => dateTo.value || dayjs().format("YYYY-MM-DD"));

function inRange(d, from, to) {
  return d >= from && d <= to;
}

/* ===== Records for employee ===== */
const employeeRecords = computed(() => {
  if (!selectedEmployeeId.value) return [];

  const rows = attendance.value
    .filter((a) => Number(a.user_id) === Number(selectedEmployeeId.value))
    .map((a) => {
      const id = a.log_id ?? a.id;
      return { ...a, _id: id, _key: `log-${id}` };
    });

  rows.sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
  return rows;
});

/* Always show range list */
const visibleRecords = computed(() => {
  const from = effectiveFrom.value;
  const to = effectiveTo.value;
  if (!from || !to) return [];

  const existing = employeeRecords.value;
  const list = [];
  let curr = dayjs(to);
  const start = dayjs(from);

  while (curr.isAfter(start) || curr.isSame(start, "day")) {
    const ymd = curr.format("YYYY-MM-DD");
    const found = existing.find((r) => String(r.log_date) === ymd);

    if (found) {
      list.push(found);
    } else {
      // Virtual record for missing day
      list.push({
        _id: null,
        _key: `missing-${ymd}`,
        log_date: ymd,
        time_in: null,
        lunch_start: null,
        lunch_end: null,
        break_start: null,
        break_end: null,
        time_out: null,
        is_missing: true,
      });
    }
    curr = curr.subtract(1, "day");
  }

  return list;
});

/* Highlight row for dayFilter (if exists) */
const highlightedKey = computed(() => {
  if (!dayFilter.value) return "";
  const target = String(dayFilter.value);
  const match = visibleRecords.value.find((r) => String(r.log_date) === target);
  return match?._key || "";
});

/* Day missing (for create button) */
const dayMissing = computed(() => {
  if (!selectedEmployeeId.value || !dayFilter.value) return false;
  const target = String(dayFilter.value);
  const match = visibleRecords.value.find((r) => String(r.log_date) === target);
  return !!match?.is_missing;
});

/* ===== Edit state per record ===== */
const empEdit = ref({});
const empSaving = ref({});
const creatingDayRecord = ref(false);

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

function initEmpEditState() {
  if (!selectedEmployeeId.value) {
    empEdit.value = {};
    return;
  }
  const obj = {};
  for (const r of visibleRecords.value) {
    obj[r._key] = {
      time_in: normalizeToHHMM(r.time_in),
      lunch_start: normalizeToHHMM(r.lunch_start),
      lunch_end: normalizeToHHMM(r.lunch_end),
      break_start: normalizeToHHMM(r.break_start),
      break_end: normalizeToHHMM(r.break_end),
      time_out: normalizeToHHMM(r.time_out),
    };
  }
  empEdit.value = obj;
}

function resetRecord(rec) {
  if (rec.is_missing) {
    empEdit.value[rec._key] = {
      time_in: "",
      lunch_start: "",
      lunch_end: "",
      break_start: "",
      break_end: "",
      time_out: "",
    };
    return;
  }
  empEdit.value[rec._key] = {
    time_in: normalizeToHHMM(rec.time_in),
    lunch_start: normalizeToHHMM(rec.lunch_start),
    lunch_end: normalizeToHHMM(rec.lunch_end),
    break_start: normalizeToHHMM(rec.break_start),
    break_end: normalizeToHHMM(rec.break_end),
    time_out: normalizeToHHMM(rec.time_out),
  };
}

/* ===== Save/Create ===== */
async function reloadAttendanceOnly() {
  attendance.value = await fetchAttendance();
}

async function saveRecord(rec) {
  empSaving.value[rec._key] = true;
  try {
    const userId = selectedEmployeeId.value;
    const deptId = getDeptIdForUser(userId);
    if (deptId == null) {
      alert(`Cannot save: user ${userId} has no department_id.`);
      return;
    }

    const ymd = String(rec.log_date);
    const payload = {
      log_date: ymd,
      user_id: userId,
      department_id: deptId,
      time_in: toSaveDateTime(ymd, empEdit.value[rec._key]?.time_in),
      lunch_start: toSaveDateTime(ymd, empEdit.value[rec._key]?.lunch_start),
      lunch_end: toSaveDateTime(ymd, empEdit.value[rec._key]?.lunch_end),
      break_start: toSaveDateTime(ymd, empEdit.value[rec._key]?.break_start),
      break_end: toSaveDateTime(ymd, empEdit.value[rec._key]?.break_end),
      time_out: toSaveDateTime(ymd, empEdit.value[rec._key]?.time_out),
    };

    if (rec.is_missing) {
      await createAttendanceLog(payload);
    } else {
      const logId = rec.log_id ?? rec.id ?? rec._id;
      await updateAttendanceLog(logId, payload);
    }

    await reloadAttendanceOnly();
    initEmpEditState();
  } catch (e) {
    console.error("Save failed:", e?.response?.data ?? e);
    alert("Save failed:\n" + JSON.stringify(e?.response?.data ?? { message: e.message }, null, 2));
  } finally {
    empSaving.value[rec._key] = false;
  }
}

async function createRecordForDay(ymd) {
  if (!selectedEmployeeId.value) return;

  creatingDayRecord.value = true;
  try {
    const userId = selectedEmployeeId.value;
    const deptId = getDeptIdForUser(userId);
    if (deptId == null) {
      alert(`Cannot create: user ${userId} has no department_id.`);
      return;
    }

    const payload = {
      log_date: ymd,
      user_id: userId,
      department_id: deptId,
      time_in: null,
      lunch_start: null,
      lunch_end: null,
      break_start: null,
      break_end: null,
      time_out: null,
    };

    await createAttendanceLog(payload);
    await reloadAttendanceOnly();
    initEmpEditState();
  } catch (e) {
    console.error("Create failed:", e?.response?.data ?? e);
    alert("Create failed:\n" + JSON.stringify(e?.response?.data ?? { message: e.message }, null, 2));
  } finally {
    creatingDayRecord.value = false;
  }
}

/* ===== Boot ===== */
async function bootAfterAuth() {
  loading.value = true;
  try {
    const [u, d, a] = await Promise.all([fetchUsers(), fetchDepartments(), fetchAttendance()]);
    users.value = u;
    departments.value = d;
    attendance.value = a;

    // default range anchored to selected cutoff
    const range = computeCutoffRange(monthPick.value, cutoff.value);
    dateFrom.value = range.from;
    dateTo.value = range.to;
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

/* When employee changes: init edit state + reset range to selected cutoff */
watch(
  () => selectedEmployeeId.value,
  (v) => {
    if (!v) {
      empEdit.value = {};
      dayFilter.value = "";
      return;
    }
    const range = computeCutoffRange(monthPick.value, cutoff.value);
    dateFrom.value = range.from;
    dateTo.value = range.to;
    initEmpEditState();
  },
);

/* If attendance changes, refresh edit state */
watch(
  () => attendance.value,
  () => {
    if (selectedEmployeeId.value) initEmpEditState();
  },
);

/* Update range when cutoff or month changes */
watch([cutoff, monthPick], ([newCutoff, newMonth]) => {
  if (!selectedEmployeeId.value) return;
  const range = computeCutoffRange(newMonth, newCutoff);
  dateFrom.value = range.from;
  dateTo.value = range.to;
});

/* Reinitialize edit state anytime date boundaries change */
watch([dateFrom, dateTo], () => {
  if (selectedEmployeeId.value) {
    initEmpEditState();
  }
});
</script>

<style scoped>
/* Layout */
.row {
  width: 100%;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* Header */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}
.header-left .title {
  font-size: 22px;
  font-weight: 900;
  margin: 0;
  letter-spacing: -0.2px;
}
.subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logout-btn {
  height: 38px;
}

/* Now badge */
.now-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}
.now-badge .time {
  font-weight: 900;
  font-size: 22px;
  line-height: 1.1;
}
.now-badge .date {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* Login */
.login-card {
  max-width: 520px;
  margin: 20px auto;
}
.muted {
  color: #6b7280;
  margin: -6px 0 12px;
}
.login-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 720px) {
  .login-grid {
    grid-template-columns: 1fr;
  }
}

/* Controls */
.controls {
  background: #fbfdff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
}
.controls-top {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
}
.controls-bottom {
  display:grid;
  grid-template-columns: 0.8fr 1fr 1fr 1fr 0.7fr 1fr 0.7fr;
  gap: 12px;
  margin-top: 12px;
}
@media (max-width: 980px) {
  .controls-top {
    grid-template-columns: 1fr;
  }
  .controls-bottom {
    grid-template-columns: 1fr 1fr;
  }
  .field--btn {
    grid-column: span 1;
  }
}

.field label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}
select,
.search-input,
input[type="text"],
input[type="search"],
input[type="date"],
input[type="time"],
input[type="email"],
input[type="password"] {
  width: 100%;
  height: 42px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  outline: none;
  font-size: 14px;
  background: #fff;
}
select:disabled,
input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}
.btn-wide {
  width: 100%;
  height: 42px;
}

/* Table */
.table-wrap {
  margin-top: 10px;
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
thead th {
  text-align: left;
  font-size: 12px;
  color: #667085;
  font-weight: 700;
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
tbody td {
  padding: 12px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 14px;
}
tbody tr:hover {
  background: #fafcff;
}
.row-highlight {
  background: #fff7ed !important;
}

/* Buttons */
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 12px;
  border: 1px solid transparent;
  cursor: pointer;
}
.btn-save {
  background: #065f46;
  color: #fff;
}
.btn-ghost {
  background: #fff;
  color: #374151;
  border-color: #e5e7eb;
}
.btn-add {
  background: #2563eb;
  color: #fff;
  height: 34px;
  padding: 0 14px;
}

/* Meta */
.emp-meta {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  margin-bottom: 10px;
}
.emp-meta__name {
  font-weight: 900;
  font-size: 16px;
  color: #111827;
}
.emp-meta__sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.dot {
  margin: 0 8px;
}

/* Date chip */
.date-chip {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  font-size: 12px;
  font-weight: 900;
  color: #374151;
}

/* Notices */
.loading-note {
  padding: 12px;
  color: #6b7280;
}
.error-box {
  margin-top: 12px;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fee2e2;
  border-radius: 10px;
  padding: 10px;
}
.inline-note {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #e5e7eb;
  background: #fffbeb;
  border-radius: 14px;
  color: #92400e;
  margin-bottom: 10px;
}
.inline-note__text {
  font-size: 13px;
}

/* Empty state */
.empty-state {
  border: 1px dashed #e5e7eb;
  border-radius: 14px;
  padding: 18px;
  background: #fbfdff;
}
.empty-title {
  font-weight: 900;
  color: #111827;
  font-size: 15px;
}
.empty-sub {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}
.row-missing {
  background: #fefce8;
}
.missing-badge {
  font-size: 10px;
  color: #ca8a04;
  font-weight: 700;
  margin-left: 4px;
  text-transform: uppercase;
}
</style>
