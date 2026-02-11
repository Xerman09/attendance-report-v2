<template>
  <section class="page">
    <!-- Header / Filters + KPIs -->
    <div class="card header-card">
      <div class="header-top">
        <h3 class="title">Department Reports</h3>

        <!-- Right side: Pretty range + Print -->
        <div class="header-actions">
          <div class="range-wrap">
            <span class="range-icon" aria-hidden="true">🗓️</span>
            <span class="range-badge">{{ prettyRange }}</span>
          </div>

          <button class="btn btn-print no-print" @click="printDetails">
            <svg
                class="btn-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
            >
              <path
                  d="M6 9V2h12v7h1a3 3 0 0 1 3 3v5h-4v4H6v-4H2v-5a3 3 0 0 1 3-3h1Zm2-7h8v7H8V2Zm8 18H8v2h8v-2ZM4 12v3h16v-3a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1Zm3-7h8v2H7V5Z"
              />
            </svg>
            <span>Print</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="field">
          <label>Department</label>
          <select v-model.number="deptId">
            <option
                v-for="d in departments"
                :key="d.department_id"
                :value="d.department_id"
            >
              {{ d.department_name }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>Date From</label>
          <input type="date" v-model="startDate" :min="minStartStr" :max="yesterdayStr" />
        </div>

        <div class="field">
          <label>Date To</label>
          <input
              type="date"
              v-model="endDate"
              :min="startDate || minStartStr"
              :max="yesterdayStr"
          />
        </div>

        <div class="field grow">
          <label>Search by name</label>
          <input v-model="q" placeholder="Type a name..." />
        </div>
      </div>

      <!-- KPIs under filters -->
      <div class="kpi-grid no-print">
        <div class="kpi-card">
          <div class="kpi-label">Total Overtime (hrs)</div>
          <div class="kpi-value">{{ totalOvertimeHHMM }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Late (hrs)</div>
          <div class="kpi-value">{{ totalLateHHMM }}</div>
        </div>
      </div>

      <!-- Consistently On Time -->
      <div class="consistent no-print">
        <div class="consistent-head">
          <div class="consistent-title">
            <span class="dot dot-ok"></span> Consistently On Time
          </div>
          <div v-if="consistentNames.length" class="consistent-count">
            {{ consistentNames.length }} employee(s)
          </div>
        </div>

        <div v-if="consistentNames.length" class="chips">
          <span v-for="n in consistentNames" :key="n" class="chip-pill">{{ n }}</span>
        </div>
        <div v-else class="muted">None</div>
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div class="table-wrap" ref="printRef">
        <template v-for="group in groups" :key="group.ymd">
          <h4 class="day-heading">
            {{ dayjs(group.ymd).format("MMM D, YYYY") }}
          </h4>
          <table class="table">
            <thead>
            <tr>
              <th class="col-name">Name</th>
              <th>Work Hours</th>
              <th>Overtime</th>
              <th>Late</th>
              <th>Punctuality</th>
              <th>Status</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="r in group.rows"
                :key="r.key"
                :class="{ 'row-consistent': r.consistentlyOnTime }"
            >
              <td class="col-name">
                <div class="emp-name">
                  {{ r.empName || r.name || r.employee_name || "-" }}
                </div>
              </td>
              <td class="mono">
                {{
                  typeof r.workMinutes === "number" ? minutesToHHMM(r.workMinutes) : "-"
                }}
              </td>
              <td class="mono">
                {{
                  typeof r.overtimeMinutes === "number"
                      ? minutesToHHMM(r.overtimeMinutes)
                      : "-"
                }}
              </td>
              <td class="mono">
                {{
                  typeof r.lateMinutes === "number" ? minutesToHHMM(r.lateMinutes) : "-"
                }}
              </td>
              <td>
                  <span
                      class="chip"
                      :class="
                      r.punctuality === 'On Time'
                        ? 'chip-ok'
                        : r.punctuality === 'Late'
                        ? 'chip-warn'
                        : 'chip-muted'
                    "
                  >{{ r.punctuality }}</span
                  >
              </td>
              <td>
                  <span
                      class="chip"
                      :class="
                      computeRowStatus(r) === 'Present'
                        ? 'chip-ok'
                        : computeRowStatus(r) === 'Absent'
                        ? 'chip-danger'
                        : 'chip-muted'
                    "
                  >{{ computeRowStatus(r) }}</span
                  >
              </td>
            </tr>
            <tr v-if="group.rows.length === 0">
              <td colspan="6" class="muted center">No records.</td>
            </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import dayjs from "dayjs";
import {
  fetchUsers,
  fetchDepartments,
  fetchSchedules,
  fetchAttendance,
  fetchOnCallList,
  fetchOnCallSchedules,
} from "../../services/api";
import { computeStatus, minutesToHHMM } from "../../utils/time";

const users = ref([]);
const departments = ref([]);
const schedules = ref([]);
const attendance = ref([]);

/* --- jake-oncall datasets --- */
const onCallList = ref([]);
const onCallSchedules = ref([]);

const deptId = ref(0);

/* Date constraints */
const minStartStr = computed(() => dayjs("2025-10-10").format("YYYY-MM-DD"));
const yesterdayStr = computed(() => dayjs().subtract(1, "day").format("YYYY-MM-DD"));

/* Defaults: From = yesterday; To = yesterday */
const startDate = ref(yesterdayStr.value);
const endDate = ref(yesterdayStr.value);

const q = ref("");

const printRef = ref(null);

/* ---------------- Inactive detection (hide anywhere) ---------------- */
function isActiveUser(u) {
  const v = u?.is_deleted;
  if (v && typeof v === "object" && Array.isArray(v.data)) {
    return Number(v.data?.[0] ?? 0) !== 1; // Buffer style {type:'Buffer',data:[0|1]}
  }
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v !== 1;
  if (typeof v === "string") return v !== "1" && v.toLowerCase() !== "true";
  return true; // treat missing flag as active
}
const activeUsers = computed(() =>
    Array.isArray(users.value) ? users.value.filter(isActiveUser) : []
);
/* ------------------------------------------------------------------- */

const scheduleByDeptId = computed(() => {
  const m = new Map();
  for (const s of schedules.value) m.set(s.department_id, s);
  return m;
});

/* --- jake-oncall lookups --- */
const onCallRowsByUserId = computed(() => {
  const m = new Map();
  for (const row of onCallList.value) {
    const uid = Number(row.user_id ?? row.user ?? row.employee_id);
    if (!uid) continue;
    if (!m.has(uid)) m.set(uid, []);
    m.get(uid).push(row);
  }
  return m;
});
const onCallScheduleById = computed(() => {
  const m = new Map();
  for (const s of onCallSchedules.value) m.set(Number(s.id), s);
  return m;
});

/* Determine effective schedule for a given user and date (jake-oncall) */
function getEffectiveScheduleForDate(userId, ymd) {
  const deptSched =
      scheduleByDeptId.value.get(
          activeUsers.value.find((u) => u.user_id === userId)?.user_department
      ) || null;
  const rows = onCallRowsByUserId.value.get(Number(userId)) || [];
  const today = dayjs(ymd, "YYYY-MM-DD");

  for (const oc of rows) {
    const schedId = Number(oc.dept_sched_id ?? oc.dept_schedule_id ?? oc.schedule_id);
    if (!schedId) continue;
    const ocSched = onCallScheduleById.value.get(schedId);
    if (!ocSched) continue;

    const startStr = String(ocSched.schedule_date ?? ocSched.date ?? "");
    if (!startStr) continue;
    const start = dayjs(startStr, "YYYY-MM-DD");
    if (!start.isValid()) continue;

    const span = Number(ocSched.working_days ?? deptSched?.working_days ?? 1);
    const end = start.add(Math.max(1, span) - 1, "day"); // inclusive

    if (
        (today.isAfter(start, "day") || today.isSame(start, "day")) &&
        (today.isBefore(end, "day") || today.isSame(end, "day"))
    ) {
      return { sched: ocSched, source: "oncall", deptSched };
    }
  }
  return { sched: deptSched, source: "dept", deptSched };
}

const deptName = computed(() => {
  const d = departments.value.find((x) => x.department_id === deptId.value);
  return d ? d.department_name : "";
});

/* Clamp dates to constraints whenever they change */
watch([startDate, endDate], ([f, t]) => {
  const min = dayjs(minStartStr.value);
  const y = dayjs(yesterdayStr.value);

  let fD = dayjs(String(f || minStartStr.value));
  let tD = dayjs(String(t || yesterdayStr.value));

  if (fD.isBefore(min)) fD = min;
  if (fD.isAfter(y)) fD = y;

  if (tD.isAfter(y)) tD = y;
  if (tD.isBefore(fD)) tD = fD;

  const fNew = fD.format("YYYY-MM-DD");
  const tNew = tD.format("YYYY-MM-DD");

  if (fNew !== (startDate.value || "")) startDate.value = fNew;
  if (tNew !== (endDate.value || "")) endDate.value = tNew;
});

/* ---- only ACTIVE users in the chosen department ---- */
const employeesInDept = computed(() =>
    activeUsers.value.filter((u) => u.user_department === deptId.value)
);

const dateList = computed(() => {
  const from = dayjs(startDate.value || minStartStr.value);
  const to = dayjs(endDate.value || yesterdayStr.value);
  const days = [];
  const start = from.isAfter(to) ? to : from;
  const end = from.isAfter(to) ? from : to;
  let cur = start;
  while (cur.isBefore(end) || cur.isSame(end, "day")) {
    days.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "day");
  }
  return days;
});

const prettyRange = computed(() => {
  if (dateList.value.length === 1) return dayjs(dateList.value[0]).format("MMM D, YYYY");
  const first = dayjs(dateList.value[0]).format("MMM D, YYYY");
  const last = dayjs(dateList.value[dateList.value.length - 1]).format("MMM D, YYYY");
  return `${first} — ${last}`;
});

/* ---------- Helpers (EN/EM dash normalization) ---------- */
function toWorkingSet(noteRaw) {
  const normalize = (txt) =>
      String(txt || "")
          .replace(/[\u2013\u2014]/g, "-")
          .trim();
  const note = normalize(noteRaw) || "Mon-Fri";
  const idx = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const key = (s) => String(s).slice(0, 3).toLowerCase();
  const set = new Set();
  note
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((part) => {
        const m = part.match(/^([A-Za-z]{3,})\s*-\s*([A-Za-z]{3,})$/);
        if (m) {
          const a = idx[key(m[1])];
          const b = idx[key(m[2])];
          if (a == null || b == null) return;
          let i = a;
          while (true) {
            set.add(i);
            if (i === b) break;
            i = (i + 1) % 7;
          }
        } else {
          const k = idx[key(part)];
          if (k != null) set.add(k);
        }
      });
  if (set.size === 0) [1, 2, 3, 4, 5].forEach((d) => set.add(d));
  return set;
}

function pickTime(obj, keys) {
  for (const k of keys) if (obj && obj[k]) return obj[k];
  return null;
}

function parseHM(baseDate, hm) {
  if (!hm) return null;
  const s = String(hm).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const hhmmss = /^\d{1,2}:\d{2}$/.test(s) ? s + ":00" : s;
    return dayjs(`${baseDate}T${hhmmss}`);
  }
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let hh = parseInt(m[1], 10) % 12;
    if (/p/i.test(m[3])) hh += 12;
    const mm = String(parseInt(m[2], 10)).padStart(2, "0");
    return dayjs(`${baseDate}T${String(hh).padStart(2, "0")}:${mm}:00`);
  }
  const dt = dayjs(s);
  return dt.isValid() ? dt : null;
}

/* ---------- Build one row per employee per date WITH jake-oncall ---------- */
function buildRow(u, ymd) {
  const rec = attendance.value.find((a) => a.user_id === u.user_id && a.log_date === ymd);

  const { sched: effSched, source, deptSched } = getEffectiveScheduleForDate(
      u.user_id,
      ymd
  );

  let isWorkingDay = true;
  if (source === "dept") {
    const workingSet = toWorkingSet(
        deptSched?.workdays_note ||
        deptSched?.workdays ||
        deptSched?.work_days ||
        deptSched?.work_days_note
    );
    const dow = dayjs(ymd).day();
    isWorkingDay = workingSet.has(dow);
  }

  if (!isWorkingDay) {
    return {
      key: `r-${u.user_id}-${ymd}`,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      status: "Rest Day",
      punctuality: "—",
      workMinutes: undefined,
      lateMinutes: undefined,
      overtimeMinutes: undefined,
      date: ymd,
      schedule: effSched,
    };
  }

  if (!rec || (!rec.time_in && !rec.time_out)) {
    return {
      key: `r-${u.user_id}-${ymd}`,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      status: "Absent",
      punctuality: "—",
      workMinutes: undefined,
      lateMinutes: undefined,
      overtimeMinutes: undefined,
      date: ymd,
      schedule: effSched,
    };
  }

  const expectedStart = effSched?.work_start || "08:00:00";
  const expectedEnd = effSched?.work_end || "17:00:00";

  const stat = computeStatus({
    time_in: rec.time_in,
    time_out: rec.time_out,
    expectedStart,
    expectedEnd,
  });

  const baseDate = String(ymd);
  const schedStart = parseHM(baseDate, expectedStart);
  const schedEnd = parseHM(baseDate, expectedEnd);
  const outDJ = parseHM(baseDate, rec.time_out);

  let workMins = 0;
  if (schedEnd) {
    if (!outDJ && rec.time_in) {
      workMins = 240;
    } else if (outDJ && outDJ.isBefore(schedEnd)) {
      const ut = Math.max(0, Math.ceil(schedEnd.diff(outDJ, "second") / 60));
      workMins = Math.max(0, 480 - ut);
    } else {
      workMins = 480;
    }
  }

  const inDJ = parseHM(baseDate, rec.time_in);
  const grace = schedStart ? schedStart.add(5, "minute") : null;
  let lateFromIn = 0;
  if (inDJ && grace && inDJ.isAfter(grace)) {
    lateFromIn = Math.max(0, Math.floor(inDJ.diff(grace, "second") / 60));
  }

  const lunchStartDJ = parseHM(
      baseDate,
      pickTime(rec, ["lunch_start", "lunchStart", "lunch_in", "lunchIn"])
  );
  const lunchEndDJ = parseHM(
      baseDate,
      pickTime(rec, ["lunch_end", "lunchEnd", "lunch_out", "lunchOut"])
  );
  let lunchExtra = 0;
  if (lunchStartDJ && lunchEndDJ && lunchEndDJ.isAfter(lunchStartDJ)) {
    const dur = Math.max(0, Math.floor(lunchEndDJ.diff(lunchStartDJ, "second") / 60));
    lunchExtra = Math.max(0, dur - 60);
  }

  const breakStartDJ = parseHM(
      baseDate,
      pickTime(rec, ["break_start", "breakStart", "break_in", "breakIn"])
  );
  const breakEndDJ = parseHM(
      baseDate,
      pickTime(rec, ["break_end", "breakEnd", "break_out", "breakOut"])
  );
  let breakExtra = 0;
  if (breakStartDJ && breakEndDJ && breakEndDJ.isAfter(breakStartDJ)) {
    const dur = Math.max(0, Math.floor(breakEndDJ.diff(breakStartDJ, "second") / 60));
    breakExtra = Math.max(0, dur - 30);
  }

  const customLateMinutes = Math.max(0, lateFromIn + lunchExtra + breakExtra);
  const status = "Present";
  const punctuality = customLateMinutes > 0 ? "Late" : "On Time";

  return {
    key: `r-${u.user_id}-${ymd}`,
    empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
    status,
    punctuality,
    workMinutes: workMins,
    lateMinutes: customLateMinutes,
    overtimeMinutes: stat.overtimeMinutes ?? 0,
    time_in: rec.time_in,
    time_out: rec.time_out,
    date: ymd,
    schedule: effSched,
  };
}

const consistentNames = computed(() => {
  const names = [];
  for (const u of employeesInDept.value) {
    const name = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
    if (!name) continue;
    const allOnTime =
        dateList.value.length > 0 &&
        dateList.value.every((d) => {
          const row = buildRow(u, d);
          return row.status === "Present" && row.punctuality === "On Time";
        });
    if (allOnTime) names.push(name);
  }
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
});

/* DESCENDING dates here */
const groups = computed(() => {
  const needle = (q.value || "").toLowerCase();
  const list = [];
  const orderedDates = [...dateList.value].sort((a, b) =>
      String(b).localeCompare(String(a))
  ); // newest → oldest
  for (const ymd of orderedDates) {
    const rows = employeesInDept.value
        .map((u) => {
          const name = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
          if (needle && !name.toLowerCase().includes(needle)) return null;
          return buildRow(u, ymd);
        })
        .filter(Boolean);
    list.push({ ymd, rows });
  }
  return list;
});

/* ---------- Totals for KPI cards ---------- */
const totalLateMinutes = computed(() =>
    groups.value.reduce(
        (sum, g) =>
            sum +
            g.rows.reduce(
                (s, r) => s + (typeof r.lateMinutes === "number" ? r.lateMinutes : 0),
                0
            ),
        0
    )
);
const totalOvertimeMinutes = computed(() =>
    groups.value.reduce(
        (sum, g) =>
            sum +
            g.rows.reduce(
                (s, r) => s + (typeof r.overtimeMinutes === "number" ? r.overtimeMinutes : 0),
                0
            ),
        0
    )
);
const totalLateHHMM = computed(() => minutesToHHMM(totalLateMinutes.value));
const totalOvertimeHHMM = computed(() => minutesToHHMM(totalOvertimeMinutes.value));

onMounted(async () => {
  const [u, d, s, a, ocList, ocScheds] = await Promise.all([
    fetchUsers(),
    fetchDepartments(),
    fetchSchedules(),
    fetchAttendance(),
    fetchOnCallList(),
    fetchOnCallSchedules(),
  ]);
  users.value = u;
  departments.value = d;
  schedules.value = s;
  attendance.value = a;
  onCallList.value = ocList;
  onCallSchedules.value = ocScheds;

  if (d && d.length) deptId.value = d[0].department_id;

  if (dayjs(startDate.value).isBefore(minStartStr.value))
    startDate.value = minStartStr.value;
  if (dayjs(endDate.value).isAfter(yesterdayStr.value))
    endDate.value = yesterdayStr.value;
  if (dayjs(endDate.value).isBefore(startDate.value)) endDate.value = startDate.value;
});

/* ---------- Status column returns row.status (restricted set) ---------- */
function computeRowStatus(r) {
  const allowed = new Set(["Present", "Absent", "Rest Day"]);
  const s = (r.status || "").trim();
  if (allowed.has(s)) return s;
  const hasAttendance = !!(
      r.time_in ||
      r.timeIn ||
      r.time_out ||
      r.timeOut ||
      r.clock_in ||
      r.clock_out
  );
  return hasAttendance ? "Present" : "Absent";
}

/* ---------- Print important details ---------- */
function printDetails() {
  try {
    const w = window.open("", "_blank");
    const content = printRef.value
        ? printRef.value.innerHTML
        : "<p>No records to print.</p>";
    const title = "Department Reports";
    const dept = deptName.value || "—";
    const range = prettyRange.value;

    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    h1{font-size:18px;margin:0}
    .meta{margin:8px 0 12px;font-size:12px;color:#374151}
    .day-heading{margin:12px 0 6px;font-size:14px;font-weight:700;color:#111827}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
    thead th{background:#f3f4f6}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
    @page { size: A4; margin: 16mm; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Department: <strong>${dept}</strong> &middot; Range: ${range}</div>
  ${content}
  <script>window.onload=function(){window.print(); setTimeout(()=>window.close(), 250);}<\/script>
</body>
</html>`);
    w.document.close();
  } catch (e) {
    console.error("Print failed", e);
    window.print();
  }
}
</script>

<style scoped>
/* Page structure */
.page { display: grid; gap: 12px; }

/* Cards */
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 2px 5px rgba(17, 24, 39, 0.04);
  padding: 14px;
}

/* Header */
.header-card { padding: 16px; }
.header-top {
  display: grid; grid-template-columns: 1fr auto;
  align-items: center; gap: 12px; margin-bottom: 8px;
}
.title { font-size: 18px; font-weight: 800; margin: 0; color: #111827; }
.header-actions {
  display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end;
}
.header-actions .range-wrap,
.header-actions .btn-print { flex: 0 0 auto !important; width: auto !important; max-width: max-content; white-space: nowrap; }

.range-wrap {
  display: inline-flex; align-items: center; gap: 6px;
  background: #f8fafc; border: 1px solid #e5e7eb;
  padding: 6px 10px; border-radius: 999px; color: #374151; font-weight: 600;
}
.range-icon { font-size: 12px; line-height: 1; }
.range-badge { font-size: 12px; letter-spacing: 0.01em; }

/* Button */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 12px;
  border: 1px solid #111827; background: #111827; color: #fff;
  font-weight: 700; font-size: 12px; cursor: pointer;
  box-shadow: 0 2px 4px rgba(17, 24, 39, 0.06);
  transition: transform 0.06s ease, box-shadow 0.12s ease, opacity 0.12s ease;
}
.btn:hover { opacity: 0.96; transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-icon { display: block; }
.btn-print { padding-inline: 14px; }

/* Filters */
.filters {
  display: grid; grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px; margin-top: 6px;
}
.field { grid-column: span 3 / span 3; display: flex; flex-direction: column; gap: 6px; }
.field.grow { grid-column: span 6 / span 6; }
@media (max-width: 900px) {
  .header-top { grid-template-columns: 1fr; }
  .header-actions { justify-content: flex-start; }
  .field, .field.grow { grid-column: span 12 / span 12; }
}
label { font-size: 12px; color: #6b7280; font-weight: 600; }
input, select {
  padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 10px;
  outline: none; font-size: 14px; background: #fff;
}
input:focus, select:focus { border-color: #111827; }

/* KPI Grid */
.kpi-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px; margin-top: 12px;
}
.kpi-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
  padding: 16px; display: flex; flex-direction: column; gap: 6px; align-items: center;
}
.kpi-label { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: #6b7280; text-transform: uppercase; }
.kpi-value { font-size: 28px; font-weight: 800; line-height: 1; }

/* Consistent section */
.consistent { margin-top: 12px; border: 1px dashed #e5e7eb; border-radius: 14px; padding: 12px; background: #fafafa; }
.consistent-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.consistent-title { font-weight: 700; color: #374151; display: inline-flex; align-items: center; gap: 8px; }
.consistent-count { font-size: 12px; color: #6b7280; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; max-height: 116px; overflow: auto; }
.chip-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 999px; border: 1px solid #e5e7eb; background: #fff;
  font-size: 12px; color: #374151; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
}

/* Table */
.day-heading { margin: 12px 0 6px; font-size: 14px; font-weight: 700; color: #111827; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; overflow: hidden; border-radius: 12px; }
.table thead th {
  text-align: left; background: #f8fafc; color: #374151; font-weight: 700;
  border-bottom: 1px solid #e5e7eb; padding: 10px;
}
.table td { border-top: 1px solid #f1f5f9; padding: 10px; vertical-align: middle; }
.table tbody tr:hover { background: #fafafa; }
.col-name { width: 36%; }
.emp-name { font-weight: 600; color: #111827; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; }

/* Chips for statuses */
.chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
.chip-ok { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.chip-warn { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
.chip-danger { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.chip-muted { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }

/* Small helpers */
.muted { color: #6b7280; }
.center { text-align: center; }
.dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
.dot-ok { background: #10b981; }
.row-consistent td { background: rgba(16, 185, 129, 0.08); }
</style>
