<template>
  <section class="row">
    <div class="card">
      <div class="header-row">
        <h3 class="title">Attendance</h3>

        <!-- Big, readable clock -->
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
          <label>Status</label>
          <select v-model="presentFilter">
            <option value="all">All</option>
            <option value="present">Present</option>
            <option value="not_present">Not Present</option>
            <option value="absent">Absent</option>
            <option value="rest_day">Rest Day</option>
          </select>
        </div>

        <div class="field">
          <label>Punctuality</label>
          <select v-model="punctualityFilter">
            <option value="all">All</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
          </select>
        </div>

        <div class="field">
          <label>Department</label>
          <select v-model.number="deptFilter">
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

        <div class="field field--search">
          <label>Search Employee</label>
          <div class="search-line">
            <input
                class="search-input"
                placeholder="Search by name or email"
                v-model="q"
            />
          </div>
        </div>
      </div>

      <!-- KPI Section — jake-UI -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Present</div>
          <div class="kpi-value">{{ kpiCounts.present }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Absent</div>
          <div class="kpi-value">{{ kpiCounts.absent }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Rest Day</div>
          <div class="kpi-value">{{ kpiCounts.restDay }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">On Time</div>
          <div class="kpi-value">{{ kpiCounts.onTime }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Late</div>
          <div class="kpi-value">{{ kpiCounts.late }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
          <tr>
            <th>Employee</th>
            <th>Schedule</th>
            <th>Time In</th>
            <th>Lunch Start</th>
            <th>Lunch End</th>
            <th>Break Start</th>
            <th>Break End</th>
            <th>Time Out</th>
            <th>Punctuality</th>
            <th>Status</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="row in displayRows" :key="row.key">
            <td>
              <div class="emp">
                <div class="name">{{ row.empName }}</div>
                <div class="dept">{{ row.deptName }}</div>
              </div>
            </td>
            <td>{{ row.schedule_fmt || "—" }}</td>
            <td>{{ row.time_in_fmt || "—" }}</td>
            <td>{{ row.lunch_start_fmt || "—" }}</td>
            <td>{{ row.lunch_end_fmt || "—" }}</td>
            <td>{{ row.break_start_fmt || "—" }}</td>
            <td>{{ row.break_end_fmt || "—" }}</td>
            <td>{{ row.time_out_fmt || "—" }}</td>
            <td>{{ row.punctuality || "—" }}</td>
            <td>
                <span class="chip" :class="statusChip(row.status)">
                  {{ row.status }}
                </span>
            </td>
          </tr>
          <tr v-if="displayRows.length === 0">
            <td colspan="10">No employees match the selected filters.</td>
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
  fetchDepartments,
  fetchSchedules,
  fetchAttendance,       // assumed to return many days
  fetchOnCallList,
  fetchOnCallSchedules,
} from "../../services/api";
import { fmtTime, computeStatus } from "../../utils/time";

/** Data stores */
const users = ref([]);
const departments = ref([]);
const schedules = ref([]);
const attendance = ref([]);

/** On-call data */
const onCallList = ref([]);
const onCallSchedules = ref([]);

/** Live clock */
const nowTime = ref(dayjs().format("h:mm:ss A"));
let _nowTimer;
let _refreshTimer;

/** Filters */
const presentFilter = ref("all");
const punctualityFilter = ref("all");
const deptFilter = ref(0);
const q = ref("");

/** NEW: pick date (default = today PH) */
const selectedDate = ref(dayjs().format("YYYY-MM-DD"));

/** Header date string */
const headerDateStr = computed(() => {
  const sameAsToday = selectedDate.value === dayjs().format("YYYY-MM-DD");
  const left = sameAsToday ? "Today" : dayjs(selectedDate.value).format("dddd");
  return `${left} - ${dayjs(selectedDate.value).format("MMM D, YYYY")}`;
});

/** UI helpers */
function statusChip(s) {
  if (s === "Present") return "success";
  if (s === "Not Present") return "warn";
  if (s === "Absent") return "danger";
  if (s === "Rest Day") return "info";
  if (s === "On Call") return "oncall";
  return "";
}

/** Pretty schedule */
function prettyHM(hms) {
  if (!hms) return "";
  try {
    return dayjs(`2000-01-01T${hms}`).format("h:mma");
  } catch {
    return hms;
  }
}
function schedulePretty(sched) {
  if (!sched) return "";
  const start = sched.work_start || sched.start_time || sched.time_in;
  const end = sched.work_end || sched.end_time || sched.time_out;
  if (!start || !end) return "";
  return `${prettyHM(start)} - ${prettyHM(end)}`;
}

/** Indexers */
const userById = computed(() => {
  const map = new Map();
  for (const u of users.value) map.set(u.user_id, u);
  return map;
});
const departmentById = computed(() => {
  const map = new Map();
  for (const d of departments.value) map.set(d.department_id, d);
  return map;
});
const scheduleByDeptId = computed(() => {
  const map = new Map();
  for (const s of schedules.value) map.set(s.department_id, s);
  return map;
});

/** On-call lookups */
const onCallRowsByUserId = computed(() => {
  const m = new Map();
  for (const row of onCallList.value) {
    const uid = row.user_id ?? row.user ?? row.employee_id;
    if (uid == null) continue;
    const key = Number(uid);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(row);
  }
  return m;
});
const onCallScheduleById = computed(() => {
  const m = new Map();
  for (const s of onCallSchedules.value) m.set(s.id, s);
  return m;
});

/** Rest day helpers */
const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ALIASES = {
  sunday: "Sun", sun: "Sun",
  monday: "Mon", mon: "Mon",
  tuesday: "Tue", tue: "Tue", tues: "Tue",
  wednesday: "Wed", wed: "Wed",
  thursday: "Thu", thu: "Thu", thur: "Thu", thurs: "Thu",
  friday: "Fri", fri: "Fri",
  saturday: "Sat", sat: "Sat",
};
function normDayToken(token) {
  if (!token) return "";
  const t = String(token).replace(/\./g, "").trim().toLowerCase();
  if (DAY_ALIASES[t]) return DAY_ALIASES[t];
  const short = t.slice(0, 3);
  return DAY_ALIASES[short] || "";
}
function parseWorkdaysNote(note) {
  if (!note || typeof note !== "string") return null;
  const days = new Set();
  const rangeRe = new RegExp(
      "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\\s*(?:-|–|—|to)\\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)",
      "gi"
  );
  note.replace(rangeRe, (_, a, b) => {
    const A = normDayToken(a), B = normDayToken(b);
    if (!A || !B) return "";
    const ai = DAY_ORDER.indexOf(A);
    const bi = DAY_ORDER.indexOf(B);
    if (ai < 0 || bi < 0) return "";
    let j = ai;
    while (true) {
      days.add(DAY_ORDER[j]);
      if (j === bi) break;
      j = (j + 1) % 7;
    }
    return "";
  });
  const singles = note
      .split(/[,/&]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  for (const tok of singles) {
    if (/(?:-|–|—|\bto\b)/i.test(tok)) continue;
    const d = normDayToken(tok);
    if (DAY_ORDER.includes(d)) days.add(d);
  }
  return days.size ? days : null;
}
function isRestDayForDate(schedule, isoYmd) {
  if (!schedule) return false;
  const note = schedule.workdays_note ?? schedule.workdaysNote ?? "";
  const allowed = parseWorkdaysNote(note);
  if (!allowed) return false;
  const dow = DAY_ORDER[dayjs(isoYmd).day()];
  return !allowed.has(dow);
}

/** Active date */
const activeYMD = computed(() => selectedDate.value);

/** Filter attendance for active date */
const rowsForActiveDate = computed(() =>
    attendance.value.filter((a) => a.log_date === activeYMD.value)
);

/** Effective schedule (on-call window inclusive) */
function getEffectiveScheduleForDate(userId, ymd) {
  const rows = onCallRowsByUserId.value.get(Number(userId)) || [];
  if (!rows.length) return { sched: null, source: "none" };

  const today = dayjs(ymd, "YYYY-MM-DD");
  for (const oc of rows) {
    const schedId = oc.dept_sched_id ?? oc.dept_schedule_id ?? oc.schedule_id;
    if (schedId == null) continue;
    const ocSched = onCallScheduleById.value.get(Number(schedId));
    if (!ocSched) continue;

    const startStr = String(
        ocSched.schedule_date ?? ocSched.date ?? ocSched.scheduleDate ?? ""
    );
    if (!startStr) continue;

    const start = dayjs(startStr, "YYYY-MM-DD");
    if (!start.isValid()) continue;

    const spanDays = Number(ocSched.working_days ?? ocSched.workingDays ?? 1);
    const end = start.add(Math.max(1, spanDays) - 1, "day");

    if (
        (today.isAfter(start, "day") || today.isSame(start, "day")) &&
        (today.isBefore(end, "day") || today.isSame(end, "day"))
    ) {
      return { sched: ocSched, source: "oncall" };
    }
  }

  return { sched: null, source: "none" };
}

/** Build rows (present) */
const presentActive = computed(() => {
  return rowsForActiveDate.value.map((r) => {
    const user = userById.value.get(r.user_id) || {};
    const deptId = user.user_department || r.department_id || 0;
    const dept = departmentById.value.get(deptId) || {};

    const { sched: ocSched, source } = getEffectiveScheduleForDate(
        r.user_id,
        activeYMD.value
    );
    const deptSched = scheduleByDeptId.value.get(deptId) || {};
    const effectiveSched = source === "oncall" ? ocSched : deptSched;

    if (source !== "oncall" && isRestDayForDate(deptSched, activeYMD.value)) {
      return {
        key: String(r.log_id),
        user_id: r.user_id,
        empName: `${user.user_fname || ""} ${user.user_lname || ""}`.trim(),
        deptName: dept.department_name || "",
        schedule_fmt: schedulePretty(deptSched),
        time_in_fmt: "",
        lunch_start_fmt: "",
        lunch_end_fmt: "",
        break_start_fmt: "",
        break_end_fmt: "",
        time_out_fmt: "",
        punctuality: "—",
        status: "Rest Day",
      };
    }

    const expectedStart =
        effectiveSched.work_start || effectiveSched.start_time || "09:00:00";
    const expectedEnd =
        effectiveSched.work_end || effectiveSched.end_time || "18:00:00";

    const stat = computeStatus({
      time_in: r.time_in,
      time_out: r.time_out,
      expectedStart,
      expectedEnd,
    });

    const baseStatus = r.time_in ? "Present" : "Absent";
    const finalStatus = source === "oncall" ? "On Call" : baseStatus;

    return {
      key: `p-${r.user_id}`,
      user_id: r.user_id,
      empName: `${user.user_fname || ""} ${user.user_lname || ""}`.trim(),
      deptName: dept.department_name || "",
      schedule_fmt: schedulePretty(effectiveSched),
      time_in_fmt: fmtTime(r.time_in),
      lunch_start_fmt: fmtTime(r.lunch_start),
      lunch_end_fmt: fmtTime(r.lunch_end),
      break_start_fmt: fmtTime(r.break_start),
      break_end_fmt: fmtTime(r.break_end),
      time_out_fmt: fmtTime(r.time_out),
      punctuality: r.time_in ? (stat.lateMinutes > 0 ? "Late" : "On Time") : "—",
      status: finalStatus,
    };
  });
});

/** Build rows (not present) */
const notPresentActive = computed(() => {
  const presentSet = new Set(rowsForActiveDate.value.map((r) => r.user_id));

  return users.value
      .filter((u) => !presentSet.has(u.user_id))
      .map((u) => {
        const dept = departmentById.value.get(u.user_department) || {};
        const { sched: ocSched, source } = getEffectiveScheduleForDate(
            u.user_id,
            activeYMD.value
        );
        const deptSched = scheduleByDeptId.value.get(u.user_department) || {};
        const effectiveSched = source === "oncall" ? ocSched : deptSched;

        if (source !== "oncall" && isRestDayForDate(deptSched, activeYMD.value)) {
          return {
            key: `np-${u.user_id}`,
            user_id: u.user_id,
            empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
            deptName: dept.department_name || "",
            schedule_fmt: schedulePretty(deptSched),
            time_in_fmt: "",
            lunch_start_fmt: "",
            lunch_end_fmt: "",
            break_start_fmt: "",
            break_end_fmt: "",
            time_out_fmt: "",
            punctuality: "—",
            status: "Rest Day",
          };
        }

        const lunchEnd =
            effectiveSched.lunch_end ||
            effectiveSched.lunchEnd ||
            effectiveSched.lunch_end_time;

        if (lunchEnd) {
          const cutoff = dayjs(`${activeYMD.value}T${lunchEnd}`);
          const now = dayjs();
          const baseStatus = now.isAfter(cutoff) ? "Absent" : "Not Present";
          const finalStatus = source === "oncall" ? "On Call" : baseStatus;

          return {
            key: `np-${u.user_id}`,
            user_id: u.user_id,
            empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
            deptName: dept.department_name || "",
            schedule_fmt: schedulePretty(effectiveSched),
            time_in_fmt: "",
            lunch_start_fmt: "",
            lunch_end_fmt: "",
            break_start_fmt: "",
            break_end_fmt: "",
            time_out_fmt: "",
            punctuality: "—",
            status: finalStatus,
          };
        }

        const finalStatus = source === "oncall" ? "On Call" : "Not Present";
        return {
          key: `np-${u.user_id}`,
          user_id: u.user_id,
          empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
          deptName: dept.department_name || "",
          schedule_fmt: schedulePretty(effectiveSched),
          time_in_fmt: "",
          lunch_start_fmt: "",
          lunch_end_fmt: "",
          break_start_fmt: "",
          break_end_fmt: "",
          time_out_fmt: "",
          punctuality: "—",
          status: finalStatus,
        };
      });
});

/** KPI */
const kpiSourceRows = computed(() => [
  ...presentActive.value,
  ...notPresentActive.value,
]);
const kpiFilteredRows = computed(() => {
  if (!deptFilter.value) return kpiSourceRows.value;
  return kpiSourceRows.value.filter(
      (r) => userById.value.get(r.user_id)?.user_department === deptFilter.value
  );
});
const kpiCounts = computed(() => {
  const rows = kpiFilteredRows.value;
  return {
    present: rows.filter((r) => r.status === "Present").length,
    absent: rows.filter((r) => r.status === "Absent").length,
    restDay: rows.filter((r) => r.status === "Rest Day").length,
    onTime: rows.filter((r) => r.status === "Present" && r.punctuality === "On Time")
        .length,
    late: rows.filter((r) => r.status === "Present" && r.punctuality === "Late").length,
  };
});

/** Display rows with filters */
const displayRows = computed(() => {
  let rows;
  if (presentFilter.value === "present") {
    rows = presentActive.value.filter((r) => r.status === "Present");
  } else if (presentFilter.value === "absent") {
    rows = [
      ...presentActive.value.filter((r) => r.status === "Absent"),
      ...notPresentActive.value.filter((r) => r.status === "Absent"),
    ];
  } else if (presentFilter.value === "not_present") {
    rows = notPresentActive.value.filter((r) => r.status === "Not Present");
  } else if (presentFilter.value === "rest_day") {
    rows = [
      ...presentActive.value.filter((r) => r.status === "Rest Day"),
      ...notPresentActive.value.filter((r) => r.status === "Rest Day"),
    ];
  } else {
    rows = [...presentActive.value, ...notPresentActive.value];
  }

  if (punctualityFilter.value === "on_time") {
    rows = rows.filter((r) => r.punctuality === "On Time");
  } else if (punctualityFilter.value === "late") {
    rows = rows.filter((r) => r.punctuality === "Late");
  }

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

/** Data load & timers */
async function loadAll() {
  const [u, d, s, a, ocList, ocScheds] = await Promise.all([
    fetchUsers(),
    fetchDepartments(),
    fetchSchedules(),
    fetchAttendance(),      // load once; we filter by date locally
    fetchOnCallList(),
    fetchOnCallSchedules(),
  ]);
  users.value = u;
  departments.value = d;
  schedules.value = s;
  attendance.value = a;
  onCallList.value = ocList;
  onCallSchedules.value = ocScheds;
}

async function refreshAttendance() {
  try {
    attendance.value = await fetchAttendance();
  } catch {}
}

onMounted(async () => {
  await loadAll();
  _nowTimer = setInterval(() => {
    nowTime.value = dayjs().format("h:mm:ss A");
  }, 1000);
  _refreshTimer = setInterval(refreshAttendance, 60000);
});

onUnmounted(() => {
  if (_nowTimer) clearInterval(_nowTimer);
  if (_refreshTimer) clearInterval(_refreshTimer);
});

/** Optional: if you later switch to server-side by date, refresh when date changes */
// watch(selectedDate, async () => { attendance.value = await fetchAttendanceByDate(selectedDate.value) })
</script>

<style scoped>
/* --- Header (title + big clock) --- */
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.title {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}

/* Big, readable clock to the right */
.now-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.now-badge .time {
  font-weight: 900;
  font-size: 28px;
  line-height: 1.1;
}
.now-badge .date {
  font-size: 14px;
  color: #4b5563;
  margin-top: 2px;
}
@media (min-width: 1280px) {
  .now-badge .time { font-size: 32px; }
  .now-badge .date { font-size: 16px; }
}

/* Toolbar grid */
.toolbar {
  display: grid;
  gap: 14px;
  margin-bottom: 10px;
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
input[type="date"] {
  width: 100%;
  height: 42px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  outline: none;
  font-size: 14px;
}
.search-line { display: flex; align-items: center; gap: 10px; }
@media (min-width: 1200px) {
  .toolbar { grid-template-columns: 180px 180px 200px 220px 1fr; }
}
@media (min-width: 768px) and (max-width: 1199.98px) {
  .toolbar { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 767.98px) {
  .toolbar { grid-template-columns: 1fr; }
  .now-badge { align-items: stretch; }
}

/* KPI (jake-UI) */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 5px rgba(17, 24, 39, 0.04);
}
.kpi-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #6b7280;
  text-transform: uppercase;
}
.kpi-value { font-size: 28px; font-weight: 800; line-height: 1; }
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 720px)  { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px)  { .kpi-grid { grid-template-columns: 1fr; } }

/* Table */
.table-wrap { margin-top: 10px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
thead th {
  text-align: left;
  font-size: 12px;
  color: #667085;
  font-weight: 600;
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
tbody td {
  padding: 12px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 14px;
}
tbody tr:hover { background: #fafcff; }

/* Status chips */
.chip {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.chip.success { background: #ecfdf3; color: #027a48; }
.chip.warn    { background: #fff6ed; color: #b54708; }
.chip.danger  { background: #fef3f2; color: #b42318; }
.chip.info    { background: #f3f4f6; color: #374151; }   /* Rest Day */
.chip.oncall  { background: #e0f2fe; color: #075985; }

/* Employee cell */
.emp .name { font-weight: 600; line-height: 1.2; }
.emp .dept { font-size: 12px; color: #667085; line-height: 1.2; }
</style>
