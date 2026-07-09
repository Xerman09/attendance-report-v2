<template>
  <section class="page">
    <!-- Header / User + Range + Print -->
    <div class="card header-card">
      <div class="header-grid">
        <!-- Left: Back -->
        <div class="left">
          <button class="btn btn-ghost no-print" @click="$router.push({ name: 'employee-reports' })">
            ← Back
          </button>
        </div>

        <!-- Center: Title -->
        <div class="center">
          <h3 class="title">Attendance History</h3>
        </div>

        <!-- Right: Range + Print -->
        <div class="right">
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

      <!-- User card -->
      <div class="user-card">
        <div class="avatar">
          <img v-if="empImage" :src="empImage" alt="User" />
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>

        <div class="info-grid">
          <div>
            <div class="emp-name">{{ empName }}</div>
            <div v-if="empPosition" class="muted small">{{ empPosition }}</div>
          </div>
          <div class="right-align">
            <div v-if="empDeptName" class="emp-dept">{{ empDeptName }}</div>
            <div v-if="empDeptSchedulePretty" class="muted small">
              Schedule: {{ empDeptSchedulePretty }}
            </div>
            <div v-if="empDeptWorkdaysPretty" class="muted small">
              Workdays: {{ empDeptWorkdaysPretty }}
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters no-print">
        <div class="field">
          <label>From</label>
          <input type="date" v-model="fromDate" :min="minStartStr" :max="yesterdayStr" />
        </div>
        <div class="field">
          <label>To</label>
          <input type="date" v-model="toDate" :min="fromDate" :max="yesterdayStr" />
        </div>
        <div class="field">
          <label>Quick Filter</label>
          <select v-model="quickSelect" @change="applyQuickDropdown">
            <option value="">— Select —</option>
            <option value="0">Yesterday</option>
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select v-model="statusFilter">
            <option value="All">All</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>
        </div>

        <!-- Show Rest Day toggle -->
        <div class="field restday-field">
          <label>&nbsp;</label>
          <label class="toggle-line">
            <input type="checkbox" v-model="showRestDay" />
            <span>Show Rest Day</span>
          </label>
        </div>

        <div class="grow"></div>
      </div>

      <!-- KPI cards (screen only) -->
      <div class="kpi-grid no-print">
        <div class="kpi-card">
          <div class="kpi-label">Days Attended</div>
          <div class="kpi-value">{{ totalDaysAttended }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Days Absent</div>
          <div class="kpi-value">{{ totalDaysAbsent }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Work Hours</div>
          <div class="kpi-value">{{ totalWorkHoursHHMM }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Overtime (hrs)</div>
          <div class="kpi-value">{{ totalOvertimeHHMM }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Late (hrs)</div>
          <div class="kpi-value">{{ totalLateHHMM }}</div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time In</th>
              <th>Lunch Start</th>
              <th>Lunch End</th>
              <th>Break Start</th>
              <th>Break End</th>
              <th>Time Out</th>
              <th>Work Hours</th>
              <th>Overtime</th>
              <th>Late</th>
              <th>Undertime</th>
              <th>Status</th>
              <th class="no-print">Geotag</th>
            </tr>
          </thead>

          <tbody>
            <template v-for="r in displayedRows" :key="r.log_id">
              <tr>
                <td>{{ r.date_fmt }}</td>
                <td>{{ r.time_in_fmt || "-" }}</td>
                <td>{{ r.lunch_start_fmt || "-" }}</td>
                <td>{{ r.lunch_end_fmt || "-" }}</td>
                <td>{{ r.break_start_fmt || "-" }}</td>
                <td>{{ r.break_end_fmt || "-" }}</td>
                <td>{{ r.time_out_fmt || "-" }}</td>
                <td>{{ r.workMinutes != null ? minutesToHHMM(r.workMinutes) : "-" }}</td>
                <td>{{ r.overtime_fmt || "-" }}</td>
                <td>{{ r.lateMinutes != null ? minutesToHHMM(r.lateMinutes) : "-" }}</td>
                <td>{{ r.undertimeMinutes != null ? minutesToHHMM(r.undertimeMinutes) : "-" }}</td>
                <td>
                  <span class="chip" :class="statusChip(r.status)">{{ r.status }}</span>
                </td>

                <!-- ✅ Miggle badge + dropdown trigger -->
                <td class="no-print">
                  <div class="geo-actions">
                    <span v-if="hasGeotag(r.log_id)" class="badge-miggle">Miggle</span>
                    <span v-else class="muted small">—</span>

                    <button
                      v-if="hasGeotag(r.log_id)"
                      class="btn btn-ghost btn-mini"
                      type="button"
                      @click="toggleGeo(r.log_id)"
                    >
                      {{ geoOpen[String(r.log_id)] ? "Hide" : "View" }}
                    </button>
                  </div>
                </td>
              </tr>

              <!-- ✅ Dropdown preview row -->
              <tr v-if="geoOpen[String(r.log_id)]" class="no-print">
                <td colspan="13" class="geo-cell">
                  <div class="geotag-panel">
                    <div class="geotag-panel-header">
                      <div class="panel-title">Geotag Evidence</div>
                      <div class="panel-sub muted small">
                        Log #{{ r.log_id }} · {{ r.date_fmt }}
                      </div>
                    </div>

                    <!-- Time in / Time out preview -->
                    <div class="geo-compare">
                      <!-- TIME IN -->
                      <div class="geo-col">
                        <div class="geo-col-title">Time In</div>

                        <div v-if="geotagPick(r.log_id, 'TIME_IN')" class="geo-stack">
                          <div class="map-wrap">
                            <iframe
                              class="map-iframe"
                              :src="mapEmbedUrl(geotagPick(r.log_id, 'TIME_IN'))"
                              loading="lazy"
                              referrerpolicy="no-referrer-when-downgrade"
                            ></iframe>
                          </div>

                          <div class="img-wrap" v-if="geotagImageUrl(geotagPick(r.log_id, 'TIME_IN'))">
                            <img
                              :src="geotagImageUrl(geotagPick(r.log_id, 'TIME_IN'))"
                              alt="Time In photo"
                              class="click-zoom"
                              @click="openZoom(geotagImageUrl(geotagPick(r.log_id, 'TIME_IN')), 'Time In')"
                            />
                          </div>
                          <div v-else class="muted small">No image.</div>

                          <div class="geo-meta muted small">
                            <span>📍 {{ coordsText(geotagPick(r.log_id, 'TIME_IN')) || "No coordinates" }}</span>
                            <span> · </span>
                            <span>{{ prettyCapturedAt(geotagPick(r.log_id, 'TIME_IN')?.captured_at) }}</span>
                          </div>
                        </div>

                        <div v-else class="geo-empty muted small">No Time In geotag.</div>
                      </div>

                      <!-- TIME OUT -->
                      <div class="geo-col">
                        <div class="geo-col-title">Time Out</div>

                        <div v-if="geotagPick(r.log_id, 'TIME_OUT')" class="geo-stack">
                          <div class="map-wrap">
                            <iframe
                              class="map-iframe"
                              :src="mapEmbedUrl(geotagPick(r.log_id, 'TIME_OUT'))"
                              loading="lazy"
                              referrerpolicy="no-referrer-when-downgrade"
                            ></iframe>
                          </div>

                          <div class="img-wrap" v-if="geotagImageUrl(geotagPick(r.log_id, 'TIME_OUT'))">
                            <img
                              :src="geotagImageUrl(geotagPick(r.log_id, 'TIME_OUT'))"
                              alt="Time Out photo"
                              class="click-zoom"
                              @click="openZoom(geotagImageUrl(geotagPick(r.log_id, 'TIME_OUT')), 'Time Out')"
                            />
                          </div>
                          <div v-else class="muted small">No image.</div>

                          <div class="geo-meta muted small">
                            <span>📍 {{ coordsText(geotagPick(r.log_id, 'TIME_OUT')) || "No coordinates" }}</span>
                            <span> · </span>
                            <span>{{ prettyCapturedAt(geotagPick(r.log_id, 'TIME_OUT')?.captured_at) }}</span>
                          </div>
                        </div>

                        <div v-else class="geo-empty muted small">No Time Out geotag.</div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>

            <tr v-if="displayedRows.length === 0">
              <td colspan="13" class="muted center">No records in range.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ✅ Image Zoom Modal -->
    <div v-if="zoom.open" class="zoom-overlay no-print" @click.self="closeZoom">
      <div class="zoom-toolbar">
        <div class="zoom-title">{{ zoom.title || "Preview" }}</div>
        <div class="zoom-actions">
          <button class="btn btn-ghost btn-mini" type="button" @click="zoomOut">−</button>
          <button class="btn btn-ghost btn-mini" type="button" @click="resetZoom">Reset</button>
          <button class="btn btn-ghost btn-mini" type="button" @click="zoomIn">+</button>
          <button class="btn btn-ghost btn-mini" type="button" @click="closeZoom">✕</button>
        </div>
      </div>

      <div
        class="zoom-stage"
        @wheel.prevent="onWheelZoom"
        @mousedown="onDragStart"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
        @touchstart.passive="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
      >
        <img
          class="zoom-img"
          :src="zoom.src"
          alt="Zoom"
          :style="zoomImgStyle"
          draggable="false"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import dayjs from "dayjs";

import {
  fetchUsers,
  fetchSchedules,
  fetchAttendance,
  fetchDepartments,
  fetchOnCallList,
  fetchOnCallSchedules,
  fetchGeotags,
  getDirectImageUrl,
} from "../../services/api";

import {
  fmtTime,
  minutesToHHMM,
  minutesPrettyWithTotal,
  computeStatus,
  displayTimeOutWhenMissing,
} from "../../utils/time";

/* ---------- Filters & helpers ---------- */
const statusFilter = ref("All");
const showRestDay = ref(true);

function normalizeStatus(s) {
  if (!s) return "Absent";
  const t = String(s).toLowerCase();
  if (t.includes("rest")) return "Rest Day";
  if (t.includes("absent") || t.includes("no show")) return "Absent";
  return "Present";
}

const displayedRows = computed(() => {
  const base = Array.isArray(rows?.value) ? rows.value : rows;
  let mapped = (base || []).map((r) => ({ ...r, status: normalizeStatus(r.status) }));
  if (!showRestDay.value) mapped = mapped.filter((r) => r.status !== "Rest Day");
  if (statusFilter.value !== "All") mapped = mapped.filter((r) => r.status === statusFilter.value);
  return mapped;
});

function pickTime(obj, keys) {
  for (const k of keys) if (obj && obj[k]) return obj[k];
  return null;
}
function prettyAnyTime(v, logDate) {
  if (!v) return "";
  const str = String(v);
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const hhmmss = str.length === 5 ? str + ":00" : str;
    return dayjs(`${logDate}T${hhmmss}`).format("h:mma");
  }
  return fmtTime(v);
}

/* ---------- Range pretty text ---------- */
const prettyRange = computed(() => {
  if (!fromDate.value || !toDate.value) return "—";
  const f = dayjs(String(fromDate.value)).format("MMM D, YYYY");
  const t = dayjs(String(toDate.value)).format("MMM D, YYYY");
  return f === t ? f : `${f} — ${t}`;
});

/* ---------- Route & state ---------- */
const route = useRoute();
const userId = Number(route.params.id);

const users = ref([]);
const schedules = ref([]);
const attendance = ref([]);
const departments = ref([]);
const onCallList = ref([]);
const onCallSchedules = ref([]);

const geotags = ref([]);
const geoOpen = ref({}); // { [logId: string]: boolean }

const fromDate = ref("");
const toDate = ref("");

const emp = computed(() => users.value.find((u) => u.user_id === userId));
const empName = computed(() => (emp.value ? `${emp.value.user_fname} ${emp.value.user_lname}` : `User #${userId}`));

/* Present badge styling */
function statusChip(s) {
  const v = String(s || "").toLowerCase();
  if (v === "present" || v === "on time" || v === "overtime") return "chip-ok";
  if (v.includes("rest")) return "chip-muted";
  if (v === "absent") return "chip-danger";
  if (v.includes("late") || v.includes("missing")) return "chip-warn";
  return "";
}

const schedByDept = computed(() => {
  const m = new Map();
  for (const s of schedules.value) m.set(s.department_id, s);
  return m;
});

/* ---------- On-call lookups ---------- */
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
  for (const s of onCallSchedules.value) m.set(Number(s.id), s);
  return m;
});

function getEffectiveScheduleForDate(userId, ymdISO, deptSched) {
  const ocRows = onCallRowsByUserId.value.get(Number(userId)) || [];
  const target = dayjs(String(ymdISO), "YYYY-MM-DD");

  for (const oc of ocRows) {
    const schedId = oc.dept_sched_id ?? oc.dept_schedule_id ?? oc.schedule_id ?? oc.deptSchedId;
    if (schedId == null) continue;
    const ocSched = onCallScheduleById.value.get(Number(schedId));
    if (!ocSched) continue;

    const startStr = ocSched.schedule_date ?? ocSched.date ?? ocSched.scheduleDate ?? ocSched.start_date;
    if (!startStr) continue;

    const start = dayjs(String(startStr), "YYYY-MM-DD");
    if (!start.isValid()) continue;

    const span = Math.max(1, Number(ocSched.working_days ?? ocSched.workingDays ?? ocSched.days ?? ocSched.duration) || 1);
    const end = start.add(span - 1, "day"); // inclusive

    if (
      target.isSame(start, "day") ||
      target.isSame(end, "day") ||
      (target.isAfter(start, "day") && target.isBefore(end, "day"))
    ) {
      return { sched: ocSched, source: "oncall" };
    }
  }

  return { sched: deptSched || {}, source: "dept" };
}

const hire = computed(() => {
  const d = emp.value?.user_dateOfHire ? dayjs(emp.value.user_dateOfHire) : null;
  return d && d.isValid() ? d : null;
});

/* ---------- Workdays parser ---------- */
function parseWorkingDays(note) {
  if (!note || typeof note !== "string") return new Set([1, 2, 3, 4, 5]); // Mon–Fri default
  const text = note.trim().toLowerCase();

  const tokToIdx = (tok) => {
    const t = tok.slice(0, 3);
    if (t === "sun") return 0;
    if (t === "mon") return 1;
    if (t === "tue") return 2;
    if (t === "wed") return 3;
    if (t === "thu") return 4;
    if (t === "fri") return 5;
    if (t === "sat") return 6;
    return null;
  };

  const working = new Set();
  const rangeRe = /([a-z]{3,})\s*[–—-]\s*([a-z]{3,})/gi;
  let m;
  while ((m = rangeRe.exec(text))) {
    const a = tokToIdx(m[1]);
    const b = tokToIdx(m[2]);
    if (a == null || b == null) continue;
    let i = a;
    while (true) {
      working.add(i);
      if (i === b) break;
      i = (i + 1) % 7;
    }
  }

  const singles = text
    .split(/[,/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const s of singles) {
    if (/[–—-]/.test(s)) continue;
    const idx = tokToIdx(s);
    if (idx != null) working.add(idx);
  }

  if (working.size === 0) [1, 2, 3, 4, 5].forEach((d) => working.add(d));
  return working;
}

/* ---------- Rows builder ---------- */
const rows = computed(() => {
  if (!fromDate.value || !toDate.value) return [];
  const start = dayjs(String(fromDate.value)).startOf("day");
  const end = dayjs(String(toDate.value)).startOf("day");
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return [];

  const logs = attendance.value.filter((l) => {
    if (l.user_id !== userId) return false;
    const d = dayjs(String(l.log_date));
    return (
      (d.isAfter(start, "day") || d.isSame(start, "day")) &&
      (d.isBefore(end, "day") || d.isSame(end, "day"))
    );
  });

  const byDate = new Map();
  for (const l of logs) byDate.set(String(l.log_date), l);

  const deptId = emp.value ? emp.value.user_department : null;
  const deptSchedule = deptId ? schedByDept.value.get(deptId) : null;
  const workingSet = parseWorkingDays(deptSchedule?.workdays_note);

  let d = start.clone();
  const synth = [];
  const hasHire = !!hire.value;

  while (d.isBefore(end) || d.isSame(end, "day")) {
    const ds = d.format("YYYY-MM-DD");
    const { source } = getEffectiveScheduleForDate(userId, ds, deptSchedule);

    if (!byDate.has(ds)) {
      if (hasHire && d.isBefore(hire.value, "day")) {
        synth.push({
          log_id: "prehire-" + ds,
          user_id: userId,
          log_date: ds,
          department_id: deptId,
          status: "Prehire",
          time_in: null,
          time_out: null,
          lateMinutes: 0,
          overtimeMinutes: 0,
        });
      } else {
        const weekday = d.day();
        const status =
          source === "oncall" ? "Absent" : workingSet.has(weekday) ? "Absent" : "Rest Day";

        synth.push({
          log_id: (status === "Absent" ? "abs-" : "rest-") + ds,
          user_id: userId,
          log_date: ds,
          department_id: deptId,
          status,
          time_in: null,
          time_out: null,
          lateMinutes: 0,
          overtimeMinutes: 0,
        });
      }
    }
    d = d.add(1, "day");
  }

  const merged = logs.concat(synth).map((l) => {
    const dayISO = String(l.log_date);
    const deptSchedForRow = schedByDept.value.get(l.department_id || deptId) || deptSchedule || {};
    const { sched: effSched, source } = getEffectiveScheduleForDate(userId, dayISO, deptSchedForRow);

    const expectedStart = effSched?.work_start || effSched?.start_time || "08:00:00";
    const expectedEnd = effSched?.work_end || effSched?.end_time || "17:00:00";

    const weekdayIdx = dayjs(dayISO).day();
    const isRest = source !== "oncall" ? !workingSet.has(weekdayIdx) : false;

    const baseStat =
      isRest || l.status === "Rest Day" || l.status === "Prehire"
        ? { totalMinutes: 0, lateMinutes: 0, overtimeMinutes: 0, status: "Rest Day" }
        : computeStatus({ time_in: l.time_in, time_out: l.time_out, expectedStart, expectedEnd });

    const outPretty = l.time_out
      ? fmtTime(l.time_out)
      : isRest
      ? ""
      : displayTimeOutWhenMissing({ log_date: l.log_date, expectedStart });

    const lunchStartRaw = pickTime(l, ["lunch_start", "lunchStart", "lunch_in", "lunchIn"]);
    const lunchEndRaw = pickTime(l, ["lunch_end", "lunchEnd", "lunch_out", "lunchOut"]);
    const breakStartRaw = pickTime(l, ["break_start", "breakStart", "break_in", "breakIn"]);
    const breakEndRaw = pickTime(l, ["break_end", "breakEnd", "break_out", "breakOut"]);

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

    const schedStart = parseHM(dayISO, expectedStart);
    const schedEnd = parseHM(dayISO, expectedEnd);

    // Late rules
    let customLateMinutes = 0;
    if (!isRest) {
      const graceTime = schedStart ? schedStart.add(5, "minute") : null;
      const actualIn =
        parseHM(dayISO, l.time_in ? fmtTime(l.time_in) : null) || parseHM(dayISO, l.time_in);
      if (graceTime && actualIn && actualIn.isAfter(graceTime)) customLateMinutes += actualIn.diff(graceTime, "minute");

      const actualLunchStart = parseHM(dayISO, lunchStartRaw);
      const actualLunchEnd = parseHM(dayISO, lunchEndRaw);
      if (actualLunchStart && actualLunchEnd) {
        const lunchDur = Math.max(0, actualLunchEnd.diff(actualLunchStart, "minute"));
        if (lunchDur > 60) customLateMinutes += lunchDur - 60;
      }

      const actualBreakStart = parseHM(dayISO, breakStartRaw);
      const actualBreakEnd = parseHM(dayISO, breakEndRaw);
      if (actualBreakStart && actualBreakEnd) {
        const breakDur = Math.max(0, actualBreakEnd.diff(actualBreakStart, "minute"));
        if (breakDur > 30) customLateMinutes += breakDur - 30;
      }
    }

    const finalStatus = isRest ? "Rest Day" : baseStat.status;
    const isOff = finalStatus === "Rest Day" || finalStatus === "Absent" || finalStatus === "Prehire";

    const tOutParsed = isRest
      ? null
      : parseHM(dayISO, l.time_out ? fmtTime(l.time_out) : null) || parseHM(dayISO, l.time_out);

    let undertimeMinutesFinal = null;
    if (!isOff) {
      if (schedEnd && tOutParsed && tOutParsed.isBefore(schedEnd)) undertimeMinutesFinal = schedEnd.diff(tOutParsed, "minute");
      else undertimeMinutesFinal = 0;
    }

    let workMinutesFinal = null;
    if (!isOff) {
      if (tOutParsed && schedStart && schedEnd) {
        if (tOutParsed.isBefore(schedEnd)) {
          workMinutesFinal = Math.max(0, Math.min(tOutParsed.diff(schedStart, "minute") - 60, 480));
        } else {
          workMinutesFinal = 480;
        }
      } else {
        const normalizedStatusForRow = normalizeStatus(finalStatus);
        const noTimeOut = !l.time_out;
        workMinutesFinal = baseStat.totalMinutes;
        if (normalizedStatusForRow === "Present" && noTimeOut) workMinutesFinal = 240;
      }
    }

    return {
      ...l,
      date_fmt: dayjs(String(l.log_date)).format("MMM D, YYYY"),
      time_in_fmt: isOff && !l.time_in ? "" : fmtTime(l.time_in),
      lunch_start_fmt: isOff && !lunchStartRaw ? "" : lunchStartRaw ? prettyAnyTime(lunchStartRaw, l.log_date) : "",
      lunch_end_fmt: isOff && !lunchEndRaw ? "" : lunchEndRaw ? prettyAnyTime(lunchEndRaw, l.log_date) : "",
      break_start_fmt: isOff && !breakStartRaw ? "" : breakStartRaw ? prettyAnyTime(breakStartRaw, l.log_date) : "",
      break_end_fmt: isOff && !breakEndRaw ? "" : breakEndRaw ? prettyAnyTime(breakEndRaw, l.log_date) : "",
      time_out_fmt: isOff && !l.time_out && !outPretty ? "" : outPretty,
      workMinutes: workMinutesFinal,
      lateMinutes: isOff ? null : customLateMinutes,
      undertimeMinutes: isOff ? null : undertimeMinutesFinal,
      overtimeMinutes: isOff ? null : baseStat.overtimeMinutes,
      overtime_fmt: isOff ? "" : (baseStat.overtimeMinutes || 0) >= 90 ? minutesToHHMM(baseStat.overtimeMinutes) : "0",
      status: finalStatus,
    };
  });

  merged.sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
  return merged;
});

/* ---------- KPIs ---------- */
const totalDaysAttended = computed(
  () => rows.value.filter((r) => r.status !== "Absent" && r.status !== "Rest Day" && r.status !== "Prehire").length
);
const totalDaysAbsent = computed(() => rows.value.filter((r) => r.status === "Absent").length);

const lateTotal = computed(() => rows.value.reduce((acc, r) => acc + (r.lateMinutes || 0), 0));
const otTotal = computed(() => rows.value.reduce((acc, r) => acc + (r.overtimeMinutes || 0), 0));

const totalWorkHoursHHMM = computed(() => minutesToHHMM(rows.value.reduce((sum, r) => sum + (r.workMinutes || 0), 0)));
const totalOvertimeHHMM = computed(() => minutesToHHMM(otTotal.value));
const totalLateHHMM = computed(() => minutesToHHMM(lateTotal.value));

/* ---------- Header meta ---------- */
const empPosition = computed(() => emp.value?.user_position || "");

const deptMap = computed(() => {
  const m = new Map();
  for (const d of departments.value) m.set(d.department_id, d.department_name);
  return m;
});
const empDeptName = computed(() => (emp.value ? deptMap.value.get(emp.value.user_department) || "" : ""));

const empDeptSchedule = computed(() => {
  const deptId = emp.value?.user_department;
  if (!deptId) return null;
  return schedules.value.find((s) => s.department_id === deptId) || null;
});

function prettyHHMM(hms) {
  if (!hms) return "";
  try {
    return dayjs(`2000-01-01T${hms}`).format("h:mma");
  } catch {
    return hms;
  }
}
const empDeptSchedulePretty = computed(() => {
  const s = empDeptSchedule.value;
  if (!s) return "";
  const start = s.work_start || s.workStart || s.start_time || s.time_in;
  const end = s.work_end || s.workEnd || s.end_time || s.time_out;
  if (!start || !end) return "";
  return `${prettyHHMM(start)} - ${prettyHHMM(end)}`;
});

/* Workdays pretty */
const FULL = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
const empDeptWorkdaysPretty = computed(() => {
  const note = empDeptSchedule.value?.workdays_note || "";
  if (!note) return "";
  const m = note.match(/([A-Za-z]{3,})\s*[–—-]\s*([A-Za-z]{3,})/);
  if (m) {
    const a = (m[1] || "").slice(0, 3).toLowerCase();
    const b = (m[2] || "").slice(0, 3).toLowerCase();
    const map = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
    const A = FULL[map[a]] || m[1];
    const B = FULL[map[b]] || m[2];
    return `${A} - ${B}`;
  }
  const map = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
  const parts = note
    .split(/[,\s/|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const fulls = parts.map((p) => FULL[map[p.slice(0, 3).toLowerCase()]] || p);
  return fulls.join(", ");
});

/* ---------- Print ---------- */
const printDetails = () => {
  try {
    const tbl = document.querySelector(".table");
    const tableHTML = tbl ? tbl.outerHTML : "<p>No attendance details available to print.</p>";

    const empN = empName?.value ?? "";
    const pos = empPosition?.value ?? "";
    const dept = empDeptName?.value ?? "";
    const sched = empDeptSchedulePretty?.value ?? "";
    const workdays = empDeptWorkdaysPretty?.value ?? "";
    const range = prettyRange.value;

    const kpiText = `
      <div class="kpi-lines">
        <div><strong>Days Attended:</strong> ${totalDaysAttended.value}</div>
        <div><strong>Days Absent:</strong> ${totalDaysAbsent.value}</div>
        <div><strong>Total Work Hours:</strong> ${totalWorkHoursHHMM.value}</div>
        <div><strong>Total Overtime (hrs):</strong> ${totalOvertimeHHMM.value}</div>
        <div><strong>Total Late (hrs):</strong> ${totalLateHHMM.value}</div>
      </div>`;

    const w = window.open("", "_blank");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendance - ${empN}</title>
      <style>
        *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
        body{padding:18px;color:#111827}
        h1{font-size:18px;margin:0 0 4px}
        h2{font-size:14px;margin:0;color:#374151}
        .meta{margin:10px 0 12px;font-size:12px;color:#374151}
        .kpi-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;font-size:13px;margin:8px 0 16px}
        .kpi-lines div{padding:6px 8px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
        thead th{background:#f3f4f6}
        @page { size: A4; margin: 14mm; }
      </style></head><body>
      <h1>Employee Attendance</h1>
      <h2>${empN}${pos ? " — " + pos : ""}</h2>
      <div class="meta">
        ${dept ? "Department: " + dept + " · " : ""}${sched ? "Schedule: " + sched + " · " : ""}${workdays ? "Workdays: " + workdays + " · " : ""}Range: ${range}
      </div>
      ${kpiText}
      ${tableHTML}
      <script>window.onload=function(){window.print(); setTimeout(()=>window.close(), 250);}<\/script>
      </body></html>`);
    w.document.close();
  } catch (e) {
    console.error("Print failed", e);
    window.print();
  }
};

/* ---------- Mount & date controls ---------- */
const quickSelect = ref("");

onMounted(async () => {
  const [u, s, a, d, ocList, ocScheds, g] = await Promise.all([
    fetchUsers(),
    fetchSchedules(),
    fetchAttendance(),
    fetchDepartments(),
    fetchOnCallList(),
    fetchOnCallSchedules(),
    fetchGeotags(),
  ]);

  users.value = u;
  schedules.value = s;
  attendance.value = a;
  departments.value = d;
  onCallList.value = ocList;
  onCallSchedules.value = ocScheds;
  geotags.value = g;

  const y = dayjs().subtract(1, "day");
  toDate.value = y.format("YYYY-MM-DD");
  fromDate.value = y.subtract(7, "day").format("YYYY-MM-DD");
});

function applyQuickDropdown() {
  const v = String(quickSelect.value || "");
  const min = dayjs(minStartStr.value);
  const y = dayjs(yesterdayStr.value);

  if (v === "0") {
    fromDate.value = y.format("YYYY-MM-DD");
    toDate.value = y.format("YYYY-MM-DD");
  } else if (v === "7" || v === "14" || v === "30") {
    const days = parseInt(v, 10);
    let tD = y;
    let fD = tD.subtract(days - 1, "day");
    if (fD.isBefore(min)) fD = min;
    fromDate.value = fD.format("YYYY-MM-DD");
    toDate.value = tD.format("YYYY-MM-DD");
  }
  quickSelect.value = "";
}

const minStartStr = computed(() => dayjs("2025-10-10").format("YYYY-MM-DD"));
const yesterdayStr = computed(() => dayjs().subtract(1, "day").format("YYYY-MM-DD"));

watch([fromDate, toDate], ([f, t]) => {
  const min = dayjs(minStartStr.value);
  const y = dayjs(yesterdayStr.value);
  let fD = dayjs(String(f || minStartStr.value));
  let tD = dayjs(String(t || yesterdayStr.value));
  if (fD.isBefore(min)) fD = min;
  if (fD.isAfter(y)) fD = y;
  if (tD.isBefore(fD)) tD = fD;
  if (tD.isAfter(y)) tD = y;
  const fNew = fD.format("YYYY-MM-DD");
  const tNew = tD.format("YYYY-MM-DD");
  if (fNew !== (fromDate.value || "")) fromDate.value = fNew;
  if (tNew !== (toDate.value || "")) toDate.value = tNew;
});

/* ---------- User image ---------- */
const empImage = computed(() => {
  const imageId = emp.value?.user_image;
  return getDirectImageUrl(imageId);
});

const initials = computed(() => {
  const f = (emp.value?.user_fname || "").trim();
  const l = (emp.value?.user_lname || "").trim();
  const fi = f ? f[0].toUpperCase() : "";
  const li = l ? l[0].toUpperCase() : "";
  return fi + li || "—";
});

/* ---------- Geotag helpers ---------- */
const geotagsByLogId = computed(() => {
  const m = new Map();
  for (const g of geotags.value || []) {
    const id = g.log_id;
    if (id == null) continue;
    const key = String(id);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(g);
  }
  return m;
});

function geotagsForLog(logId) {
  return geotagsByLogId.value.get(String(logId)) || [];
}

function hasGeotag(logId) {
  return geotagsForLog(logId).length > 0;
}

function toggleGeo(logId) {
  const k = String(logId);
  geoOpen.value = { ...geoOpen.value, [k]: !geoOpen.value[k] };
}

function coordsOf(g) {
  const c = g?.position?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
function coordsText(g) {
  const p = coordsOf(g);
  return p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : "";
}
function prettyCapturedAt(v) {
  if (!v) return "";
  const d = dayjs(String(v));
  return d.isValid() ? d.format("MMM D, YYYY h:mma") : String(v);
}

function geotagPick(logId, kind) {
  const arr = geotagsForLog(logId);
  if (!arr.length) return null;

  const filtered = arr.filter(
    (g) => String(g.kind || "").toUpperCase() === String(kind).toUpperCase()
  );
  if (!filtered.length) return null;

  filtered.sort((a, b) => {
    const ad = String(a.captured_at || "");
    const bd = String(b.captured_at || "");
    if (ad && bd) return bd.localeCompare(ad);
    return Number(b.geotag_id || 0) - Number(a.geotag_id || 0);
  });

  return filtered[0];
}

function mapEmbedUrl(g) {
  const p = coordsOf(g);
  if (!p) return "";
  const q = encodeURIComponent(`${p.lat},${p.lng}`);
  return `https://maps.google.com/maps?q=${q}&z=16&output=embed`;
}

/**
 * Geotag image:
 * - If image_path is a Directus file ID, this will work: /api/assets/:id?access_token=TOKEN
 * - If image_path is a filename, it will still try (some setups accept it).
 */
function geotagImageUrl(g) {
  const id = g?.image_path;
  if (!id || id === "null" || id === "undefined") return null;
  // This matches your working browser-side image logic: access_token in query
  return `/api/assets/${encodeURIComponent(String(id))}?access_token=rTilKSsclzuQW8WfQWK1ba8wrD_LetNn`;
}

/* ---------- Zoom modal (click to zoom) ---------- */
const zoom = ref({
  open: false,
  src: "",
  title: "",
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  touchDist: 0,
});

const zoomImgStyle = computed(() => ({
  transform: `translate(${zoom.value.x}px, ${zoom.value.y}px) scale(${zoom.value.scale})`,
}));

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function onZoomKeydown(e) {
  if (e.key === "Escape") closeZoom();
}

function openZoom(src, title = "") {
  if (!src) return;
  zoom.value.open = true;
  zoom.value.src = src;
  zoom.value.title = title;
  zoom.value.scale = 1;
  zoom.value.x = 0;
  zoom.value.y = 0;
  zoom.value.dragging = false;
  window.addEventListener("keydown", onZoomKeydown);
}

function closeZoom() {
  zoom.value.open = false;
  zoom.value.src = "";
  zoom.value.title = "";
  zoom.value.dragging = false;
  window.removeEventListener("keydown", onZoomKeydown);
}

function zoomIn() {
  zoom.value.scale = clamp(zoom.value.scale + 0.2, 1, 6);
}
function zoomOut() {
  zoom.value.scale = clamp(zoom.value.scale - 0.2, 1, 6);
  if (zoom.value.scale === 1) {
    zoom.value.x = 0;
    zoom.value.y = 0;
  }
}
function resetZoom() {
  zoom.value.scale = 1;
  zoom.value.x = 0;
  zoom.value.y = 0;
}

function onWheelZoom(e) {
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  zoom.value.scale = clamp(zoom.value.scale + delta, 1, 6);
  if (zoom.value.scale === 1) {
    zoom.value.x = 0;
    zoom.value.y = 0;
  }
}

function onDragStart(e) {
  if (!zoom.value.open) return;
  if (zoom.value.scale <= 1) return;
  zoom.value.dragging = true;
  zoom.value.startX = e.clientX;
  zoom.value.startY = e.clientY;
  zoom.value.lastX = zoom.value.x;
  zoom.value.lastY = zoom.value.y;
}
function onDragMove(e) {
  if (!zoom.value.dragging) return;
  const dx = e.clientX - zoom.value.startX;
  const dy = e.clientY - zoom.value.startY;
  zoom.value.x = zoom.value.lastX + dx;
  zoom.value.y = zoom.value.lastY + dy;
}
function onDragEnd() {
  zoom.value.dragging = false;
}

function dist(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e) {
  if (!zoom.value.open) return;
  const t = e.touches;
  if (t.length === 1 && zoom.value.scale > 1) {
    zoom.value.dragging = true;
    zoom.value.startX = t[0].clientX;
    zoom.value.startY = t[0].clientY;
    zoom.value.lastX = zoom.value.x;
    zoom.value.lastY = zoom.value.y;
  } else if (t.length === 2) {
    zoom.value.dragging = false;
    zoom.value.touchDist = dist(t[0], t[1]);
  }
}
function onTouchMove(e) {
  if (!zoom.value.open) return;
  const t = e.touches;

  // Pan
  if (t.length === 1 && zoom.value.dragging && zoom.value.scale > 1) {
    const dx = t[0].clientX - zoom.value.startX;
    const dy = t[0].clientY - zoom.value.startY;
    zoom.value.x = zoom.value.lastX + dx;
    zoom.value.y = zoom.value.lastY + dy;
    return;
  }

  // Pinch zoom
  if (t.length === 2) {
    const d = dist(t[0], t[1]);
    const ratio = d / (zoom.value.touchDist || d);
    const nextScale = clamp(zoom.value.scale * ratio, 1, 6);
    zoom.value.scale = nextScale;
    zoom.value.touchDist = d;

    if (zoom.value.scale === 1) {
      zoom.value.x = 0;
      zoom.value.y = 0;
    }
  }
}
function onTouchEnd() {
  zoom.value.dragging = false;
  zoom.value.touchDist = 0;
}
</script>

<style scoped>
/* Page & cards */
.page {
  display: grid;
  gap: 12px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 2px 5px rgba(17, 24, 39, 0.04);
  padding: 16px;
}

/* Header grid: Back | Title | Range + Print */
.header-card {
  padding: 16px;
}
.header-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.left {
  justify-self: start;
}
.center {
  justify-self: center;
}
.right {
  justify-self: end;
  display: inline-flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
}
.right > * {
  flex: 0 0 auto;
}
.right .range-wrap,
.right .btn-print {
  width: auto !important;
  max-width: max-content;
  white-space: nowrap;
}

.title {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
  color: #111827;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(17, 24, 39, 0.06);
}
.btn:hover {
  opacity: 0.96;
  transform: translateY(-1px);
}
.btn:active {
  transform: translateY(0);
}
.btn-ghost {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111827;
  font-weight: 600;
}
.btn-ghost:hover {
  background: #f9fafb;
}
.btn-icon {
  display: block;
}
.btn-print {
  padding-inline: 14px;
}
.btn-mini {
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
}

/* Range badge */
.range-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  border-radius: 999px;
  color: #374151;
  font-weight: 600;
}
.range-icon {
  font-size: 12px;
}
.range-badge {
  font-size: 12px;
  letter-spacing: 0.01em;
}

/* User card */
.user-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #fff;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #f3f4f6;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initials {
  font-weight: 700;
  color: #9ca3af;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 24px;
  width: 100%;
}
.emp-name {
  font-weight: 800;
  font-size: 16px;
  line-height: 1.1;
  color: #111827;
}
.emp-dept {
  font-weight: 700;
  color: #111827;
}
.right-align {
  text-align: right;
}

/* Filters */
.filters {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.field {
  grid-column: span 3 / span 3;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.restday-field {
  grid-column: span 2 / span 2;
}
.grow {
  grid-column: span 1 / span 1;
}
label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}
input,
select {
  padding: 9px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  outline: none;
  font-size: 14px;
  background: #fff;
}
input:focus,
select:focus {
  border-color: #111827;
}
.toggle-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 13px;
  color: #374151;
  height: 42px;
}
.toggle-line input {
  width: 16px;
  height: 16px;
}

@media (max-width: 900px) {
  .header-grid {
    grid-template-columns: 1fr;
  }
  .center {
    justify-self: start;
  }
  .right {
    justify-self: start;
  }
  .filters {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .field,
  .grow {
    grid-column: span 3 / span 3;
  }
  .restday-field {
    grid-column: span 3 / span 3;
  }
}

/* KPIs (screen) */
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
  gap: 6px;
  align-items: center;
}
.kpi-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #6b7280;
  text-transform: uppercase;
}
.kpi-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

/* Table */
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  overflow: hidden;
  border-radius: 12px;
}
.table thead th {
  text-align: left;
  background: #f8fafc;
  color: #374151;
  font-weight: 700;
  border-bottom: 1px solid #e5e7eb;
  padding: 10px;
}
.table td {
  border-top: 1px solid #f1f5f9;
  padding: 10px;
  vertical-align: middle;
}
.table tbody tr:hover {
  background: #fafafa;
}

/* Chips */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;
}
.chip-ok {
  background: #ecfdf5;
  color: #0f766e;
  border-color: #a7f3d0;
}
.chip-warn {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}
.chip-danger {
  background: #fef2f2;
  color: #991b1b;
  border-color: #fecaca;
}
.chip-muted {
  background: #f3f4f6;
  color: #374151;
  border-color: #e5e7eb;
}

/* Helpers */
.muted {
  color: #6b7280;
}
.small {
  font-size: 12px;
}
.center {
  text-align: center;
}

/* ✅ Miggle badge + actions */
.geo-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.badge-miggle {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #3730a3;
}

/* ✅ Geotag dropdown panel */
.geo-cell {
  background: #fff;
  padding: 12px;
}
.geotag-panel {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #fff;
}
.geotag-panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.panel-title {
  font-weight: 900;
  color: #111827;
}
.panel-sub {
  white-space: nowrap;
}

/* ✅ 2-column TIME IN / TIME OUT preview */
.geo-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.geo-col {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #fff;
}
.geo-col-title {
  font-weight: 800;
  color: #111827;
  margin-bottom: 10px;
}
.geo-stack {
  display: grid;
  gap: 10px;
}
.map-wrap {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
}
.map-iframe {
  width: 100%;
  height: 220px;
  border: 0;
  display: block;
}
.img-wrap img {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  display: block;
}
.geo-meta {
  line-height: 1.4;
}
.geo-empty {
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px dashed #e5e7eb;
}
@media (max-width: 900px) {
  .geo-compare {
    grid-template-columns: 1fr;
  }
}

/* ✅ click to zoom */
.click-zoom {
  cursor: zoom-in;
}

/* ✅ fullscreen zoom modal */
.zoom-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.72);
  display: grid;
  grid-template-rows: auto 1fr;
  z-index: 9999;
}
.zoom-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(229, 231, 235, 0.8);
}
.zoom-title {
  font-weight: 900;
  color: #111827;
}
.zoom-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.zoom-stage {
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 18px;
  cursor: grab;
}
.zoom-stage:active {
  cursor: grabbing;
}
.zoom-img {
  max-width: 92vw;
  max-height: 82vh;
  user-select: none;
  -webkit-user-drag: none;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  transform-origin: center center;
}
</style>
