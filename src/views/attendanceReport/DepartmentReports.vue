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
        <div class="field" style="display: flex; align-items: flex-end;">
          <button class="btn secondary" @click="showInactive = !showInactive" style="margin-bottom: 0;">
            {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
          </button>
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
              <th class="no-print">Geotag</th>
            </tr>
            </thead>
            <tbody>
            <template
                v-for="r in group.rows"
                :key="r.key"
            >
            <tr
                :class="[{ 'row-consistent': r.consistentlyOnTime }, { 'is-inactive': r.rawUser && !isActiveUser(r.rawUser) }]"
            >
              <td class="col-name">
                <div class="emp-name">
                  {{ r.empName || r.name || r.employee_name || "-" }}
                  <span v-if="r.rawUser && !isActiveUser(r.rawUser)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
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

              <!-- ✅ Miggle badge + dropdown trigger -->
              <td class="no-print">
                <div class="geo-actions" v-if="r.log_id">
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
                <span v-else class="muted small">—</span>
              </td>
            </tr>

            <!-- ✅ Dropdown preview row -->
            <tr v-if="r.log_id && geoOpen[String(r.log_id)]" class="no-print">
              <td colspan="7" class="geo-cell">
                <div class="geotag-panel">
                  <div class="geotag-panel-header">
                    <div class="panel-title">Geotag Evidence</div>
                    <div class="panel-sub muted small">
                      Log #{{ r.log_id }} · {{ r.date }}
                    </div>
                  </div>

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

            <tr v-if="group.rows.length === 0">
              <td colspan="7" class="muted center">No records.</td>
            </tr>
            </tbody>
          </table>
        </template>
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
import dayjs from "dayjs";
import {
  fetchUsers,
  fetchDepartments,
  fetchSchedules,
  fetchAttendance,
  fetchOnCallList,
  fetchOnCallSchedules,
  fetchGeotags,
  getDirectImageUrl,
} from "../../services/api";
import { computeStatus, minutesToHHMM } from "../../utils/time";

const users = ref([]);
const departments = ref([]);
const schedules = ref([]);
const attendance = ref([]);

/* --- geotags --- */
const geotags = ref([]);
const geoOpen = ref({});

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
const showInactive = ref(false);

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
const employeesInDept = computed(() => {
    const list = showInactive.value ? (users.value || []) : activeUsers.value;
    return list.filter((u) => u.user_department === deptId.value);
});

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
      log_id: rec ? rec.log_id : null,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      status: "Rest Day",
      punctuality: "—",
      workMinutes: undefined,
      lateMinutes: undefined,
      overtimeMinutes: undefined,
      date: ymd,
      schedule: effSched,
      rawUser: u,
    };
  }

  if (!rec || (!rec.time_in && !rec.time_out)) {
    return {
      key: `r-${u.user_id}-${ymd}`,
      log_id: rec ? rec.log_id : null,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      status: "Absent",
      punctuality: "—",
      workMinutes: undefined,
      lateMinutes: undefined,
      overtimeMinutes: undefined,
      date: ymd,
      schedule: effSched,
      rawUser: u,
    };
  }

  const expectedStart = effSched?.work_start || "08:00:00";
  const expectedEnd = effSched?.work_end || "17:00:00";

  const graceMins = effSched?.grace_period != null ? Number(effSched.grace_period) : 5;

  const stat = computeStatus({
    time_in: rec.time_in,
    time_out: rec.time_out,
    expectedStart,
    expectedEnd,
    gracePeriod: graceMins,
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
  const graceMins = effSched?.grace_period != null ? Number(effSched.grace_period) : 5;
  const grace = schedStart ? schedStart.add(graceMins, "minute") : null;
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
    log_id: rec ? rec.log_id : null,
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
    rawUser: u,
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
  const [u, d, s, a, ocList, ocScheds, g] = await Promise.all([
    fetchUsers(),
    fetchDepartments(),
    fetchSchedules(),
    fetchAttendance(),
    fetchOnCallList(),
    fetchOnCallSchedules(),
    fetchGeotags(),
  ]);
  users.value = u;
  departments.value = d;
  schedules.value = s;
  attendance.value = a;
  onCallList.value = ocList;
  onCallSchedules.value = ocScheds;
  geotags.value = g;

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
/* ---------- Geotag Helpers & Zoom ---------- */
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

function geotagImageUrl(g) {
  const id = g?.image_path;
  if (!id || id === "null" || id === "undefined") return null;
  return `/api/assets/${encodeURIComponent(String(id))}?access_token=rTilKSsclzuQW8WfQWK1ba8wrD_LetNn`;
}

/* ---------- Zoom modal ---------- */
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

  if (t.length === 1 && zoom.value.dragging && zoom.value.scale > 1) {
    const dx = t[0].clientX - zoom.value.startX;
    const dy = t[0].clientY - zoom.value.startY;
    zoom.value.x = zoom.value.lastX + dx;
    zoom.value.y = zoom.value.lastY + dy;
    return;
  }

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

/* btn ghost / mini */
.btn-ghost {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111827;
  font-weight: 600;
}
.btn-ghost:hover {
  background: #f9fafb;
}
.btn-mini {
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
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
.small { font-size: 12px; }

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
