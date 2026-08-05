<template>
  <section class="page">
    <!-- Header / Filters -->
    <div class="card header-card">
      <div class="title-row">
        <h3 class="title">Summary Reports</h3>

        <div class="title-actions no-print">
          <label class="toggle">
            <input type="checkbox" v-model="hoursOnly" />
            <span>Hours only (¼-hr)</span>
          </label>

          <button class="btn" @click="openExcelPreview" aria-label="Preview Excel">
            Preview Excel
          </button>
          <button class="btn" @click="openPdfPreview" aria-label="Preview PDF">
            Preview PDF
          </button>
          <button class="btn-print" @click="printSummary" aria-label="Print Summary">
            Print
          </button>
        </div>
      </div>

      <div class="filters">
        <div class="field">
          <label>From</label>
          <input type="date" v-model="fromDate" :min="fromMinDate" :max="toDate" />
        </div>
        <div class="field">
          <label>To</label>
          <input type="date" v-model="toDate" :min="fromDate" :max="yesterdayStr" />
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
        <div class="field">
          <label>Search Employee</label>
          <input type="text" v-model.trim="empSearch" placeholder="Type a name…" />
        </div>
        <div class="field" style="display: flex; align-items: flex-end;">
          <button class="btn secondary" @click="showInactive = !showInactive" style="margin-bottom: 0;">
            {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
          </button>
        </div>
        <div class="grow"></div>
      </div>

      <div class="columns-row">
        <span class="columns-label">Columns</span>
        <div class="columns-chks">
          <label class="chk"><input type="checkbox" v-model="showTotalWorking" /><span>T</span></label>
          <label class="chk"><input type="checkbox" v-model="showLate" /><span>L</span></label>
          <label class="chk"><input type="checkbox" v-model="showOvertime" /><span>O</span></label>
          <label class="chk"><input type="checkbox" v-model="showUndertime" /><span>U</span></label>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card" style="overflow: hidden">
      <div
          ref="scrollHost"
          class="table-wrap overflow-x-auto"
          role="region"
          style="overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain;"
      >
        <table class="grid-table" :style="[{ minWidth: gridMinPx }, { width: 'max-content' }]">
          <thead>
          <!-- Day groups -->
          <tr>
            <th
                class="sticky-col name-col header-spacer"
                :style="{ minWidth: nameMinPx, position: 'sticky', left: '0px', top: '0px', zIndex: 5, background: '#f8fafc' }"
            ></th>

            <th
                v-for="d in daysSafe"
                :key="'grp-' + d.ymd"
                class="date-group"
                :colspan="perDayCols"
                :style="{ minWidth: groupMinPx }"
            >
              <div class="date-head">
                <div class="dmy">{{ d.dmy }} ({{ d.dow }})</div>
              </div>
            </th>

            <th class="total-head top-totals" :colspan="3" :style="{ minWidth: 3 * colMin + 'px' }">
              Totals
            </th>
          </tr>

          <!-- Sub headers -->
          <tr>
            <th
                class="sticky-col name-col"
                :style="{ minWidth: nameMinPx, position: 'sticky', left: '0px', top: headerTopOffset, zIndex: 6, background: '#f8fafc' }"
            >
              Name
            </th>

            <template v-for="d in daysSafe" :key="'sub-' + d.ymd">
              <th v-if="showTotalWorking" class="sub-col sub-t" :style="{ minWidth: colMinPx }">T</th>
              <th v-if="showLate" class="sub-col" :style="{ minWidth: colMinPx }">L</th>
              <th v-if="showOvertime" class="sub-col" :style="{ minWidth: colMinPx }">O</th>
              <th v-if="showUndertime" class="sub-col" :style="{ minWidth: colMinPx }">U</th>
            </template>

            <th class="sub-col total-head right" :style="{ minWidth: colMinPx }">Total Work</th>
            <th class="sub-col total-head right" :style="{ minWidth: colMinPx }">Total Late</th>
            <th class="sub-col total-head right" :style="{ minWidth: colMinPx }">Total OT</th>
          </tr>
          </thead>

          <tbody>
          <template v-for="u in filteredUsers" :key="u.user_id">
            <tr :class="{ 'is-inactive': !isActiveUser(u) }">
              <td class="sticky-col name-col" :style="{ minWidth: nameMinPx }">
                <div class="emp-name">
                  {{ u.user_fname }} {{ u.user_lname }}
                  <span v-if="!isActiveUser(u)" style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: 500;">(Inactive)</span>
                </div>
                <div class="emp-meta"><span class="dept">{{ deptName(u.user_department) }}</span></div>
              </td>

              <template v-for="d in daysSafe" :key="u.user_id + '-' + d.ymd">
                <!-- RD -->
                <template v-if="dayGroupMode(u.user_id, d.ymd) === 'rd'">
                  <td v-if="showTotalWorking" class="kcell is-rd" :style="{ minWidth: colMinPx }"><span class="chip rd">RD</span></td>
                  <td v-if="showLate" class="kcell is-rd" :style="{ minWidth: colMinPx }"><span class="chip rd">RD</span></td>
                  <td v-if="showOvertime" class="kcell is-rd" :style="{ minWidth: colMinPx }"><span class="chip rd">RD</span></td>
                  <td v-if="showUndertime" class="kcell is-rd" :style="{ minWidth: colMinPx }"><span class="chip rd">RD</span></td>
                </template>

                <!-- Absent -->
                <template v-else-if="dayGroupMode(u.user_id, d.ymd) === 'absent'">
                  <td v-if="showTotalWorking" class="kcell" :style="{ minWidth: colMinPx }"><span class="chip chip-absent">Absent</span></td>
                  <td v-if="showLate" class="kcell" :style="{ minWidth: colMinPx }"><span class="chip chip-absent">Absent</span></td>
                  <td v-if="showOvertime" class="kcell" :style="{ minWidth: colMinPx }"><span class="chip chip-absent">Absent</span></td>
                  <td v-if="showUndertime" class="kcell" :style="{ minWidth: colMinPx }"><span class="chip chip-absent">Absent</span></td>
                </template>

                <!-- Normal -->
                <template v-else>
                  <td v-if="showTotalWorking" class="kcell k-t" :style="{ minWidth: colMinPx }">{{ fmtVal(cell(u.user_id, d.ymd).workMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showLate" class="kcell k-l" :style="{ minWidth: colMinPx }">{{ fmtVal(cell(u.user_id, d.ymd).lateMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showOvertime" class="kcell k-o" :style="{ minWidth: colMinPx }">{{ fmtVal(cell(u.user_id, d.ymd).overtimeMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showUndertime" class="kcell k-u" :style="{ minWidth: colMinPx }">{{ fmtVal(cell(u.user_id, d.ymd).undertimeMins, cell(u.user_id, d.ymd)) }}</td>
                </template>
              </template>

              <td class="kcell total total-work" :style="{ minWidth: colMinPx }">{{ fmtVal(rowTotals(u.user_id).w) }}</td>
              <td class="kcell total total-late" :style="{ minWidth: colMinPx }">{{ fmtVal(rowTotals(u.user_id).l) }}</td>
              <td class="kcell total total-ot" :style="{ minWidth: colMinPx }">{{ fmtVal(rowTotals(u.user_id).o) }}</td>
            </tr>
          </template>

          <tr v-if="filteredUsers.length === 0">
            <td class="center muted" :colspan="daysSafe.length * perDayCols + 4">
              No employees for the selected filters.
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PDF preview -->
    <div v-if="pdfModalOpen" class="modal-overlay" @click.self="closePdfPreview">
      <div class="modal">
        <div class="modal-head">
          <h4>PDF Preview</h4>
          <div class="spacer"></div>
          <button class="btn small" @click="downloadPdf">Download PDF</button>
          <button class="btn danger small" @click="closePdfPreview">Close</button>
        </div>
        <div class="modal-body">
          <iframe v-if="pdfBlobUrl" :src="pdfBlobUrl" style="width:100%;height:70vh;border:1px solid #e5e7eb;border-radius:10px;"></iframe>
          <div v-else class="loading-note">Generating PDF preview…</div>
        </div>
      </div>
    </div>

    <!-- Excel preview -->
    <div v-if="excelModalOpen" class="modal-overlay" @click.self="closeExcelPreview">
      <div class="modal">
        <div class="modal-head">
          <h4>Excel Preview</h4>
          <div class="spacer"></div>
          <button class="btn small" @click="downloadExcel">Download Excel</button>
          <button class="btn danger small" @click="closeExcelPreview">Close</button>
        </div>
        <div class="modal-body">
          <div class="excel-preview">
            <table>
              <thead>
              <tr>
                <th>Name</th>
                <template v-for="d in daysSafe" :key="'xh1-'+d.ymd">
                  <th v-if="showTotalWorking">T</th>
                  <th v-if="showLate">L</th>
                  <th v-if="showOvertime">O</th>
                  <th v-if="showUndertime">U</th>
                </template>
                <th>Total Work</th>
                <th>Total Late</th>
                <th>Total OT</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="u in filteredUsers" :key="'xr-'+u.user_id">
                <td>{{ u.user_fname }} {{ u.user_lname }}</td>
                <template v-for="d in daysSafe" :key="'xc-'+u.user_id+'-'+d.ymd">
                  <td v-if="showTotalWorking">{{ excelFmt(cell(u.user_id, d.ymd).workMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showLate">{{ excelFmt(cell(u.user_id, d.ymd).lateMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showOvertime">{{ excelFmt(cell(u.user_id, d.ymd).overtimeMins, cell(u.user_id, d.ymd)) }}</td>
                  <td v-if="showUndertime">{{ excelFmt(cell(u.user_id, d.ymd).undertimeMins, cell(u.user_id, d.ymd)) }}</td>
                </template>
                <td>{{ excelFmt(rowTotals(u.user_id).w) }}</td>
                <td>{{ excelFmt(rowTotals(u.user_id).l) }}</td>
                <td>{{ excelFmt(rowTotals(u.user_id).o) }}</td>
              </tr>
              </tbody>
            </table>
          </div>
          <div class="muted" style="margin-top:8px">Lightweight HTML preview of the Excel content.</div>
        </div>
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
  fetchAttendance,
  fetchOnCallList,
  fetchOnCallSchedules,
} from "../../services/api";
import { computeStatus } from "../../utils/time";

/* ------------ Data state ------------ */
const users = ref([]);
const departments = ref([]);
const schedules = ref([]);
const attendance = ref([]);
const onCallList = ref([]);
const onCallSchedules = ref([]);

/* ------------ Filters / UI ------------ */
const fromDate = ref("");
const toDate = ref("");
const deptFilter = ref(0);
const empSearch = ref("");
const hoursOnly = ref(false);
const showInactive = ref(false);

const showTotalWorking = ref(true);
const showLate = ref(true);
const showOvertime = ref(true);
const showUndertime = ref(true);

/* Preview modals */
const pdfModalOpen = ref(false);
const excelModalOpen = ref(false);
const pdfBlobUrl = ref("");
let _pdfBlobObjectUrl = null;

/* Responsive sizes */
const scrollHost = ref(null);
const hostWidth = ref(1280);
let ro;
let windowMeasureHandler = null;

/* Helpers */
const yesterdayStr = computed(() => dayjs().subtract(1, "day").format("YYYY-MM-DD"));
const FROM_MIN = dayjs("2025-10-10");
const fromMinDate = computed(() => FROM_MIN.format("YYYY-MM-DD"));

const deptMap = computed(() => {
  const m = new Map();
  for (const d of departments.value) m.set(d.department_id, d);
  return m;
});
const deptName = (id) => deptMap.value.get(id)?.department_name || "";
const deptLabel = computed(() => (deptFilter.value ? deptName(deptFilter.value) || "—" : "All"));

/* Visible days */
const days = computed(() => {
  if (!fromDate.value || !toDate.value) return [];
  let d = dayjs(String(fromDate.value));
  const end = dayjs(String(toDate.value));
  const arr = [];
  while (d.isBefore(end) || d.isSame(end, "day")) {
    arr.push({ ymd: d.format("YYYY-MM-DD"), dow: d.format("ddd"), dmy: d.format("MMM D") });
    d = d.add(1, "day");
  }
  return arr;
});
const daysSafe = computed(() => (Array.isArray(days.value) ? days.value : []));

/* Sizing */
const colMin = computed(() => {
  const w = hostWidth.value;
  if (w < 360) return 54;
  if (w < 420) return 60;
  if (w < 520) return 70;
  if (w < 640) return 78;
  if (w < 840) return 88;
  if (w < 1100) return 96;
  return 110;
});
const nameMin = computed(() => {
  const w = hostWidth.value;
  if (w < 360) return 120;
  if (w < 420) return 130;
  if (w < 520) return 150;
  if (w < 640) return 170;
  if (w < 840) return 190;
  if (w < 1100) return 210;
  return 240;
});
const colMinPx = computed(() => `${colMin.value}px`);
const nameMinPx = computed(() => `${nameMin.value}px`);

const perDayCols = computed(() => {
  let n = 0;
  if (showTotalWorking.value) n++;
  if (showLate.value) n++;
  if (showOvertime.value) n++;
  if (showUndertime.value) n++;
  return n || 1;
});
const groupMinPx = computed(() => `${perDayCols.value * colMin.value}px`);
const gridMinPx = computed(() => {
  const cols = daysSafe.value.length * perDayCols.value * colMin.value + nameMin.value + 3 * colMin.value;
  return `${cols}px`;
});
const headerTopOffset = "42px";

/* Attendance index */
const logsByUserDate = computed(() => {
  const m = new Map();
  for (const l of attendance.value) m.set(`${l.user_id}|${String(l.log_date)}`, l);
  return m;
});

/* Workdays parsing */
const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ALIASES = { sunday:"Sun",sun:"Sun",monday:"Mon",mon:"Mon",tuesday:"Tue",tue:"Tue",tues:"Tue",wednesday:"Wed",wed:"Wed",thursday:"Thu",thu:"Thu",thur:"Thu",thurs:"Thu",friday:"Fri",fri:"Fri",saturday:"Sat",sat:"Sat" };
function normDayToken(token){ if(!token) return ""; const t=String(token).replace(/\./g,"").trim().toLowerCase(); if(DAY_ALIASES[t]) return DAY_ALIASES[t]; const short=t.slice(0,3); return DAY_ALIASES[short]||""; }
function parseWorkdaysNote(note){
  if (!note || typeof note !== "string") return null;
  const days = new Set();
  const rangeRe = new RegExp("(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\\s*(?:-|–|—|to)\\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)","gi");
  note.replace(rangeRe,(_,a,b)=>{const A=normDayToken(a),B=normDayToken(b); if(!A||!B) return ""; const ai=DAY_ORDER.indexOf(A), bi=DAY_ORDER.indexOf(B); if(ai<0||bi<0) return ""; let j=ai; while(true){ days.add(DAY_ORDER[j]); if(j===bi) break; j=(j+1)%7;} return "";});
  const singles = note.split(/[,/&\s]+/).map(t=>t.trim()).filter(Boolean);
  for (const tok of singles){ if (/(?:-|–|—|\bto\b)/i.test(tok)) continue; const d=normDayToken(tok); if (DAY_ORDER.includes(d)) days.add(d); }
  return days.size ? days : null;
}

/* On-call helpers */
const schedByDept = computed(()=>{ const m=new Map(); for(const s of schedules.value) m.set(s.department_id,s); return m;});
const onCallRowsByUserId = computed(()=>{ const m=new Map(); for(const row of onCallList.value){ const uid=Number(row.user_id ?? row.user ?? row.employee_id); if(!uid) continue; if(!m.has(uid)) m.set(uid,[]); m.get(uid).push(row);} return m;});
const onCallScheduleById = computed(()=>{ const m=new Map(); for(const s of onCallSchedules.value) m.set(Number(s.id),s); return m;});

function getEffectiveScheduleForDate(userId, ymd){
  const user = users.value.find(u=>u.user_id===userId);
  const deptSched = user ? schedByDept.value.get(user.user_department)||null : null;
  const rows = onCallRowsByUserId.value.get(Number(userId)) || [];
  const day = dayjs(ymd,"YYYY-MM-DD");
  for(const oc of rows){
    const schedId = Number(oc.dept_sched_id ?? oc.dept_schedule_id ?? oc.schedule_id);
    if(!schedId) continue;
    const ocSched = onCallScheduleById.value.get(schedId);
    if(!ocSched) continue;
    const startStr = String(ocSched.schedule_date ?? ocSched.date ?? "");
    if(!startStr) continue;
    const start = dayjs(startStr,"YYYY-MM-DD");
    if(!start.isValid()) continue;
    const spanDays = Number(ocSched.working_days ?? deptSched?.working_days ?? 1);
    const end = start.add(Math.max(1,spanDays)-1,"day");
    if((day.isAfter(start,"day")||day.isSame(start,"day")) && (day.isBefore(end,"day")||day.isSame(end,"day"))){
      return { sched: ocSched, source: "oncall", deptSched };
    }
  }
  return { sched: deptSched, source: "dept", deptSched };
}
function parseAnyTimeToDay(hmsOrIso, anchor="2000-01-01"){
  if(!hmsOrIso) return null;
  const s=String(hmsOrIso).trim();
  if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)){
    const hhmmss = /^\d{1,2}:\d{2}$/.test(s)? `${s}:00` : s;
    return dayjs(`${anchor}T${hhmmss}`);
  }
  const dt=dayjs(s);
  if(dt.isValid()) return dayjs(`${anchor}T${dt.format("HH:mm:ss")}`);
  return null;
}

/* Formatting */
function roundToQuarterHours(mins){ const hrs=(Number(mins)||0)/60; return Math.round(hrs*4)/4; }
function displayHMM(totalMinutes){ const m=Math.max(0,Math.floor(Number(totalMinutes)||0)); const h=Math.floor(m/60), r=m%60; return `${h}h ${r}m`; }
function fmtVal(mins, cellObj){
  if(cellObj && (cellObj.isRestDay || cellObj.isAbsent)) return cellObj.isRestDay ? "RD" : "Absent";
  return hoursOnly.value ? String(roundToQuarterHours(mins)) : displayHMM(mins);
}
function excelFmt(mins, cellObj){ return fmtVal(mins, cellObj); }

/* Render mode per day */
function dayGroupMode(userId, ymd){
  const c=cell(userId, ymd);
  if(c.isRestDay) return "rd";
  if(c.isAbsent) return "absent";
  return "normal";
}

/* Per-day calculation */
function cell(userId, ymd){
  const user = users.value.find(u=>u.user_id===userId);
  if(!user) return blankCell();
  const log = logsByUserDate.value.get(`${userId}|${ymd}`);

  const { sched: effectiveSched, source, deptSched } = getEffectiveScheduleForDate(userId, ymd);
  if(source==="dept"){
    const allowed = parseWorkdaysNote(deptSched?.workdays_note ?? "Mon–Fri") || new Set(["Mon","Tue","Wed","Thu","Fri"]);
    const dow = DAY_ORDER[dayjs(ymd).day()];
    if(!allowed.has(dow)) return { ...blankCell(), isRestDay: true, isAbsent:false };
  }

  const expectedStart = effectiveSched?.work_start || "08:00:00";
  const expectedEnd   = effectiveSched?.work_end   || "17:00:00";

  if(!log){ return { isRestDay:false, isAbsent:true, workMins:0, lateMins:0, overtimeMins:0, undertimeMins:0 }; }

  const stat = computeStatus({ time_in: log.time_in, time_out: log.time_out, expectedStart, expectedEnd });

  const startDJ = parseAnyTimeToDay(expectedStart);
  const endDJ   = parseAnyTimeToDay(expectedEnd);
  const outDJ   = parseAnyTimeToDay(log.time_out);

  let workMins=0;
  if(startDJ && endDJ){
    if(!outDJ && log.time_in){ workMins=240; }
    else if(outDJ && outDJ.isBefore(endDJ)){
      const utMins=Math.max(0, Math.ceil(endDJ.diff(outDJ,"second")/60));
      workMins=Math.max(0, 480 - utMins);
    } else { workMins=480; }
  }

  const inDJ = parseAnyTimeToDay(log.time_in);
  const grace = startDJ ? startDJ.add(5,"minute") : null;
  let lateFromIn=0;
  if(inDJ && grace && inDJ.isAfter(grace)){ lateFromIn = Math.max(0, Math.floor(inDJ.diff(grace,"second")/60)); }

  const lunchStartDJ = parseAnyTimeToDay(log.lunch_start || log.lunchStart || log.lunch_in || log.lunchIn);
  const lunchEndDJ   = parseAnyTimeToDay(log.lunch_end   || log.lunchEnd   || log.lunch_out|| log.lunchOut);
  let lunchExtra=0;
  if(lunchStartDJ && lunchEndDJ && lunchEndDJ.isAfter(lunchStartDJ)){
    const lunchDur = Math.floor(lunchEndDJ.diff(lunchStartDJ,"second")/60);
    lunchExtra = Math.max(0, lunchDur - 60);
  }

  const breakStartDJ = parseAnyTimeToDay(log.break_start || log.breakStart || log.break_in || log.breakIn);
  const breakEndDJ   = parseAnyTimeToDay(log.break_end   || log.breakEnd   || log.break_out || log.breakOut);
  let breakExtra=0;
  if(breakStartDJ && breakEndDJ && breakEndDJ.isAfter(breakStartDJ)){
    const breakDur = Math.floor(breakEndDJ.diff(breakStartDJ,"second")/60);
    breakExtra = Math.max(0, breakDur - 30);
  }

  const lateMins = Math.max(0, lateFromIn + lunchExtra + breakExtra);

  let undertimeMins=0;
  if(endDJ && outDJ && outDJ.isBefore(endDJ)){
    undertimeMins = Math.max(0, Math.ceil(endDJ.diff(outDJ,"second")/60));
  }

  const overtimeMins = Math.max(stat.overtimeMinutes || 0, 0);

  return { isRestDay:false, isAbsent:false, workMins, lateMins, overtimeMins, undertimeMins };
}
function blankCell(){ return { isRestDay:false, isAbsent:false, workMins:0, lateMins:0, overtimeMins:0, undertimeMins:0 }; }

/* === INACTIVE FILTER === */
function isActiveUser(u){
  const v = u?.is_deleted;
  // Directus-style Buffer: { type: "Buffer", data: [0|1,...] }
  if (v && typeof v === "object" && Array.isArray(v.data)) {
    return Number(v.data?.[0] ?? 0) !== 1;
  }
  // Other possible shapes (boolean/number/string)
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number")  return v !== 1;
  if (typeof v === "string")  return v !== "1" && v.toLowerCase() !== "true";
  // If field missing, assume active
  return true;
}

/* Sum totals per user */
function rowTotals(userId){
  let w=0,l=0,o=0;
  for(const d of daysSafe.value){ const c=cell(userId, d.ymd); w+=Number(c.workMins||0); l+=Number(c.lateMins||0); o+=Number(c.overtimeMins||0); }
  return { w,l,o };
}

/* User filter (NOW conditionally includes inactive users) */
const filteredUsersRaw = computed(() => {
  let list = Array.isArray(users.value) ? (showInactive.value ? users.value : users.value.filter(isActiveUser)) : [];
  if (deptFilter.value) {
    list = list.filter(u => u?.user_department === deptFilter.value);
  }
  if (empSearch.value) {
    const q = String(empSearch.value || "").toLowerCase();
    list = list.filter(u => (`${u?.user_fname ?? ""} ${u?.user_lname ?? ""}`.toLowerCase().includes(q)));
  }
  return list;
});
const filteredUsers = computed(() => Array.isArray(filteredUsersRaw.value) ? filteredUsersRaw.value : []);

/* Print window (unchanged) */
function printSummary() {
  try {
    const table = document.querySelector(".grid-table");
    const tableHTML = table ? table.outerHTML : "<p>No data.</p>";
    const rangeStr = fromDate.value && toDate.value
        ? `${dayjs(fromDate.value).format("MMM D, YYYY")} — ${dayjs(toDate.value).format("MMM D, YYYY")}` : "—";
    const cols = [
      showTotalWorking.value ? "T" : null,
      showLate.value ? "L" : null,
      showOvertime.value ? "O" : null,
      showUndertime.value ? "U" : null,
    ].filter(Boolean).join(", ") || "—";
    const metaHTML = `
      <div class="meta">
        <div><strong>Range:</strong> ${rangeStr}</div>
        <div><strong>Department:</strong> ${deptLabel.value}</div>
        <div><strong>Search:</strong> ${empSearch.value || "—"}</div>
        <div><strong>Per Day:</strong> ${cols}</div>
        <div><strong>Hours only:</strong> ${hoursOnly.value ? "Yes (¼-hr)" : "No"}</div>
        <div class="printed-on">Printed: ${dayjs().format("MMM D, YYYY h:mm A")}</div>
      </div>`;
    const w = window.open("", "_blank");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Summary Reports</title>
<style>*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}body{padding:18px;}h1{margin:0 0 6px;font-size:18px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;margin:6px 0 14px;font-size:12.5px}.printed-on{grid-column:1/-1;color:#6b7280}table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center;white-space:nowrap}thead th{background:#f3f4f6}.name-col{position:static!important;background:#fff!important}@page { size: A4 landscape; margin: 12mm; }</style></head>
<body><h1>Summary Reports</h1>${metaHTML}${tableHTML}<script>window.onload=function(){window.print(); setTimeout(()=>window.close(),250);}<\/script></body></html>`);
    w.document.close();
  } catch (e) {
    console.error("Print failed", e);
    window.print();
  }
}

/* Utils */
function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size){ out.push(arr.slice(i,i+size)); } return out; }
async function importJsPDF(){ const m = await import("jspdf"); return m.jsPDF || (m.default && m.default.jsPDF) || m.default || m; }
async function importAutoTable(){ const m = await import("jspdf-autotable"); return m.default || m.autoTable || m; }
async function importXLSX(){ const m = await import("xlsx"); return m.default || m; }

/* PDF (6 days per page) */
async function buildPdfBlob() {
  const jsPDF = await importJsPDF();
  const autoTable = await importAutoTable();

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginLeft = 40, marginRight = 40, topStart = 110;

  const title = "Summary Reports";
  const rangeStr = fromDate.value && toDate.value
      ? `${dayjs(fromDate.value).format("MMM D,  YYYY")} — ${dayjs(toDate.value).format("MMM D, YYYY")}` : "—";
  const deptStr = deptLabel.value;

  const metricsEnabled = [showTotalWorking.value, showLate.value, showOvertime.value, showUndertime.value].filter(Boolean).length || 1;
  const perDayGroupCols = metricsEnabled;

  const dayPages = chunk(daysSafe.value, 6);
  dayPages.forEach((dayChunk, pageIdx) => {
    if (pageIdx > 0) doc.addPage();

    doc.setFontSize(14); doc.text(title, marginLeft, 40);
    doc.setFontSize(10);
    doc.text(`Range: ${rangeStr}`, marginLeft, 58);
    doc.text(`Department: ${deptStr}`, marginLeft, 72);
    doc.text(`Generated: ${dayjs().format("MMM D, YYYY h:mm A")}`, marginLeft, 86);
    doc.text(`Hours only (¼-hr): ${hoursOnly.value ? "Yes" : "No"}`, marginLeft, 100);

    const headRow1 = []; const headRow2 = [];
    headRow1.push({ content: "", colSpan: 1 }); headRow2.push({ content: "Name" });
    dayChunk.forEach((d) => {
      headRow1.push({ content: `${d.dmy} (${d.dow})`, colSpan: perDayGroupCols });
      if (showTotalWorking.value) headRow2.push({ content: "T" });
      if (showLate.value)         headRow2.push({ content: "L" });
      if (showOvertime.value)     headRow2.push({ content: "O" });
      if (showUndertime.value)    headRow2.push({ content: "U" });
      if (headRow2.length === 1) headRow2.push({ content: " " });
    });
    headRow1.push({ content: "Totals", colSpan: 3 });
    headRow2.push({ content: "Total Work" }, { content: "Total Late" }, { content: "Total OT" });

    const bodyRows = filteredUsers.value.map((u) => {
      const row = [`${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim()];
      dayChunk.forEach((d) => {
        const c = cell(u.user_id, d.ymd);
        const v = (mins)=> fmtVal(mins, c);
        if (showTotalWorking.value) row.push(v(c.workMins));
        if (showLate.value)         row.push(v(c.lateMins));
        if (showOvertime.value)     row.push(v(c.overtimeMins));
        if (showUndertime.value)    row.push(v(c.undertimeMins));
        if (perDayGroupCols === 0) row.push("");
      });
      const totals = rowTotals(u.user_id);
      row.push(fmtVal(totals.w), fmtVal(totals.l), fmtVal(totals.o));
      return row;
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const usable = pageWidth - marginLeft - marginRight;

    const totalCols = 1 + dayChunk.length * perDayGroupCols + 3;
    const nameShare = 1.8, metricShare = 1.0, totalShare = 1.1;

    const shares = [];
    shares.push(nameShare);
    for (let i = 0; i < dayChunk.length; i++) {
      for (let k = 0; k < perDayGroupCols; k++) shares.push(metricShare);
    }
    shares.push(totalShare, totalShare, totalShare);

    const shareSum = shares.reduce((a,b)=>a+b, 0);
    const pxPerShare = usable / shareSum;

    const columnStyles = {};
    for (let idx = 0; idx < totalCols; idx++) columnStyles[idx] = { cellWidth: shares[idx] * pxPerShare };

    autoTable(doc, {
      startY: topStart,
      head: [headRow1, headRow2],
      body: bodyRows,
      styles: { fontSize: 8, cellPadding: 2.5, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [248,250,252], textColor: 15, fontStyle: "bold", halign: "center" },
      theme: "grid",
      margin: { left: marginLeft, right: marginRight },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === "head" && data.row.index === 1) {
          const txt = String(data.cell.text?.[0] || "");
          if (txt === "T") data.cell.styles.fillColor = [255,255,255];
          if (txt === "L") data.cell.styles.fillColor = [255,250,245];
          if (txt === "O") data.cell.styles.fillColor = [248,251,255];
          if (txt === "U") data.cell.styles.fillColor = [255,250,250];
        }
      },
    });
  });

  return doc.output("blob");
}

async function openPdfPreview(){
  pdfModalOpen.value = true;
  pdfBlobUrl.value = "";
  if(_pdfBlobObjectUrl){ URL.revokeObjectURL(_pdfBlobObjectUrl); _pdfBlobObjectUrl = null; }
  try{
    const blob = await buildPdfBlob();
    _pdfBlobObjectUrl = URL.createObjectURL(blob);
    pdfBlobUrl.value = _pdfBlobObjectUrl;
  }catch(err){
    console.error("PDF build error:", err);
    pdfModalOpen.value = false;
    alert("Failed to generate PDF. Ensure 'jspdf' and 'jspdf-autotable' are installed.");
  }
}
function closePdfPreview(){
  pdfModalOpen.value = false;
  if(_pdfBlobObjectUrl){ URL.revokeObjectURL(_pdfBlobObjectUrl); _pdfBlobObjectUrl = null; }
  pdfBlobUrl.value = "";
}
async function downloadPdf(){
  const blob = await buildPdfBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `summary_${fromDate.value}_${toDate.value}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Excel */
async function buildExcelAndDownload(){
  try{
    const XLSX = await importXLSX();
    const header = ["Name"];
    daysSafe.value.forEach(d=>{
      if(showTotalWorking.value) header.push(`T ${d.dmy}`);
      if(showLate.value)         header.push(`L ${d.dmy}`);
      if(showOvertime.value)     header.push(`O ${d.dmy}`);
      if(showUndertime.value)    header.push(`U ${d.dmy}`);
      if(!(showTotalWorking.value||showLate.value||showOvertime.value||showUndertime.value)) header.push(d.dmy);
    });
    header.push("Total Work","Total Late","Total OT");

    const rows = filteredUsers.value.map(u=>{
      const arr = [`${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim()];
      daysSafe.value.forEach(d=>{
        const c = cell(u.user_id, d.ymd);
        const v = (mins)=> fmtVal(mins, c);
        if(showTotalWorking.value) arr.push(v(c.workMins));
        if(showLate.value)         arr.push(v(c.lateMins));
        if(showOvertime.value)     arr.push(v(c.overtimeMins));
        if(showUndertime.value)    arr.push(v(c.undertimeMins));
        if(!(showTotalWorking.value||showLate.value||showOvertime.value||showUndertime.value)) arr.push("");
      });
      const totals = rowTotals(u.user_id);
      arr.push(fmtVal(totals.w), fmtVal(totals.l), fmtVal(totals.o));
      return arr;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = header.map(h => ({ wch: Math.max(8, String(h).length + 1) }));
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `summary_${fromDate.value}_${toDate.value}.xlsx`);
  }catch(err){
    console.error("Excel error:", err);
    alert("Failed to export Excel. Ensure 'xlsx' is installed.");
  }
}
function openExcelPreview(){ excelModalOpen.value = true; }
function closeExcelPreview(){ excelModalOpen.value = false; }
async function downloadExcel(){ await buildExcelAndDownload(); }

/* Mount / watchers */
onMounted(async ()=>{
  const [u,d,s,a,ocList,ocScheds] = await Promise.all([
    fetchUsers(), fetchDepartments(), fetchSchedules(), fetchAttendance(), fetchOnCallList(), fetchOnCallSchedules()
  ]);
  users.value = u; departments.value = d; schedules.value = s; attendance.value = a;
  onCallList.value = ocList; onCallSchedules.value = ocScheds;

  const y = dayjs().subtract(1,"day");
  toDate.value = y.format("YYYY-MM-DD");
  let fInit = y.subtract(7,"day"); if(fInit.isBefore(FROM_MIN)) fInit = FROM_MIN;
  fromDate.value = fInit.format("YYYY-MM-DD");

  if(scrollHost.value){
    const measure = ()=> (hostWidth.value = scrollHost.value.clientWidth || 1280);
    measure();
    ro = new ResizeObserver(measure); ro.observe(scrollHost.value);
    windowMeasureHandler = ()=>measure();
    window.addEventListener("resize", windowMeasureHandler, { passive:true });
    window.addEventListener("orientationchange", windowMeasureHandler, { passive:true });
  }
});
onUnmounted(()=>{
  if(ro && scrollHost.value) ro.unobserve(scrollHost.value);
  if(windowMeasureHandler){
    window.removeEventListener("resize", windowMeasureHandler);
    window.removeEventListener("orientationchange", windowMeasureHandler);
    windowMeasureHandler = null;
  }
});
watch([fromDate, toDate], ([f,t])=>{
  const y = dayjs(yesterdayStr.value);
  let fD = dayjs(String(f || yesterdayStr.value)).startOf("day");
  let tD = dayjs(String(t || yesterdayStr.value)).startOf("day");
  if(tD.isAfter(y)) tD = y;
  if(fD.isBefore(FROM_MIN)) fD = FROM_MIN;
  if(fD.isAfter(tD)) fD = tD;
  fromDate.value = fD.format("YYYY-MM-DD");
  toDate.value = tD.format("YYYY-MM-DD");
});
</script>

<style scoped>
/* same styles as before */
.page{display:grid;gap:12px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:16px}
.header-card{overflow:visible}
.title{margin:0 0 10px;font-weight:800;letter-spacing:.2px}
.title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.title-actions{display:flex;gap:10px;align-items:center}
.toggle{display:inline-flex;gap:8px;align-items:center;font-size:12.5px;color:#111827;font-weight:700}
.toggle input{width:16px;height:16px;accent-color:#111827}
.btn-print,.btn{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 2px 4px rgba(17,24,39,.06)}
.btn-print{border:1px solid #111827;background:#111827;color:#fff}
.btn{border:1px solid #e5e7eb;background:#fff;color:#111827}
.btn.danger{background:#b91c1c;color:#fff;border-color:#b91c1c}
.filters{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
.field{grid-column:span 3 / span 3;display:flex;flex-direction:column;gap:6px}
.grow{grid-column:span 3 / span 3}
.columns-row{display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap}
.columns-label{font-size:12px;color:#6b7280;font-weight:600}
.columns-chks{display:flex;gap:16px;flex-wrap:wrap}
.columns-chks .chk{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#0f172a;user-select:none}
.columns-chks input[type="checkbox"]{width:16px;height:16px;accent-color:#111827}
.table-wrap{width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid #e5e7eb;border-radius:12px;background:#fff;-webkit-overflow-scrolling:touch;contain:paint}
.grid-table{width:max-content;border-collapse:separate;border-spacing:0;font-size:13.5px}
.grid-table thead th{position:sticky;top:0;z-index:2;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#0f172a;box-shadow:0 2px 0 rgba(0,0,0,.03)}
.grid-table thead tr:first-child th{height:42px;line-height:42px;padding:0 8px;font-size:12px;font-weight:800;text-align:center}
.grid-table thead tr:nth-child(2) th{height:36px;line-height:36px;padding:0 6px;font-size:12px;font-weight:700;text-align:center;border-right:1px solid #e5e7eb;background:#f3f4f6}
.total-head{background:#e8f0ff}
.total-head.right{background:#e8f0ff;border-left:2px solid #c7d2fe}
.grid-table tbody tr:nth-child(odd) td:not(.sticky-col){background:#fcfcfd}
.grid-table td{border-top:1px solid #e5e7eb;padding:8px 6px;white-space:nowrap;vertical-align:middle;background:#fff}
.name-col{min-width:140px;text-align:left;background:#fff;font-size:14px;z-index:3;white-space:normal;line-height:1.24;box-shadow:2px 0 0 rgba(0,0,0,.03)}
.sticky-col{position:sticky;left:0;border-right:1px solid #e5e7eb}
.header-spacer{border-right:1px solid #e5e7eb}
.emp-name{font-weight:700}.emp-meta{font-size:12px;color:#6b7280}.emp-meta .dept{font-weight:600}
.date-group{text-align:center;border-right:2px solid #e2e8f0}
.date-head{display:grid;gap:2px}
.kcell{border-right:1px solid #e5e7eb;text-align:center;font-variant-numeric:tabular-nums;font-size:13px;line-height:1.2}
.kcell.k-l{background:#fffdfa}.kcell.k-o{background:#f8fbff}.kcell.k-u{background:#fffafa}
.kcell.is-rd{background:#f1f5f9;color:#475569;font-weight:700}
.kcell.total{background:#f8fafc;font-weight:700}.kcell.total-work{border-left:2px solid #c7d2fe}
.chip{display:inline-block;padding:2px 6px;border-radius:999px;font-size:11px;font-weight:700}
.chip.rd{background:#e2e8f0;color:#334155}
.chip-absent{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.center{text-align:center}.muted{color:#6b7280}
.modal-overlay{position:fixed;inset:0;background:rgba(17,24,39,0.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
.modal{background:#fff;border:1px solid #e5e7eb;border-radius:14px;width:min(1080px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}
.modal-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#f8fafd}
.modal-head h4{margin:0;font-size:15px;font-weight:800}.modal-head .spacer{flex:1 1 auto}
.modal-body{padding:12px;overflow:auto;background:#fff}
.excel-preview table{border-collapse:collapse;width:100%;font-size:12.5px}
.excel-preview th,.excel-preview td{border:1px solid #e5e7eb;padding:6px 8px;white-space:nowrap;text-align:center}
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
