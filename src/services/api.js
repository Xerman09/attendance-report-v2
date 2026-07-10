import axios from "axios";
import dayjs from "dayjs";

// Accessing environment variables
const BASE_URL = "/api";
const STATIC_TOKEN = import.meta.env.VITE_STATIC_TOKEN || "";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: STATIC_TOKEN ? { Authorization: `Bearer ${STATIC_TOKEN}` } : {}
});

/* ---------- ASSETS / IMAGES ---------- */

export const getDirectImageUrl = (id) => {
  if (!id || id === "null" || id === "undefined") return null;
  return STATIC_TOKEN 
    ? `${BASE_URL}/assets/${id}?access_token=${STATIC_TOKEN}`
    : `${BASE_URL}/assets/${id}`;
};

/* ---------- READ ---------- */

export const fetchUsers = async () => {
  const { data } = await api.get("/items/user?limit=-1");
  return data?.data ?? [];
};

export const fetchDepartments = async () => {
  const { data } = await api.get("/items/department?limit=-1");
  return data?.data ?? [];
};

/**
 * department_schedule schema uses schedule_id (NOT id) and no grace_minutes column.
 * Grace is fixed at 5 mins in computeApprovalMinutes.
 */
export const fetchSchedules = async () => {
  const params = new URLSearchParams();
  params.set("limit", "-1");

  // only real fields based on your MySQL schema
  params.set(
    "fields",
    [
      "schedule_id",
      "department_id",
      "working_days",
      "work_start",
      "work_end",
      "lunch_start",
      "lunch_end",
      "break_start",
      "break_end",
      "workdays_note",
      "created_at",
      "updated_at",
    ].join(","),
  );

  const { data } = await api.get(`/items/department_schedule?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchUserSchedules = async () => {
  const params = new URLSearchParams();
  params.set("limit", "-1");

  params.set(
    "fields",
    [
      "id",
      "user_id",
      "working_days",
      "work_start",
      "work_end",
      "lunch_start",
      "lunch_end",
      "break_start",
      "break_end",
      "workdays_note",
      "grace_period",
      "created_at",
      "updated_at",
    ].join(","),
  );

  try {
    const { data } = await api.get(`/items/user_schedule?${params.toString()}`, {
      headers: { Authorization: null }
    });
    return data?.data ?? [];
  } catch (err) {
    console.warn("fetchUserSchedules fallback:", err.message);
    return [];
  }
};

export const fetchAttendance = async () => {
  const { data } = await api.get("/items/attendance_log?limit=-1");
  return data?.data ?? [];
};

export const fetchAttendanceByDate = async (ymd) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[log_date][_eq]", ymd);

  const { data } = await api.get(`/items/attendance_log?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchAttendanceByEmployeeRange = async (userId, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[user_id][_eq]", String(userId));
  params.set("filter[log_date][_between]", `${dateFrom},${dateTo}`);
  params.set("sort", "-log_date");

  const { data } = await api.get(`/items/attendance_log?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchAttendanceApprovalsByEmployeeRange = async (employeeId, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[employee_id][_eq]", String(employeeId));
  params.set("filter[date_schedule][_between]", `${dateFrom},${dateTo}`);
  params.set("sort", "-date_schedule");

  const { data } = await api.get(`/items/attendance_approval?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchAttendanceApprovalsByEmployeeDay = async (employeeId, ymd) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[employee_id][_eq]", String(employeeId));
  params.set("filter[date_schedule][_eq]", String(ymd));

  const { data } = await api.get(`/items/attendance_approval?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchAttendanceApprovalsByDate = async (ymd, employeeIds = []) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[date_schedule][_eq]", String(ymd));
  params.set("sort", "employee_id");

  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    params.set("filter[employee_id][_in]", employeeIds.map((x) => String(x)).join(","));
  }

  const { data } = await api.get(`/items/attendance_approval?${params.toString()}`);
  return data?.data ?? [];
};

export const fetchOnCallList = async () => {
  const { data } = await api.get("/items/oncall_list?limit=-1");
  return data?.data ?? [];
};

export const fetchOnCallSchedules = async () => {
  const { data } = await api.get("/items/oncall_schedule?limit=-1");
  return data?.data ?? [];
};

/* ---------- WRITE ---------- */

export const updateAttendanceLog = async (logId, payload) => {
  const { data } = await api.patch(`/items/attendance_log/${logId}`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};

export const createAttendanceLog = async (payload) => {
  const { data } = await api.post(`/items/attendance_log`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};

export const createAttendanceApproval = async (payload) => {
  const { data } = await api.post(`/items/attendance_approval`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};

export const updateAttendanceApproval = async (approvalId, payload) => {
  const { data } = await api.patch(`/items/attendance_approval/${approvalId}`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};

/* ---------- EXTRA ---------- */

export const fetchGeotags = async () => {
  const { data } = await api.get("/items/attendance_log_geotag?limit=-1");
  return data?.data ?? [];
};

/* =========================================================
   HELPERS FOR CUTOFF APPROVAL MODULE
========================================================= */

export function computeCutoffRange(yyyyMm, cutoff) {
  const anchor = dayjs(`${yyyyMm}-01`);
  if (!anchor.isValid()) {
    const now = dayjs();
    return { from: now.format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };
  }

  // NEW: 11 - 25 (within the same selected month)
  if (cutoff === "11-25") {
    const from = anchor.date(11);
    const to = anchor.date(25);
    return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
  }

  // 26 - 10 (previous month 26 to current month 10)
  const prev = anchor.subtract(1, "month");
  const from = prev.date(26);
  const to = anchor.date(10);
  return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
}

function clampNonNegInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeTimeHHmm(t) {
  if (!t) return null;
  const s = String(t);
  const parts = s.split(":");
  if (parts.length >= 2) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  return null;
}

function parseDT(x) {
  if (!x) return null;
  const d = dayjs(x);
  return d.isValid() ? d : null;
}

/**
 * RULES:
 * - grace = 5 mins
 * - default work = 8 hrs (480)
 * - if time_out missing and has time_in => 4 hrs (240)
 * - overtime ALWAYS 0
 *
 * Late = max(0, time_in - (work_start+5m))
 * Undertime = if time_out exists and < work_end => work_end - time_out else 0
 */
export const computeApprovalMinutes = (dateYmd, logRow, scheduleRow) => {
  const sch = scheduleRow || {};
  const workStartStr = normalizeTimeHHmm(sch.work_start) || "08:00";
  const workEndStr = normalizeTimeHHmm(sch.work_end) || "17:00";

  const GRACE_MINUTES = sch.grace_period != null ? Number(sch.grace_period) : 5;
  const FULL_DAY_MINUTES = 480;
  const HALF_DAY_MINUTES = 240;

  const timeIn = parseDT(logRow?.time_in);
  const timeOut = parseDT(logRow?.time_out);

  const workStart = dayjs(`${dateYmd} ${workStartStr}`);
  const workEnd = dayjs(`${dateYmd} ${workEndStr}`);
  const gracePoint = workStart.add(GRACE_MINUTES, "minute");

  // 1. ABSENT GUARD: If no time in, everything is 0
  if (!timeIn) {
    return {
      work_minutes: 0,
      late_minutes: 0,
      undertime_minutes: 0,
      overtime_minutes: 0,
    };
  }

  // 2. WORK MINUTES: Default to 480 since they have a Time In
  let work = FULL_DAY_MINUTES;

  // 3. LATE CALCULATION
  let late = 0;
  if (timeIn.isAfter(gracePoint)) {
    late = timeIn.diff(workStart, "minute");
  }

  // 4. UNDERTIME CALCULATION
  let undertime = 0;
  if (!timeOut) {
    // No timeout = Automatic 240 mins undertime
    undertime = HALF_DAY_MINUTES;
  } else if (timeOut.isBefore(workEnd)) {
    // Early out = difference from scheduled end
    undertime = workEnd.diff(timeOut, "minute");
  }

  return {
    work_minutes: clampNonNegInt(work), // Always 480
    late_minutes: clampNonNegInt(late),
    undertime_minutes: clampNonNegInt(undertime),
    overtime_minutes: 0,
  };
};