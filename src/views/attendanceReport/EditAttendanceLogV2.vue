<template>
  <section class="row">
    <div class="card">
      <div class="header-row">
        <h3 class="title">Edit Attendance Log</h3>
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
          <label>Department</label>
          <select v-model.number="deptFilter">
            <option :value="0">All</option>
            <option v-for="d in departments" :key="d.department_id" :value="d.department_id">
              {{ d.department_name }}
            </option>
          </select>
        </div>

        <div class="field field--search">
          <label>Search Employee</label>
          <div class="search-line">
            <input class="search-input" placeholder="Search by name or email" v-model="q" />
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <div v-if="authLoading" class="loading-note">Authenticating user 176…</div>
        <div v-else-if="authError" class="loading-note danger">
          Authentication failed: {{ authError }}<br />
          Please check VITE_USER176_EMAIL / VITE_USER176_PASSWORD or user 176 record fields.
        </div>

        <template v-else>
          <table v-if="ready">
            <thead>
            <tr>
              <th style="min-width:220px">Employee</th>
              <th>Time In</th>
              <th>Lunch Start</th>
              <th>Lunch End</th>
              <th>Break Start</th>
              <th>Break End</th>
              <th>Time Out</th>
              <th style="width:260px">Actions</th>
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

              <td><input type="time" step="60" v-model="edit[row.user_id].time_in" /></td>
              <td><input type="time" step="60" v-model="edit[row.user_id].lunch_start" /></td>
              <td><input type="time" step="60" v-model="edit[row.user_id].lunch_end" /></td>
              <td><input type="time" step="60" v-model="edit[row.user_id].break_start" /></td>
              <td><input type="time" step="60" v-model="edit[row.user_id].break_end" /></td>
              <td><input type="time" step="60" v-model="edit[row.user_id].time_out" /></td>

              <td class="actions">
                <button class="btn btn-save" @click="saveRow(row)" :disabled="saving[row.user_id]">
                  {{ saving[row.user_id] ? "Saving..." : (row.log_id ? "Save" : "Create") }}
                </button>
                <button class="btn btn-ghost" @click="resetRow(row)" :disabled="saving[row.user_id]">
                  Cancel
                </button>
                <button
                    v-if="!row.log_id"
                    class="btn btn-add"
                    @click="createRow(row)"
                    :disabled="saving[row.user_id]"
                >
                  Add Log
                </button>
              </td>
            </tr>

            <tr v-if="displayRows.length === 0">
              <td colspan="8">No employees match the selected filters.</td>
            </tr>
            </tbody>
          </table>

          <div v-else class="loading-note">Loading attendance…</div>

          <div class="bulk-actions no-print" v-if="ready">
            <button class="btn btn-save" @click="saveAll" :disabled="bulkSaving">
              {{ bulkSaving ? "Saving..." : "Save All Changes" }}
            </button>
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
  api,
  fetchUsers,
  fetchDepartments,
  fetchAttendance,
  updateAttendanceLog,
  createAttendanceLog,
} from "../../services/api";
import { ensureAuthUser176 } from "../../services/auth";

/* ===== Auth gate ===== */
const authLoading = ref(true);
const authError = ref("");

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

/* ===== State ===== */
const users = ref([]);
const departments = ref([]);
const attendance = ref([]);

const nowTime = ref(dayjs().format("h:mm:ss A"));
let _nowTimer;

const selectedDate = ref(dayjs().format("YYYY-MM-DD"));
const deptFilter = ref(0);
const q = ref("");

const ready = ref(false);
const saving = ref({});
const bulkSaving = ref(false);

const headerDateStr = computed(
    () => `${dayjs(selectedDate.value).format("dddd")} - ${dayjs(selectedDate.value).format("MMM D, YYYY")}`
);

const userById = computed(() => new Map(users.value.map((u) => [u.user_id, u])));
const departmentById = computed(() => new Map(departments.value.map((d) => [d.department_id, d])));

const rowsForActiveDate = computed(() =>
    attendance.value.filter((a) => a.log_date === selectedDate.value)
);

const combinedRows = computed(() => {
  const presentMap = new Map(rowsForActiveDate.value.map((r) => [r.user_id, r]));
  return users.value.map((u) => {
    const row = presentMap.get(u.user_id) || null;
    const dept = departmentById.value.get(u.user_department) || {};
    return {
      key: `row-${u.user_id}`,
      user_id: u.user_id,
      empName: `${u.user_fname || ""} ${u.user_lname || ""}`.trim(),
      deptName: dept.department_name || "",
      log_id: row?.log_id ?? row?.id ?? null,
      time_in: row?.time_in ?? null,
      lunch_start: row?.lunch_start ?? null,
      lunch_end: row?.lunch_end ?? null,
      break_start: row?.break_start ?? null,
      break_end: row?.break_end ?? null,
      time_out: row?.time_out ?? null,
    };
  });
});

const edit = ref({});

function initEditState() {
  const obj = {};
  for (const r of combinedRows.value) {
    obj[r.user_id] = {
      time_in: normalizeToHHMM(r.time_in),
      lunch_start: normalizeToHHMM(r.lunch_start),
      lunch_end: normalizeToHHMM(r.lunch_end),
      break_start: normalizeToHHMM(r.break_start),
      break_end: normalizeToHHMM(r.break_end),
      time_out: normalizeToHHMM(r.time_out),
    };
  }
  edit.value = obj;
  ready.value = true;
}
function resetRow(row) {
  edit.value[row.user_id] = {
    time_in: normalizeToHHMM(row.time_in),
    lunch_start: normalizeToHHMM(row.lunch_start),
    lunch_end: normalizeToHHMM(row.lunch_end),
    break_start: normalizeToHHMM(row.break_start),
    break_end: normalizeToHHMM(row.break_end),
    time_out: normalizeToHHMM(row.time_out),
  };
}
function getDeptIdForUser(userId) {
  const u = userById.value.get(userId);
  return u?.user_department ?? null;
}

const displayRows = computed(() => {
  let rows = combinedRows.value;
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

async function reloadAttendanceOnly() {
  attendance.value = await fetchAttendance();
}
async function saveRow(row) {
  saving.value[row.user_id] = true;
  try {
    const deptId = getDeptIdForUser(row.user_id);
    if (deptId == null) {
      alert(`Cannot save: user ${row.user_id} has no department_id.`);
      return;
    }

    const payload = {
      log_date: selectedDate.value,
      user_id: row.user_id,
      department_id: deptId,
      time_in: toSaveDateTime(selectedDate.value, edit.value[row.user_id].time_in),
      lunch_start: toSaveDateTime(selectedDate.value, edit.value[row.user_id].lunch_start),
      lunch_end: toSaveDateTime(selectedDate.value, edit.value[row.user_id].lunch_end),
      break_start: toSaveDateTime(selectedDate.value, edit.value[row.user_id].break_start),
      break_end: toSaveDateTime(selectedDate.value, edit.value[row.user_id].break_end),
      time_out: toSaveDateTime(selectedDate.value, edit.value[row.user_id].time_out),
    };

    if (row.log_id) {
      await updateAttendanceLog(row.log_id, payload);
    } else {
      const created = await createAttendanceLog(payload);
      row.log_id = created?.log_id ?? created?.id ?? row.log_id;
    }

    await reloadAttendanceOnly();
    initEditState();
  } catch (e) {
    console.error("Save failed:", e?.response?.data ?? e);
    alert(
        "Save failed:\n" +
        JSON.stringify(e?.response?.data ?? { message: e.message }, null, 2)
    );
  } finally {
    saving.value[row.user_id] = false;
  }
}
async function createRow(row) { return saveRow(row); }
async function saveAll() {
  bulkSaving.value = true;
  try { for (const row of displayRows.value) await saveRow(row); }
  finally { bulkSaving.value = false; }
}

/* ===== Boot ===== */
async function loadAll() {
  const [u, d, a] = await Promise.all([fetchUsers(), fetchDepartments(), fetchAttendance()]);
  users.value = u; departments.value = d; attendance.value = a;
}

onMounted(async () => {
  try {
    authLoading.value = true;
    authError.value = "";
    await ensureAuthUser176();            // <<— Authenticate first
    await loadAll();                      // then load secured resources
    initEditState();
    _nowTimer = setInterval(() => {
      nowTime.value = dayjs().format("h:mm:ss A");
    }, 1000);
  } catch (e) {
    console.error(e);
    authError.value = e?.message || "Unknown error";
  } finally {
    authLoading.value = false;
  }
});

onUnmounted(() => { if (_nowTimer) clearInterval(_nowTimer); });
watch([selectedDate, attendance, users], () => { ready.value = false; initEditState(); });
</script>

<style scoped>
/* (same “jake-UI” styles as before) */
.header-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.title{font-size:22px;font-weight:800;margin:0}
.now-badge{display:inline-flex;flex-direction:column;align-items:flex-end;padding:10px 14px;border-radius:12px;background:#f3f4f6;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.now-badge .time{font-weight:900;font-size:28px;line-height:1.1}
.now-badge .date{font-size:14px;color:#4b5563;margin-top:2px}
.toolbar{display:grid;gap:14px;margin-bottom:10px}
.field label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}
select,.search-input,input[type="text"],input[type="search"],input[type="date"],input[type="time"]{width:100%;height:42px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px;outline:none;font-size:14px}
.search-line{display:flex;align-items:center;gap:10px}
.table-wrap{margin-top:10px;overflow-x:auto}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{text-align:left;font-size:12px;color:#667085;font-weight:600;padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
tbody td{padding:12px;border-bottom:1px solid #f0f2f5;font-size:14px}
tbody tr:hover{background:#fafcff}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{height:34px;padding:0 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid transparent;cursor:pointer}
.btn-save{background:#065f46;color:#fff}
.btn-ghost{background:#fff;color:#374151;border-color:#e5e7eb}
.btn-add{background:#2563eb;color:#fff}
.bulk-actions{margin-top:12px;display:flex;justify-content:flex-end}
.emp .name{font-weight:600;line-height:1.2}
.emp .dept{font-size:12px;color:#667085;line-height:1.2}
.loading-note{padding:12px;color:#6b7280}
.loading-note.danger{color:#b42318;background:#fef3f2;border:1px solid #fee2e2;border-radius:10px}
</style>
