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

      <div class="split">
        
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
                  <span v-if="e.rawUser && !isActiveUser(e.rawUser)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
                </div>
                <span class="pill pill-warning">{{ e.pending_days }} pending</span>
              </div>
              <div class="emp-item__meta">
                <span class="mono">#{{ e.user_id }}</span>
                <span class="dot">•</span>
                Dept <span class="mono">{{ e.department_id }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="panel panel--wide card-panel">
          <div v-if="!selectedEmployeeId" class="empty-state" style="margin-top: 0">
            <div class="empty-title">Select an employee</div>
            <div class="empty-sub">Click an employee on the left to review attendance.</div>
          </div>

          <template v-else>
            <div class="emp-meta" style="margin-bottom: 12px">
              <div class="emp-meta__top">
                <div class="emp-meta__name">{{ selectedEmployeeName }}</div>
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
  createAttendanceApproval,
  updateAttendanceApproval,
  updateAttendanceLog,
  computeCutoffRange,
  computeApprovalMinutes,
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
  departments.value = [];
  schedules.value = [];
  userSchedules.value = [];
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

function getScheduleForDept(deptId) {
  return scheduleByDeptId.value.get(Number(deptId || 0)) || null;
}
function getScheduleForUser(userId) {
  return scheduleByUserId.value.get(Number(userId || 0)) || null;
}
const selectedSchedule = computed(() => getScheduleForUser(selectedEmployeeId.value) || getScheduleForDept(selectedEmployeeDeptId.value));

/* Filter Logic */
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
  return rows.slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
});

/* ================= APPROVAL LOGIC ================= */
const dateRows = ref([]);
const edit = ref({});
const savingKey = ref("");
const bulkSaving = ref(false);
const selectedPreviewKey = ref("");
const selectedPreviewLog = ref(null);

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
  for (const r of dateRows.value || []) {
    obj[r._key] = {
      work_minutes: clampNonNegInt(r.work_minutes),
      late_minutes: clampNonNegInt(r.late_minutes),
      undertime_minutes: clampNonNegInt(r.undertime_minutes),
      overtime_minutes: 0,
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
    overtime_minutes: 0,
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
    if(!x) return "—";
    const d = dayjs(x);
    if (!d.isValid()) return "—";
    return d.format("h:mm A");
}
function fmtRangeTime(a, b) {
    const A = fmtTime(a);
    const B = fmtTime(b);
    if(A === "—" && B === "—") return "—";
    return `${A} - ${B}`;
}
/* Legacy formatter kept for safety if used elsewhere */
function fmtDT(x) {
  if (!x) return "";
  const d = dayjs(x);
  if (!d.isValid()) return "";
  return d.format("YYYY-MM-DD h:mm A");
}

/* ================= API ACTIONS ================= */
async function fetchPendingLogs(dateFrom, dateTo, deptId) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[log_date][_between]", `${dateFrom},${dateTo}`);
  params.set("fields", "log_id,user_id,department_id,log_date,approve_status");
  
  if (Number(deptId || 0) > 0) params.set("filter[department_id][_eq]", String(deptId));

  // 1. Get all logs in range
  const { data: logsData } = await api.get(`/items/attendance_log?${params.toString()}`);
  const logs = logsData?.data ?? [];

  // 2. Get existing approvals in range
  const { data: appData } = await api.get(`/items/attendance_approval?limit=-1&filter[date_schedule][_between]=${dateFrom},${dateTo}`);
  const approvals = appData?.data ?? [];
  
  // Create a lookup Set: "UserId_Date"
  const approvedMap = new Set(approvals.map(a => `${a.employee_id}_${a.date_schedule}`));

  // 3. Filter: Keep only if (Status is Pending) OR (No Approval Record exists)
  return logs.filter(l => {
    const isLogPending = l.approve_status === 'pending';
    const isMissingFromApprovalTable = !approvedMap.has(`${l.user_id}_${l.log_date}`);
    
    return isLogPending || isMissingFromApprovalTable;
  });
}

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
    const logs = await fetchPendingLogs(rangeFrom.value, rangeTo.value, departmentId.value);
    const byUser = new Map();
    for (const l of logs) {
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
  selectedEmployeeId.value = Number(e.user_id); // Set ID first
  selectedEmployeeName.value = e.full_name;
  selectedEmployeeDeptId.value = Number(e.department_id || 0);
  await loadEmployeeRows(); // Then load
}

function closeEmployee() {
  selectedEmployeeId.value = 0;
  selectedEmployeeName.value = "";
  selectedEmployeeDeptId.value = null;
  dateRows.value = [];
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
    
    // We iterate through dateRows and perform API calls directly
    for (const row of dateRows.value) {
      const e = edit.value[row._key] || {};
      
      const payload = {
        employee_id: empId,
        date_schedule: String(row.date_schedule),
        approved_by: approvedBy,
        work_minutes: clampNonNegInt(e.work_minutes),
        late_minutes: clampNonNegInt(e.late_minutes),
        undertime_minutes: clampNonNegInt(e.undertime_minutes),
        overtime_minutes: 0,
        remarks: (e.remarks ?? "").trim() || null,
        status: status, // Applying the bulk status (approved/rejected)
      };

      // STEP 1: Save Approval Record
      if (!row.approval_id) {
        await createAttendanceApproval(payload);
      } else {
        await updateAttendanceApproval(row.approval_id, payload);
      }

      // STEP 2: Update raw log
      if (row.log_id) {
        await updateAttendanceLog(row.log_id, { approve_status: status });
      }
    }

    // STEP 3: REFRESH UI ONLY ONCE AFTER ALL CALLS FINISH
    await loadEmployeeRows();
    await loadPendingEmployees();
    
    console.log("Bulk processing complete.");
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
    const [approvals, logs] = await Promise.all([
      fetchAttendanceApprovalsByEmployeeRange(selectedEmployeeId.value, rangeFrom.value, rangeTo.value),
      fetchAttendanceByEmployeeRange_SAFE(selectedEmployeeId.value, rangeFrom.value, rangeTo.value),
    ]);

    const apprByDate = new Map();
    for (const a of approvals || []) apprByDate.set(String(a.date_schedule), a);
    
    const logByDate = new Map();
    for (const l of logs || []) logByDate.set(String(l.log_date), l);
    
    const schedule = getScheduleForUser(selectedEmployeeId.value) || getScheduleForDept(selectedEmployeeDeptId.value);

    const allRows = dates.map((d) => {
      const a = apprByDate.get(d) || null;
      const l = logByDate.get(d) || null;
      const approvalId = a?.approval_id ?? a?.id ?? null;

      // START: Computation Logic
      let work_minutes = Number(a?.work_minutes ?? 0);
      let late_minutes = Number(a?.late_minutes ?? 0);
      let undertime_minutes = Number(a?.undertime_minutes ?? 0);

      // If values are 0 OR the record is missing, compute from logs
      if (l && (!approvalId || (work_minutes === 0 && late_minutes === 0 && undertime_minutes === 0))) {
        const computed = computeApprovalMinutes(d, l, schedule);
        work_minutes = computed.work_minutes;
        late_minutes = computed.late_minutes;
        undertime_minutes = computed.undertime_minutes;
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
        log_id: l?.log_id ?? null,
        log_approve_status: l?.approve_status ?? null,
        logRow: l,
        no_log: !l,
      };
    });

    // Only show rows that still need action (Pending logs or Missing records)
    dateRows.value = allRows.filter(r => {
      return r.log_approve_status === 'pending' || r.isMissing;
    });

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
    const schedule = getScheduleForUser(selectedEmployeeId.value) || getScheduleForDept(r.department_id || selectedEmployeeDeptId.value);
    const computed = computeApprovalMinutes(r.date_schedule, r.logRow, schedule);
    edit.value[r._key] = { ...(edit.value[r._key] || {}), ...computed, overtime_minutes: 0 };
  } catch (err) { console.error(err); }
}

async function recomputeAll() {
  bulkSaving.value = true;
  try {
    const schedule = getScheduleForUser(selectedEmployeeId.value) || getScheduleForDept(selectedEmployeeDeptId.value);
    for (const r of dateRows.value) {
      if (!r.log_id) continue;
      const computed = computeApprovalMinutes(r.date_schedule, r.logRow, schedule);
      edit.value[r._key] = { ...(edit.value[r._key] || {}), ...computed, overtime_minutes: 0 };
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
      overtime_minutes: 0,
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
    const [u, d, s, us] = await Promise.all([fetchUsers(), fetchDepartments(), fetchSchedules(), fetchUserSchedules()]);
    users.value = u || [];
    departments.value = d || [];
    schedules.value = s || [];
    userSchedules.value = us || [];
    pendingEmployees.value = [];
    closeEmployee();
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
</style>