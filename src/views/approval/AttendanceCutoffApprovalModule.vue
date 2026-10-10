<template>
  <section class="row">
    <div v-if="!currentUser" class="card login-card">
      <div class="login-head">
        <h3 class="title">Login Required</h3>
        <p class="muted">
          Sign in using your email and password (validated via <code>/items/user</code>).
        </p>
      </div>

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

      <div class="actions" style="margin-top: 12px">
        <button class="btn btn-primary" :disabled="authLoading" @click="manualLogin">
          <span v-if="authLoading" class="spinner" aria-hidden="true"></span>
          {{ authLoading ? "Signing in…" : "Login" }}
        </button>
        <button class="btn btn-ghost" :disabled="authLoading" @click="clearFields">Clear</button>
      </div>

      <p v-if="authError" class="error-box">{{ authError }}</p>
    </div>

    <div v-else class="card main-card">
      <div class="header-row">
        <div class="header-left">
          <h3 class="title">Cutoff Attendance Approval</h3>
          <p class="subtitle">Approve pending attendance by cutoff + department</p>
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

      <div class="controls no-print">
        <div class="controls-top">
          <div class="field">
            <label>Cutoff</label>
<select v-model="cutoff">
  <option value="26-10">26 - 10</option>
  <option value="11-25">11 - 25</option>
</select>
          </div>

          <div class="field">
            <label>Month</label>
            <input type="month" v-model="monthPick" />
          </div>

          <div class="field">
            <label>Department</label>
            <select v-model.number="departmentId">
              <option :value="0">All Departments</option>
              <option v-for="d in departments" :key="d.department_id" :value="d.department_id">
                {{ d.department_name }} (#{{ d.department_id }})
              </option>
            </select>
          </div>

          <div class="field field--btn">
            <label>&nbsp;</label>
            <button class="btn btn-ghost btn-wide" @click="loadPendingEmployees" :disabled="loading">
              <span v-if="loading" class="spinner" aria-hidden="true"></span>
              {{ loading ? "Loading..." : "Load Pending" }}
            </button>
          </div>
        </div>

        <div class="controls-bottom">
          <div class="field field--search">
            <label>Search Employee</label>
            <div style="display: flex; gap: 8px;">
              <input class="search-input" placeholder="Search by name / id" v-model="q" style="flex: 1;" />
              <button type="button" class="btn secondary" @click="showInactive = !showInactive" style="height: 44px; min-width: max-content;">
                {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
              </button>
            </div>
          </div>

          <div class="field">
            <label>Cutoff Range</label>
            <div class="range-pill">
              <span class="range-pill__dot"></span>
              <span class="range-pill__txt">{{ rangeFrom }} → {{ rangeTo }}</span>
            </div>
          </div>

          <div class="field field--btn">
            <label>&nbsp;</label>
            <button class="btn btn-ghost btn-wide" @click="closeEmployee" :disabled="!selectedEmployeeId">
              Close Employee
            </button>
          </div>
        </div>
      </div>

      <!-- VIEW MODE SWITCHER TABS -->
      <div class="view-tabs no-print">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: viewMode === 'cards' }"
          @click="viewMode = 'cards'"
        >
          <span>Approval Cards</span>
          <span v-if="filteredPendingEmployees.length" class="tab-pill tab-pill--warning">{{ filteredPendingEmployees.length }} pending</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: viewMode === 'summary' }"
          @click="viewMode = 'summary'"
        >
          <span>Cutoff Summary Table</span>
          <span class="tab-pill">{{ filteredEmployeeSummaries.length }} employees</span>
        </button>
      </div>

      <!-- CUTOFF SUMMARY TABLE VIEW -->
      <div v-if="viewMode === 'summary'" class="panel summary-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Cutoff Attendance Summary</div>
            <div class="panel-sub">
              Cutoff period: <span class="mono">{{ rangeFrom }}</span> → <span class="mono">{{ rangeTo }}</span>
              <span v-if="departmentId > 0"> • Dept #{{ departmentId }}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span class="pill pill-muted">{{ filteredEmployeeSummaries.length }} employees</span>
            <span class="pill pill-muted">No-Timeout Penalty: {{ noTimeOutPenalty }}m</span>
          </div>
        </div>

        <div v-if="loading" class="loading-note">
          <span class="spinner" aria-hidden="true"></span>
          Loading cutoff summary…
        </div>

        <div v-else-if="filteredEmployeeSummaries.length === 0" class="empty-state">
          <div class="empty-title">No employees found</div>
          <div class="empty-sub">Try selecting another department or adjusting your search.</div>
        </div>

        <div v-else class="summary-table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th style="min-width: 220px">Employee</th>
                <th style="min-width: 140px">Department</th>
                <th style="text-align: center; min-width: 130px">Days Attended</th>
                <th style="text-align: right; min-width: 120px">Work</th>
                <th style="text-align: right; min-width: 100px">Late</th>
                <th style="text-align: right; min-width: 100px">Undertime</th>
                <th style="text-align: right; min-width: 100px">Overtime</th>
                <th style="text-align: center; min-width: 120px">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in filteredEmployeeSummaries"
                :key="s.user_id"
                :class="{ 'is-inactive': s.rawUser && !isActiveUser(s.rawUser) }"
              >
                <td>
                  <div class="emp-summary-name">
                    <b>{{ s.user_fname }} {{ s.user_lname }}</b>
                    <span v-if="isFlexibleScheduleUser(s.rawUser?.is_flexible_schedule)" class="pill pill-muted pill-xs" title="Flexible schedule (exempt from dept lateness)">Flex</span>
                    <span v-if="s.rawUser && !isActiveUser(s.rawUser)" style="color: #ef4444; font-size: 11px; margin-left: 6px;">(Inactive)</span>
                  </div>
                  <div class="mono muted" style="font-size: 11px;">#{{ s.user_id }}</div>
                </td>
                <td>{{ s.department_name || '—' }}</td>
                <td style="text-align: center">
                  <span class="badge-days" :class="s.days_count > 0 ? 'badge-days--active' : 'badge-days--zero'">
                    {{ s.days_count }} {{ s.days_count === 1 ? "Day" : "Days" }}
                  </span>
                </td>
                <td style="text-align: right" class="mono font-bold">{{ fmtMinutesToHHMM(s.total_work_minutes) }}</td>
                <td style="text-align: right" class="mono" :class="{ 'text-danger': s.total_late_minutes > 0 }">
                  {{ s.total_late_minutes }}m
                </td>
                <td style="text-align: right" class="mono" :class="{ 'text-warning': s.total_undertime_minutes > 0 }">
                  {{ s.total_undertime_minutes }}m
                </td>
                <td style="text-align: right" class="mono" :class="{ 'text-success': s.total_overtime_minutes > 0 }">
                  {{ s.total_overtime_minutes }}m
                </td>
                <td style="text-align: center">
                  <button class="btn btn-ghost btn-sm" @click="openEmployeeFromSummary(s)">
                    Review
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SPLIT LAYOUT (Cards Mode) -->
      <div v-else class="split">
        
        <div class="panel list-panel">
          <div class="panel-head">
            <div class="panel-title">Pending Employees</div>
            <div class="panel-sub">
              <span class="pill pill-muted">{{ filteredPendingEmployees.length }}</span>
              <span class="muted" style="margin-left: 6px">found</span>
            </div>
          </div>

          <div v-if="loading" class="loading-note">
            <span class="spinner" aria-hidden="true"></span>
            Loading…
          </div>

          <div v-else-if="filteredPendingEmployees.length === 0" class="empty-state">
            <div class="empty-title">No pending employees</div>
            <div class="empty-sub">Try a different cutoff/month/department.</div>
          </div>

          <div v-else class="emp-list">
            <button
              v-for="e in filteredPendingEmployees"
              :key="e.user_id"
              class="emp-item"
              :class="{ 
                active: Number(selectedEmployeeId) === Number(e.user_id),
                'is-inactive': e.rawUser && !isActiveUser(e.rawUser)
              }"
              @click="openEmployee(e)"
            >
              <div class="emp-item__row">
                <div class="emp-item__name">
                  {{ e.full_name }}
                  <span v-if="isFlexibleScheduleUser(e.rawUser?.is_flexible_schedule)" class="pill pill-muted pill-xs" title="Flexible schedule (exempt from dept lateness)">Flex</span>
                  <span v-if="e.rawUser && !isActiveUser(e.rawUser)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
                </div>
                <span class="pill pill-warning">{{ e.pending_days }} pending</span>
              </div>
              <div class="emp-item__meta">
                <span class="mono">#{{ e.user_id }}</span>
                <span class="dot">•</span>
                Dept <span class="mono">{{ e.department_id }}</span>
                <span class="dot">•</span>
                <span class="badge-days-pill">{{ e.days_count }} {{ e.days_count === 1 ? 'day' : 'days' }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="panel panel--wide card-panel">
          <div v-if="!selectedEmployeeId" class="empty-state" style="margin-top: 0">
            <div class="empty-title">Select an employee</div>
            <div class="empty-sub">Click an employee on the left to review attendance, or view the Cutoff Summary Table above.</div>
          </div>

          <template v-else>
            <div class="emp-meta" style="margin-bottom: 12px">
              <div class="emp-meta__top">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <div class="emp-meta__name">{{ selectedEmployeeName }}</div>
                  <span class="badge-days badge-days--active">
                    {{ selectedEmployeeDaysCount }} {{ selectedEmployeeDaysCount === 1 ? "Day" : "Days" }} Attended
                  </span>
                  <span v-if="isFlexibleScheduleUser(selectedUser?.is_flexible_schedule)" class="pill pill-muted" title="Exempt from department lateness">
                    Flexible Schedule
                  </span>
                </div>
                <div class="emp-meta__actions">
                  <button class="btn btn-primary" :disabled="bulkSaving || !dateRows.length" @click="approveAllVisible">
                    <span v-if="bulkSaving" class="spinner" aria-hidden="true"></span>
                    {{ bulkSaving ? "Saving..." : "Approve All" }}
                  </button>
                  <button class="btn btn-ghost" :disabled="bulkSaving || !dateRows.length" @click="recomputeAll">
                    Recompute All
                  </button>
                </div>
              </div>
              <div class="emp-meta__sub">
                Dept: <span class="mono">{{ selectedEmployeeDeptId ?? "—" }}</span>
                <span class="dot">•</span>
                Range: <span class="mono">{{ rangeFrom }}</span> to <span class="mono">{{ rangeTo }}</span>
                <span class="dot">•</span>
                Schedule: <span class="mono">{{ toHHmm(selectedSchedule?.work_start) }} - {{ toHHmm(selectedSchedule?.work_end) }}</span>
                <span class="dot">•</span>
                Undertime Penalty: <span class="mono">{{ noTimeOutPenalty }}m</span>
              </div>
            </div>

            <!-- CARD VIEW FILTER TOOLBAR -->
            <div class="card-filter-toolbar">
              <div class="card-filter-group">
                <button
                  type="button"
                  class="card-filter-btn"
                  :class="{ active: cardFilter === 'all' }"
                  @click="cardFilter = 'all'"
                >
                  All Cutoff Days ({{ allDateRows.length }})
                </button>
                <button
                  type="button"
                  class="card-filter-btn"
                  :class="{ active: cardFilter === 'attended' }"
                  @click="cardFilter = 'attended'"
                >
                  Attended Days ({{ attendedCount }})
                </button>
                <button
                  type="button"
                  class="card-filter-btn"
                  :class="{ active: cardFilter === 'pending' }"
                  @click="cardFilter = 'pending'"
                >
                  Pending Action ({{ pendingActionCount }})
                </button>
              </div>
              <div class="card-filter-count muted">
                Showing <b>{{ dateRows.length }}</b> of <b>{{ allDateRows.length }}</b> dates
              </div>
            </div>

            <div class="approval-list">
              <div v-if="tableLoading" class="loading-note">
                <span class="spinner" aria-hidden="true"></span>
                Loading approvals…
              </div>

              <div
                v-else-if="dateRows.length > 0"
                v-for="r in dateRows"
                :key="r._key"
                class="approval-card"
                :class="{
                  'card-missing': r.isMissing,
                  'card-pending': r.log_approve_status === 'pending',
                  activeCard: selectedPreviewKey === r._key,
                }"
                @click="selectPreviewRow(r)"
              >
<div class="ac-header">
  <div class="ac-date">
    <span class="date-text">{{ r.date_schedule }}</span>
    <span class="day-text">{{ dayjs(r.date_schedule).format('dddd') }}</span>
  </div>
  
  <div class="ac-badges">
    <span v-if="r.isUnsynced" class="pill pill-danger">MISSING APPROVAL RECORD</span>
    <span v-if="r.schedule?.source === 'oncall'" class="pill pill-oncall">ON-CALL</span>
    <span v-else-if="isFlexibleScheduleUser(selectedUser?.is_flexible_schedule)" class="pill pill-muted" title="Exempt from department lateness">FLEX SCHED</span>

    <span
      v-if="r.otReq"
      class="pill"
      :class="String(r.otReq.status || '').toLowerCase() === 'approved' ? 'pill-success' : 'pill-warning'"
      :title="r.otReq.purpose ? `Purpose: ${r.otReq.purpose}` : undefined"
    >
      OT: {{ r.otReq.status || 'Pending' }}<template v-if="r.otReq.duration_minutes"> ({{ r.otReq.duration_minutes }}m)</template>
    </span>

    <span v-if="r.no_log" class="pill pill-danger">no log</span>
    <span v-else class="pill" :class="r.log_approve_status === 'pending' ? 'pill-warning' : 'pill-muted'">
        log: {{ r.log_approve_status || "—" }}
    </span>

    <select class="status-select-inline" v-model="edit[r._key].status" @click.stop>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
    </select>
  </div>
</div>

                <div class="ac-log-section">
                   <div v-if="!r.no_log" class="log-grid">
                      <div class="lk">In: <b>{{ fmtTime(r.logRow?.time_in) }}</b></div>
                      <div class="lk">Out: <b>{{ fmtTime(r.logRow?.time_out) }}</b></div>
                      <div class="lk">Lunch: <b>{{ fmtRangeTime(r.logRow?.lunch_start, r.logRow?.lunch_end) }}</b></div>
                      <div class="lk">Break: <b>{{ fmtRangeTime(r.logRow?.break_start, r.logRow?.break_end) }}</b></div>
                   </div>
                   <div v-else class="mini-warn">No attendance logs found for this date.</div>
                </div>

                <div class="ac-inputs-section">
                  <div class="input-group">
                    <label>Work</label>
                    <input type="number" min="0" v-model.number="edit[r._key].work_minutes" />
                  </div>
                  <div class="input-group">
                    <label>Late</label>
                    <input type="number" min="0" v-model.number="edit[r._key].late_minutes" />
                  </div>
                  <div class="input-group">
                    <label>Under</label>
                    <input type="number" min="0" v-model.number="edit[r._key].undertime_minutes" />
                  </div>
                  <div class="input-group">
                    <label>Over</label>
                    <input type="number" min="0" v-model.number="edit[r._key].overtime_minutes" />
                  </div>
                  <div class="input-group grow">
                    <label>Remarks</label>
                    <input type="text" placeholder="Optional remarks..." v-model="edit[r._key].remarks" @click.stop />
                  </div>
                </div>

                <div class="ac-actions" @click.stop>
                    <button class="btn btn-primary btn-sm" :disabled="savingKey === r._key" @click="saveApprovalRow(r)">
                      <span v-if="savingKey === r._key" class="spinner" aria-hidden="true"></span>
                      {{ savingKey === r._key ? "Saving..." : "Save Changes" }}
                    </button>

                    <button class="btn btn-ghost btn-sm" :disabled="savingKey === r._key" @click="resetRowEdits(r)">
                      Reset
                    </button>

                    <button class="btn btn-ghost btn-sm" :disabled="savingKey === r._key || !r.log_id" @click="recomputeRow(r)">
                      Recompute
                    </button>
                </div>

              </div>

              <div v-else class="loading-note">No dates to display.</div>
            </div>
          </template>
        </div>
      </div>

      <p v-if="pageError" class="error-box" style="margin-top: 12px">{{ pageError }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import { login, getCurrentUser, logout } from "../../services/auth";
import {
  api,
  fetchUsers,
  fetchDepartments,
  fetchSchedules,
  fetchUserSchedules,
  fetchAttendanceApprovalsByEmployeeRange,
  fetchOvertimeRequestsByEmployeeRange,
  createAttendanceApproval,
  updateAttendanceApproval,
  updateAttendanceLog,
  computeCutoffRange,
  computeApprovalMinutes,
  isFlexibleScheduleUser,
  fetchNoTimeOutUndertimePenalty,
  fetchOnCallList,
  fetchOnCallSchedules,
} from "../../services/api";

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
  closeEmployee();
  pendingEmployees.value = [];
  rawCutoffLogs.value = [];
  rawCutoffApprovals.value = [];
  departments.value = [];
  schedules.value = [];
  userSchedules.value = [];
  onCallList.value = [];
  onCallSchedules.value = [];
}

/* ================= HEADER CLOCK ================= */
const nowTime = ref(dayjs().format("h:mm:ss A"));
const todayStr = ref(dayjs().format("dddd - MMM D, YYYY"));
let _nowTimer;

/* ================= DATA STATE ================= */
const loading = ref(false);
const tableLoading = ref(false);
const pageError = ref("");

const users = ref([]);
const departments = ref([]);
const schedules = ref([]);
const userSchedules = ref([]);
const onCallList = ref([]);
const onCallSchedules = ref([]);
const noTimeOutPenalty = ref(240);
const rawCutoffLogs = ref([]);
const rawCutoffApprovals = ref([]);

/* View Mode ('cards' | 'summary') */
const viewMode = ref("cards");

/* Controls */
const cutoff = ref("26-10");
const monthPick = ref(dayjs().format("YYYY-MM"));
const departmentId = ref(0);
const q = ref("");
const showInactive = ref(false);

/* Cutoff Range Calculation */
const cutoffRange = computed(() => computeCutoffRange(monthPick.value, cutoff.value));
const rangeFrom = computed(() => cutoffRange.value.from);
const rangeTo = computed(() => cutoffRange.value.to);

/* Selection State */
const selectedEmployeeId = ref(0);
const selectedEmployeeName = ref("");
const selectedEmployeeDeptId = ref(null);
const pendingEmployees = ref([]);

/* Active User Check */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) return Number(v.data?.[0] ?? 0) !== 1;
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true;
}

/* Maps & Lookup */
const userById = computed(() => {
  const m = new Map();
  for (const u of users.value || []) m.set(Number(u.user_id), u);
  return m;
});

const deptMap = computed(() => {
  const m = new Map();
  for (const d of departments.value || []) m.set(Number(d.department_id), d.department_name);
  return m;
});

const scheduleByDeptId = computed(() => {
  const m = new Map();
  for (const s of schedules.value || []) {
    const did = Number(s.department_id ?? s.dept_id ?? 0);
    if (did) m.set(did, s);
  }
  return m;
});

const scheduleByUserId = computed(() => {
  const m = new Map();
  for (const s of userSchedules.value || []) {
    const uid = Number(s.user_id ?? 0);
    if (uid) m.set(uid, s);
  }
  return m;
});

const onCallRowsByUserId = computed(() => {
  const m = new Map();
  for (const row of onCallList.value || []) {
    const uid = Number(row.user_id ?? row.user ?? row.employee_id);
    if (!uid) continue;
    if (!m.has(uid)) m.set(uid, []);
    m.get(uid).push(row);
  }
  return m;
});

const onCallScheduleById = computed(() => {
  const m = new Map();
  for (const s of onCallSchedules.value || []) {
    m.set(Number(s.id), s);
  }
  return m;
});

function getScheduleForDept(deptId) {
  return scheduleByDeptId.value.get(Number(deptId || 0)) || null;
}
function getScheduleForUser(userId) {
  return scheduleByUserId.value.get(Number(userId || 0)) || null;
}

/**
 * Schedule resolution helper (Checks On-Call first, then user schedule, then department schedule)
 * Returns object with source: "oncall" | "department"
 */
function getEmployeeScheduleForDate(userId, deptId, logDate) {
  const uid = Number(userId || 0);
  const rows = onCallRowsByUserId.value.get(uid) || [];
  const day = dayjs(logDate, "YYYY-MM-DD");

  // 1. Check On-Call schedule first
  for (const oc of rows) {
    const schedId = Number(oc.dept_sched_id ?? oc.dept_schedule_id ?? oc.schedule_id);
    if (!schedId) continue;
    const ocSched = onCallScheduleById.value.get(schedId);
    if (!ocSched) continue;
    const startStr = String(ocSched.schedule_date ?? ocSched.date ?? "");
    if (!startStr) continue;
    const start = dayjs(startStr, "YYYY-MM-DD");
    if (!start.isValid()) continue;
    const deptSched = getScheduleForDept(deptId);
    const spanDays = Number(ocSched.working_days ?? deptSched?.working_days ?? 1);
    const end = start.add(Math.max(1, spanDays) - 1, "day");
    if ((day.isAfter(start, "day") || day.isSame(start, "day")) && (day.isBefore(end, "day") || day.isSame(end, "day"))) {
      return {
        ...ocSched,
        work_start: ocSched.work_start,
        work_end: ocSched.work_end,
        grace_period: Number(ocSched.grace_period ?? 5),
        source: "oncall",
      };
    }
  }

  // 2. User specific schedule
  const userSched = getScheduleForUser(uid);
  if (userSched) {
    return {
      ...userSched,
      source: "department",
    };
  }

  // 3. Fall back to Department schedule
  const deptSched = getScheduleForDept(deptId);
  if (deptSched) {
    return {
      ...deptSched,
      source: "department",
    };
  }

  return null;
}

const selectedSchedule = computed(() => {
  return getScheduleForUser(selectedEmployeeId.value) || getScheduleForDept(selectedEmployeeDeptId.value);
});

const selectedUser = computed(() => {
  return userById.value.get(Number(selectedEmployeeId.value)) || null;
});

/* ================= CUTOFF SUMMARY AGGREGATION (Part 3) ================= */
const employeeSummaries = computed(() => {
  const summaryMap = new Map();

  const approvedByKey = new Map();
  for (const a of rawCutoffApprovals.value || []) {
    const key = `${a.employee_id}_${String(a.date_schedule).slice(0, 10)}`;
    approvedByKey.set(key, a);
  }

  const logs = rawCutoffLogs.value || [];

  logs.forEach((rawLog) => {
    const uid = Number(rawLog.user_id);
    if (!uid) return;

    const dateKey = rawLog.log_date ? String(rawLog.log_date).slice(0, 10) : "";
    const approval = approvedByKey.get(`${uid}_${dateKey}`);

    let work_minutes = 0;
    let late_minutes = 0;
    let undertime_minutes = 0;
    let overtime_minutes = 0;
    let status = approval?.status || rawLog.status || "";

    if (approval) {
      work_minutes = Number(approval.work_minutes || 0);
      late_minutes = Number(approval.late_minutes || 0);
      undertime_minutes = Number(approval.undertime_minutes || 0);
      overtime_minutes = Number(approval.overtime_minutes || 0);
    } else if (rawLog.time_in || rawLog.time_out) {
      const u = userById.value.get(uid);
      const sched = getEmployeeScheduleForDate(uid, rawLog.department_id || u?.user_department, dateKey);
      const computed = computeApprovalMinutes(
        dateKey,
        rawLog,
        sched,
        null,
        u,
        noTimeOutPenalty.value
      );
      work_minutes = computed.work_minutes;
      late_minutes = computed.late_minutes;
      undertime_minutes = computed.undertime_minutes;
      overtime_minutes = computed.overtime_minutes;
      if (!status) status = computed.status;
    }

    // 1. Identify if the log is an unworked absence
    const isAbsent =
      (!rawLog.time_in && !rawLog.time_out && (work_minutes || 0) === 0) ||
      (Boolean(status) && String(status).toLowerCase().includes("absent") && (work_minutes || 0) === 0);

    // 2. Determine if the log represents actual attendance
    const hasAttendance =
      !isAbsent &&
      Boolean(
        (rawLog.time_in && String(rawLog.time_in).trim() !== "") ||
        (rawLog.time_out && String(rawLog.time_out).trim() !== "") ||
        (work_minutes && work_minutes > 0)
      );

    const existing = summaryMap.get(uid);
    if (existing) {
      existing.total_work_minutes += work_minutes;
      existing.total_late_minutes += late_minutes;
      existing.total_undertime_minutes += undertime_minutes;
      existing.total_overtime_minutes += overtime_minutes;

      if (hasAttendance) {
        const dKey = dateKey || `${existing.attendedDates.size + 1}`;
        existing.attendedDates.add(dKey);
        existing.days_count = existing.attendedDates.size;
      }
    } else {
      const attendedDates = new Set();
      if (hasAttendance) {
        const dKey = dateKey || "1";
        attendedDates.add(dKey);
      }

      const u = userById.value.get(uid);
      const dName = u ? deptMap.value.get(Number(u.user_department)) : "";

      summaryMap.set(uid, {
        user_id: uid,
        user_fname: u?.user_fname || "",
        user_lname: u?.user_lname || "",
        department_id: Number(rawLog.department_id || u?.user_department || 0),
        department_name: dName || (u?.user_department ? `Dept #${u.user_department}` : ""),
        total_work_minutes: work_minutes,
        total_late_minutes: late_minutes,
        total_undertime_minutes: undertime_minutes,
        total_overtime_minutes: overtime_minutes,
        days_count: attendedDates.size,
        attendedDates,
        rawUser: u,
      });
    }
  });

  // Ensure candidate users in department are included so employees with 0 attendance show 0 Days
  let candidateUsers = users.value || [];
  if (departmentId.value > 0) {
    candidateUsers = candidateUsers.filter(u => Number(u.user_department) === Number(departmentId.value));
  }
  for (const u of candidateUsers) {
    const uid = Number(u.user_id);
    if (!summaryMap.has(uid)) {
      const dName = deptMap.value.get(Number(u.user_department)) || "";
      summaryMap.set(uid, {
        user_id: uid,
        user_fname: u.user_fname || "",
        user_lname: u.user_lname || "",
        department_id: Number(u.user_department || 0),
        department_name: dName || (u.user_department ? `Dept #${u.user_department}` : ""),
        total_work_minutes: 0,
        total_late_minutes: 0,
        total_undertime_minutes: 0,
        total_overtime_minutes: 0,
        days_count: 0,
        attendedDates: new Set(),
        rawUser: u,
      });
    }
  }

  return Array.from(summaryMap.values());
});

const filteredEmployeeSummaries = computed(() => {
  let list = employeeSummaries.value || [];
  if (!showInactive.value) {
    list = list.filter(s => !s.rawUser || isActiveUser(s.rawUser));
  }
  if (q.value) {
    const needle = q.value.toLowerCase();
    list = list.filter(s => {
      const name = `${s.user_fname} ${s.user_lname}`.toLowerCase();
      return String(s.user_id).includes(needle) || name.includes(needle);
    });
  }
  return list.sort((a, b) => `${a.user_fname} ${a.user_lname}`.localeCompare(`${b.user_fname} ${b.user_lname}`));
});

const selectedEmployeeDaysCount = computed(() => {
  if (!selectedEmployeeId.value) return 0;
  const s = employeeSummaries.value.find(x => x.user_id === Number(selectedEmployeeId.value));
  return s?.days_count ?? 0;
});

function openEmployeeFromSummary(s) {
  openEmployee({
    user_id: s.user_id,
    full_name: `${s.user_fname} ${s.user_lname}`.trim() || `User #${s.user_id}`,
    department_id: s.department_id,
    rawUser: s.rawUser,
  });
  viewMode.value = "cards";
}

/* Filter Logic for Left List */
const filteredPendingEmployees = computed(() => {
  let rows = Array.isArray(pendingEmployees.value) ? pendingEmployees.value : [];
  
  if (!showInactive.value) {
    rows = rows.filter(e => !e.rawUser || isActiveUser(e.rawUser));
  }

  if (q.value) {
    const needle = q.value.toLowerCase();
    rows = rows.filter((e) => {
      return String(e.user_id).includes(needle) || String(e.full_name || "").toLowerCase().includes(needle);
    });
  }

  const daysMap = new Map();
  for (const s of employeeSummaries.value) {
    daysMap.set(s.user_id, s.days_count);
  }

  return rows.map(e => ({
    ...e,
    days_count: daysMap.get(e.user_id) ?? 0,
  })).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
});

/* ================= APPROVAL LOGIC ================= */
const allDateRows = ref([]);
const cardFilter = ref("all"); // 'all' | 'attended' | 'pending'
const edit = ref({});
const savingKey = ref("");
const bulkSaving = ref(false);
const selectedPreviewKey = ref("");
const selectedPreviewLog = ref(null);

const attendedCount = computed(() =>
  (allDateRows.value || []).filter((r) => !r.no_log || (r.work_minutes && r.work_minutes > 0)).length
);
function isRowPendingAction(r) {
  const isLogPending = r.log_approve_status === "pending";
  const isOtPending = Boolean(r.otReq && String(r.otReq.status || "").toLowerCase() === "pending");
  return isLogPending || r.isMissing || isOtPending;
}

const pendingActionCount = computed(() =>
  (allDateRows.value || []).filter(isRowPendingAction).length
);

const dateRows = computed(() => {
  const rows = allDateRows.value || [];
  if (cardFilter.value === "attended") {
    const list = rows.filter((r) => !r.no_log || (r.work_minutes && r.work_minutes > 0));
    return list.length > 0 ? list : rows;
  }
  if (cardFilter.value === "pending") {
    return rows.filter(isRowPendingAction);
  }
  return rows;
});

function selectPreviewRow(r) {
  selectedPreviewKey.value = r?._key || "";
  selectedPreviewLog.value = r?.logRow || null;
}

function clampNonNegInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function initEditState() {
  const obj = {};
  for (const r of allDateRows.value || []) {
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

/* ================= FORMATTERS ================= */
function toHHmm(t) {
  if (!t) return "—";
  const s = String(t);
  const p = s.split(":");
  if (p.length >= 2) return `${String(p[0]).padStart(2, "0")}:${String(p[1]).padStart(2, "0")}`;
  return s;
}
function fmtTime(x) {
  if (!x) return "—";
  const d = dayjs(x);
  if (!d.isValid()) return "—";
  return d.format("h:mm A");
}
function fmtRangeTime(a, b) {
  const A = fmtTime(a);
  const B = fmtTime(b);
  if (A === "—" && B === "—") return "—";
  return `${A} - ${B}`;
}
function fmtMinutesToHHMM(mins) {
  const m = Math.max(0, Math.floor(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}m`;
}

/* ================= API ACTIONS ================= */
async function fetchAttendanceByEmployeeRange_SAFE(userId, dateFrom, dateTo) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[user_id][_eq]", String(userId));
  params.set("filter[log_date][_between]", `${dateFrom},${dateTo}`);
  params.set("sort", "-log_date");
  params.set("fields", "log_id,user_id,department_id,log_date,approve_status,time_in,time_out,lunch_start,lunch_end,break_start,break_end");
  const { data } = await api.get(`/items/attendance_log?${params.toString()}`);
  return data?.data ?? [];
}

async function loadPendingEmployees() {
  pageError.value = "";
  loading.value = true;
  try {
    const logParams = new URLSearchParams();
    logParams.set("limit", "-1");
    logParams.set("filter[log_date][_between]", `${rangeFrom.value},${rangeTo.value}`);
    logParams.set("fields", "log_id,user_id,department_id,log_date,time_in,time_out,approve_status,status");
    if (Number(departmentId.value || 0) > 0) {
      logParams.set("filter[department_id][_eq]", String(departmentId.value));
    }

    const appParams = new URLSearchParams();
    appParams.set("limit", "-1");
    appParams.set("filter[date_schedule][_between]", `${rangeFrom.value},${rangeTo.value}`);
    appParams.set("fields", "approval_id,employee_id,date_schedule,status,work_minutes,late_minutes,undertime_minutes,overtime_minutes,remarks");

    const [logsRes, appsRes] = await Promise.all([
      api.get(`/items/attendance_log?${logParams.toString()}`),
      api.get(`/items/attendance_approval?${appParams.toString()}`),
    ]);

    const logs = logsRes?.data?.data ?? [];
    const approvals = appsRes?.data?.data ?? [];

    rawCutoffLogs.value = logs;
    rawCutoffApprovals.value = approvals;

    const approvedMap = new Set(approvals.map(a => `${a.employee_id}_${String(a.date_schedule).slice(0, 10)}`));

    // Filter: Pending logs: (Status is Pending) OR (No Approval Record exists)
    const pendingLogs = logs.filter(l => {
      const isLogPending = l.approve_status === 'pending';
      const dateKey = String(l.log_date || '').slice(0, 10);
      const isMissingFromApprovalTable = !approvedMap.has(`${l.user_id}_${dateKey}`);
      return isLogPending || isMissingFromApprovalTable;
    });

    const byUser = new Map();
    for (const l of pendingLogs) {
      const uid = Number(l.user_id);
      if (!uid) continue;
      const deptId = Number(l.department_id || 0);
      const u = userById.value.get(uid);
      
      const name = u ? `${u.user_fname || ""} ${u.user_lname || ""}`.trim() : `User #${uid}`;
      if (!byUser.has(uid)) {
        byUser.set(uid, { user_id: uid, full_name: name, department_id: deptId, pending_days: 0, rawUser: u });
      }
      byUser.get(uid).pending_days += 1;
    }

    pendingEmployees.value = Array.from(byUser.values());
    closeEmployee();
  } catch (err) {
    console.error("Load pending failed:", err);
    pageError.value = "Load pending failed: " + (err?.message || "Unknown error");
  } finally {
    loading.value = false;
  }
}

async function openEmployee(e) {
  cardFilter.value = "all";
  selectedEmployeeId.value = Number(e.user_id);
  selectedEmployeeName.value = e.full_name;
  selectedEmployeeDeptId.value = Number(e.department_id || 0);
  await loadEmployeeRows();
}

function closeEmployee() {
  selectedEmployeeId.value = 0;
  selectedEmployeeName.value = "";
  selectedEmployeeDeptId.value = null;
  allDateRows.value = [];
  edit.value = {};
  selectedPreviewKey.value = "";
  selectedPreviewLog.value = null;
}

async function bulkSetStatus(status) {
  const empId = Number(selectedEmployeeId.value);
  if (!empId || empId === 0) {
    pageError.value = "Bulk save failed: employee_id is missing. Please re-select the employee.";
    return;
  }

  bulkSaving.value = true;
  pageError.value = "";
  
  try {
    const approvedBy = Number(currentUser.value?.user_id ?? currentUser.value?.id ?? 0);
    
    for (const row of dateRows.value) {
      const e = edit.value[row._key] || {};
      
      const payload = {
        employee_id: empId,
        date_schedule: String(row.date_schedule),
        approved_by: approvedBy,
        work_minutes: clampNonNegInt(e.work_minutes),
        late_minutes: clampNonNegInt(e.late_minutes),
        undertime_minutes: clampNonNegInt(e.undertime_minutes),
        overtime_minutes: clampNonNegInt(e.overtime_minutes),
        remarks: (e.remarks ?? "").trim() || null,
        status: status,
      };

      if (!row.approval_id) {
        await createAttendanceApproval(payload);
      } else {
        await updateAttendanceApproval(row.approval_id, payload);
      }

      if (row.log_id) {
        await updateAttendanceLog(row.log_id, { approve_status: status });
      }
    }

    await loadEmployeeRows();
    await loadPendingEmployees();
  } catch (err) {
    console.error("Bulk action failed:", err);
    const apiError = err?.response?.data?.errors?.[0]?.message;
    pageError.value = `Bulk action failed: ${apiError || err.message}`;
  } finally {
    bulkSaving.value = false;
  }
}

async function loadEmployeeRows() {
  if (!selectedEmployeeId.value) return;
  pageError.value = "";
  tableLoading.value = true;
  try {
    const dates = buildDateList(rangeFrom.value, rangeTo.value);
    const [approvals, logs, overtimes] = await Promise.all([
      fetchAttendanceApprovalsByEmployeeRange(selectedEmployeeId.value, rangeFrom.value, rangeTo.value),
      fetchAttendanceByEmployeeRange_SAFE(selectedEmployeeId.value, rangeFrom.value, rangeTo.value),
      fetchOvertimeRequestsByEmployeeRange(selectedEmployeeId.value, rangeFrom.value, rangeTo.value),
    ]);

    const apprByDate = new Map();
    for (const a of approvals || []) {
      const dt = String(a.date_schedule || '').slice(0, 10);
      if (dt) apprByDate.set(dt, a);
    }
    
    const logByDate = new Map();
    for (const l of logs || []) {
      const dt = String(l.log_date || '').slice(0, 10);
      if (dt) logByDate.set(dt, l);
    }
    
    const otByDate = new Map();
    for (const ot of overtimes || []) {
      const dt = String(ot.request_date || '').slice(0, 10);
      if (dt) otByDate.set(dt, ot);
    }
    
    const user = userById.value.get(Number(selectedEmployeeId.value));

    const allRows = dates.map((d) => {
      const a = apprByDate.get(d) || null;
      const l = logByDate.get(d) || null;
      const otReq = otByDate.get(d) || null;
      const approvalId = a?.approval_id ?? a?.id ?? null;

      const schedule = getEmployeeScheduleForDate(selectedEmployeeId.value, selectedEmployeeDeptId.value, d);

      // START: Computation Logic
      let work_minutes = Number(a?.work_minutes ?? 0);
      let late_minutes = Number(a?.late_minutes ?? 0);
      let undertime_minutes = Number(a?.undertime_minutes ?? 0);
      let overtime_minutes = Number(a?.overtime_minutes ?? 0);

      const hasApprovedOt = otReq && String(otReq.status || '').toLowerCase() === 'approved';

      // If values are 0 OR the record is missing, compute from logs using new rules
      if (l && (!approvalId || (work_minutes === 0 && late_minutes === 0 && undertime_minutes === 0 && overtime_minutes === 0))) {
        const computed = computeApprovalMinutes(d, l, schedule, otReq, user, noTimeOutPenalty.value);
        work_minutes = computed.work_minutes;
        late_minutes = computed.late_minutes;
        undertime_minutes = computed.undertime_minutes;
        overtime_minutes = computed.overtime_minutes;
      } else if (l && overtime_minutes === 0 && hasApprovedOt) {
        const computed = computeApprovalMinutes(d, l, schedule, otReq, user, noTimeOutPenalty.value);
        if (computed.overtime_minutes > 0) {
          overtime_minutes = computed.overtime_minutes;
        }
      }

      return {
        _key: approvalId ? `appr-${approvalId}` : `d-${d}`,
        date_schedule: d,
        approval_id: approvalId,
        isMissing: !approvalId,
        remarks: a?.remarks ?? "",
        status: a?.status ?? "approved",
        work_minutes,
        late_minutes,
        undertime_minutes,
        overtime_minutes,
        log_id: l?.log_id ?? null,
        log_approve_status: l?.approve_status ?? null,
        logRow: l,
        otReq,
        no_log: !l,
        schedule,
      };
    });

    allDateRows.value = allRows;
    initEditState();
  } catch (err) {
    pageError.value = "Load rows failed: " + err.message;
  } finally {
    tableLoading.value = false;
  }
}

async function recomputeRow(r) {
  try {
    if (!r?.log_id) return;
    const user = userById.value.get(Number(selectedEmployeeId.value));
    const schedule = getEmployeeScheduleForDate(selectedEmployeeId.value, r.department_id || selectedEmployeeDeptId.value, r.date_schedule);
    const computed = computeApprovalMinutes(r.date_schedule, r.logRow, schedule, r.otReq, user, noTimeOutPenalty.value);
    edit.value[r._key] = { ...(edit.value[r._key] || {}), ...computed };
  } catch (err) { console.error(err); }
}

async function recomputeAll() {
  bulkSaving.value = true;
  try {
    const user = userById.value.get(Number(selectedEmployeeId.value));
    for (const r of dateRows.value) {
      if (!r.log_id) continue;
      const schedule = getEmployeeScheduleForDate(selectedEmployeeId.value, selectedEmployeeDeptId.value, r.date_schedule);
      const computed = computeApprovalMinutes(r.date_schedule, r.logRow, schedule, r.otReq, user, noTimeOutPenalty.value);
      edit.value[r._key] = { ...(edit.value[r._key] || {}), ...computed };
    }
  } finally { bulkSaving.value = false; }
}

async function saveApprovalRow(row) {
  const empId = Number(selectedEmployeeId.value);
  if (!empId || empId === 0) {
    pageError.value = "Save failed: employee_id is missing.";
    return;
  }

  savingKey.value = row._key;
  pageError.value = "";
  
  try {
    const approvedBy = Number(currentUser.value?.user_id ?? currentUser.value?.id ?? 0);
    const e = edit.value[row._key] || {};
    
    const payload = {
      employee_id: empId,
      date_schedule: String(row.date_schedule),
      approved_by: approvedBy,
      work_minutes: clampNonNegInt(e.work_minutes),
      late_minutes: clampNonNegInt(e.late_minutes),
      undertime_minutes: clampNonNegInt(e.undertime_minutes),
      overtime_minutes: clampNonNegInt(e.overtime_minutes),
      remarks: (e.remarks ?? "").trim() || null,
      status: e.status === "rejected" ? "rejected" : "approved",
    };

    if (!row.approval_id) {
      await createAttendanceApproval(payload);
    } else {
      await updateAttendanceApproval(row.approval_id, payload);
    }

    if (row.log_id) {
      await updateAttendanceLog(row.log_id, { approve_status: payload.status });
    }

    await loadEmployeeRows();
    await loadPendingEmployees();
  } catch (err) {
    console.error("SAVE ERROR:", err);
    pageError.value = `Save failed: ${err.message}`;
  } finally {
    savingKey.value = "";
  }
}

async function approveAllVisible() { await bulkSetStatus("approved"); }
async function rejectAllVisible() { await bulkSetStatus("rejected"); }

async function bootAfterAuth() {
  loading.value = true;
  try {
    const [u, d, s, us, ocL, ocS, penalty] = await Promise.all([
      fetchUsers(),
      fetchDepartments(),
      fetchSchedules(),
      fetchUserSchedules(),
      fetchOnCallList(),
      fetchOnCallSchedules(),
      fetchNoTimeOutUndertimePenalty(),
    ]);
    users.value = u || [];
    departments.value = d || [];
    schedules.value = s || [];
    userSchedules.value = us || [];
    onCallList.value = ocL || [];
    onCallSchedules.value = ocS || [];
    noTimeOutPenalty.value = penalty ?? 240;
    pendingEmployees.value = [];
    closeEmployee();
    await loadPendingEmployees();
  } catch (err) {
    console.error("Boot failed:", err);
    pageError.value = "Boot failed: " + (err?.message || "Unknown error");
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
onUnmounted(() => { if (_nowTimer) clearInterval(_nowTimer); });

watch([cutoff, monthPick, departmentId], () => {
  pendingEmployees.value = [];
  rawCutoffLogs.value = [];
  rawCutoffApprovals.value = [];
  closeEmployee();
});
</script>

<style scoped>
/* ================= GLOBAL / UTILS ================= */
.row { width: 100%; max-width: 100%; box-sizing: border-box; }
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 14px 34px rgba(17,24,39,.06);
}
.muted { color:#6b7280; }
.spinner{
  width:14px; height:14px; border-radius:999px;
  border:2px solid rgba(255,255,255,.55); border-top-color: rgba(255,255,255,1);
  animation: spin .7s linear infinite;
}
.btn-ghost .spinner{ border-color: rgba(17,24,39,.22); border-top-color: rgba(17,24,39,.55); }
@keyframes spin { to { transform: rotate(360deg); } }

/* Login & Header Styles */
.header-row { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:14px; }
.header-left .title { font-size:22px; font-weight:900; margin:0; letter-spacing:-.2px; color:#111827; }
.subtitle { margin:6px 0 0; color:#6b7280; font-size:13px; }
.header-right { display:flex; align-items:center; gap:10px; }
.now-badge { display:inline-flex; flex-direction:column; align-items:flex-end; padding:10px 12px; border-radius:14px; background:#f9fafb; border:1px solid #e5e7eb; }
.now-badge .time { font-weight:900; font-size:18px; line-height:1.1; color:#111827; }
.now-badge .date { font-size:12px; color:#6b7280; margin-top:2px; }
.login-card { max-width: 580px; margin: 20px auto; }
.login-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.field label { display:block; font-size:12px; color:#6b7280; margin-bottom:6px; font-weight:800; }
select, input { width:100%; height:44px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:12px; outline:none; font-size:14px; background:#fff; color:#111827; }
.btn-wide { width:100%; height:44px; }

/* Controls (Stacked Inputs) */
.controls { background: linear-gradient(180deg,#fbfdff,#fff); border:1px solid #e5e7eb; border-radius:16px; padding:14px; margin-bottom:12px; }
.controls-top { display:grid; grid-template-columns:1fr 1fr 1fr .9fr; gap:12px; }
.controls-bottom { display:grid; grid-template-columns:1.6fr 1fr .9fr; gap:12px; margin-top:12px; }
@media (max-width:980px){
  .controls-top { grid-template-columns:1fr; }
  .controls-bottom { grid-template-columns:1fr; }
}
.range-pill{ height:44px; display:flex; align-items:center; gap:10px; padding:0 12px; border-radius:12px; background:#fff; border:1px solid #e5e7eb; color:#111827; font-weight:900; font-size:12px; }
.range-pill__dot{ width:10px; height:10px; border-radius:999px; background: rgba(6,95,70,.85); box-shadow:0 0 0 4px rgba(6,95,70,.12); }

/* ================= SPLIT LAYOUT ================= */
.split { display:grid; grid-template-columns:320px minmax(0, 1fr); gap:12px; align-items: start; }
@media (max-width: 900px){ .split{ grid-template-columns:1fr; } }
.panel{ border:1px solid #e5e7eb; border-radius:16px; background:#fff; padding:12px; }
.panel-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:10px; }
.panel-title{ font-weight:900; color:#111827; }
.panel-sub{ font-size:12px; color:#6b7280; }

/* ================= EMPLOYEE LIST ================= */
.emp-list{ display:flex; flex-direction:column; gap:8px; }
.emp-item{
  width: 100%; border:1px solid #e5e7eb; border-radius:14px; padding:12px; text-align:left;
  background: linear-gradient(180deg,#fbfdff,#fff); cursor:pointer;
  transition: transform .05s ease, border-color .12s ease;
}
.emp-item:hover{ border-color: rgba(17,24,39,.25); }
.emp-item.active{ border-color: rgba(6,95,70,.35); background: linear-gradient(180deg,#ecfdf5,#fff); }
.emp-item__row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.emp-item__name{ font-weight:900; color:#111827; }
.emp-item__meta{ font-size:12px; color:#6b7280; margin-top:6px; }

.pill{ display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:900; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; white-space: nowrap; }
.pill-warning{ background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.25); color:#92400e; }
.pill-danger{ background:#fef3f2; border-color:#fee2e2; color:#b42318; }
.pill-success{ background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
.pill-muted{ color: #6b7280; }

/* ================= BUTTONS ================= */
.btn{ height:38px; padding:0 12px; border-radius:12px; font-weight:900; font-size:12px; border:1px solid transparent; cursor:pointer; display:inline-flex; align-items:center; justify-content: center; gap:8px; white-space: nowrap; }
.btn-sm{ height:32px; padding:0 10px; font-size:11px; }
.btn-primary{ background:#065f46; color:#fff; }
.btn-ghost{ background:#fff; color:#374151; border-color:#e5e7eb; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ================= EMPLOYEE HEADER ================= */
.emp-meta { padding:14px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
.emp-meta__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap: wrap; gap: 10px;}
.emp-meta__name { font-weight:900; font-size:18px; color:#111827; }
.emp-meta__actions { display:flex; gap:6px; }
.emp-meta__sub { font-size:12px; color:#6b7280; }
.mono{ font-family: monospace; }
.dot { margin: 0 5px; }

/* ================= CARD FILTER TOOLBAR ================= */
.card-filter-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
}
.card-filter-group {
    display: inline-flex;
    background: #f3f4f6;
    padding: 3px;
    border-radius: 10px;
    gap: 3px;
}
.card-filter-btn {
    border: none;
    background: transparent;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.15s ease;
}
.card-filter-btn:hover {
    color: #111827;
}
.card-filter-btn.active {
    background: #fff;
    color: #065f46;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.card-filter-count {
    font-size: 12px;
}

/* ================= CARD LIST VIEW (The new layout) ================= */
.approval-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.approval-card {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.approval-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-color: #d1d5db; }
.card-missing { background: #fdfdfd; border-style: dashed; }
.card-pending { border-color: #fcd34d; }
.activeCard { border-color: #065f46; background-color: #f0fdf4; }

/* 1. HEADER ROW */
.ac-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f3f4f6;
    padding-bottom: 10px;
    flex-wrap: wrap;
    gap: 10px;
}
.ac-date { display: flex; flex-direction: column; }
.date-text { font-weight: 900; font-size: 15px; color: #111827; }
.day-text { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }

.ac-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.status-select-inline {
    height: 30px;
    padding: 0 10px;
    border-radius: 99px;
    font-size: 12px;
    width: auto;
    font-weight: 800;
    cursor: pointer;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
}

/* 2. LOG ROW */
.ac-log-section {
    background: #f9fafb;
    border-radius: 10px;
    padding: 10px;
}
.log-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    font-size: 12px;
    color: #4b5563;
}
.lk b { color: #111827; font-weight: 700; display: block; }
@media (max-width: 600px) { .log-grid { grid-template-columns: 1fr 1fr; } }

/* 3. INPUTS ROW */
.ac-inputs-section {
    display: flex;
    gap: 10px;
    align-items: flex-end;
}
@media (max-width: 700px) { .ac-inputs-section { flex-wrap: wrap; } }

.input-group { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.input-group.grow { flex: 2; min-width: 150px; }
.input-group label { font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; }
.input-group input {
    height: 36px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    width: 100%;
}
.input-group input:focus { border-color: #065f46; box-shadow: 0 0 0 2px rgba(6,95,70,0.1); outline: none; }

/* 4. ACTIONS ROW */
.ac-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px dashed #e5e7eb;
}

.mini-warn { color: #b42318; font-size: 12px; font-weight: 700; }
.error-box { margin-top:12px; color:#b42318; background:#fef3f2; border:1px solid #fee2e2; border-radius:12px; padding:12px; white-space:pre-wrap; font-size:13px; }
.loading-note{ padding:14px; color:#6b7280; font-size:13px; display:flex; align-items:center; gap:10px; }
.empty-state{
  border:1px dashed rgba(17,24,39,.22);
  border-radius:16px;
  padding:18px;
  background: linear-gradient(180deg,#fbfdff,#fff);
}
.empty-title{ font-weight:900; color:#111827; font-size:15px; }
.empty-sub{ margin-top:6px; color:#6b7280; font-size:13px; }

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

/* ================= VIEW TABS ================= */
.view-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-weight: 800;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}
.tab-btn.active {
  background: #065f46;
  color: #fff;
  border-color: #065f46;
  box-shadow: 0 4px 12px rgba(6,95,70,0.18);
}
.tab-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  background: rgba(255,255,255,0.25);
  color: inherit;
}
.tab-btn:not(.active) .tab-pill {
  background: #e5e7eb;
  color: #374151;
}
.tab-btn:not(.active) .tab-pill--warning {
  background: rgba(245,158,11,0.18);
  color: #92400e;
}

/* ================= CUTOFF SUMMARY TABLE ================= */
.summary-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
}
.summary-table-wrap {
  width: 100%;
  overflow-x: auto;
  margin-top: 10px;
}
.summary-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.summary-table th {
  padding: 12px 14px;
  background: #f9fafb;
  color: #4b5563;
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}
.summary-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.summary-table tr:hover td {
  background: #f9fafb;
}

.emp-summary-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #111827;
}

/* ================= ATTENDED DAYS BADGES (Part 3.4) ================= */
.badge-days {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 12px;
  border: 1px solid rgba(0,0,0,0.1);
  white-space: nowrap;
}
.badge-days--active {
  background: #ecfdf5;
  color: #065f46;
  border-color: #a7f3d0;
}
.badge-days--zero {
  background: #f9fafb;
  color: #9ca3af;
  border-color: #e5e7eb;
}
.badge-days-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.pill-xs {
  font-size: 10px;
  padding: 1px 6px;
  line-height: 1.3;
}
.pill-oncall {
  background: #e0f2fe;
  color: #0369a1;
  border-color: #bae6fd;
}

.text-danger { color: #dc2626; font-weight: 700; }
.text-warning { color: #d97706; font-weight: 700; }
.text-success { color: #059669; font-weight: 700; }
</style>