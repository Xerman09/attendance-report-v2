import axios from "axios";
import dayjs from "dayjs";

// Accessing environment variables
const BASE_URL = "/api";
const STATIC_TOKEN = import.meta?.env?.VITE_STATIC_TOKEN || "";

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
  // If user_schedule is missing or forbidden, we simply return an empty array 
  // to prevent the unsuppressable 403 console errors.
  return [];
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

export const fetchOvertimeRequestsByEmployeeRange = async (employeeId, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[user_id][_eq]", String(employeeId));
  params.set("filter[request_date][_between]", `${dateFrom},${dateTo}`);

  const { data } = await api.get(`/items/overtime_request?${params.toString()}`);
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
  try {
    const { data } = await api.get("/items/oncall_list?limit=-1");
    return data?.data ?? [];
  } catch (err) {
    console.warn("fetchOnCallList failed:", err?.message || err);
    return [];
  }
};

export const fetchOnCallSchedules = async () => {
  try {
    const { data } = await api.get("/items/oncall_schedule?limit=-1");
    return data?.data ?? [];
  } catch (err) {
    console.warn("fetchOnCallSchedules failed:", err?.message || err);
    return [];
  }
};

export const fetchLeaveRequests = async () => {
  const { data } = await api.get("/items/leave_request?limit=-1");
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

export const fetchGeneralSettings = async () => {
  try {
    const { data } = await api.get("/items/general_setting?limit=-1");
    return data?.data ?? [];
  } catch (err) {
    console.warn("fetchGeneralSettings failed:", err?.message || err);
    return [];
  }
};

export const fetchGeneralSettingByKey = async (key) => {
  try {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("filter[setting_key][_eq]", String(key));
    const { data } = await api.get(`/items/general_setting?${params.toString()}`);
    return data?.data?.[0] ?? null;
  } catch (err) {
    console.warn(`fetchGeneralSettingByKey failed for ${key}:`, err?.message || err);
    return null;
  }
};

export const getGeneralSettingValue = async (key, defaultValue = "0") => {
  try {
    const setting = await fetchGeneralSettingByKey(key);
    if (!setting || setting.setting_value == null) {
      return defaultValue;
    }
    return String(setting.setting_value).trim();
  } catch {
    return defaultValue;
  }
};

/**
 * Value Parsing Helper (MySQL / Directus Resilient)
 * Handles boolean, number, string, and raw Directus buffer shapes.
 */
export function isFlexibleScheduleUser(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (val === "1" || val === "true") return true;
  if (val && typeof val === "object") {
    const buf = val;
    if (buf.type === "Buffer" && Array.isArray(buf.data)) {
      return buf.data[0] === 1;
    }
  }
  return false;
}

/**
 * Fetch configurable missing time-out undertime penalty from general_setting
 * Default is 240 minutes if missing, null, or empty.
 */
export const fetchNoTimeOutUndertimePenalty = async () => {
  try {
    const setting = await fetchGeneralSettingByKey("payroll_no_time_out_undertime_amount");
    if (
      setting &&
      setting.setting_value !== undefined &&
      setting.setting_value !== null &&
      String(setting.setting_value).trim() !== ""
    ) {
      const parsed = Number(setting.setting_value);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 240;
  } catch (err) {
    console.warn("fetchNoTimeOutUndertimePenalty failed:", err?.message || err);
    return 240;
  }
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
 * RULES & SPECIFICATION:
 * 1. Flexible Schedule Exemption:
 *    - Employees with is_flexible_schedule === 1 are NOT penalized for lateness when
 *      their working hours follow a standard Department Schedule (source !== "oncall").
 *    - late_minutes = 0, status resolves to "On Time".
 *    - On-Call schedules (source === "oncall") are NOT exempt from lateness.
 * 2. Configurable Missing Time-Out Undertime Penalty & Balancing:
 *    - Actual undertime: schedEnd - actualOut if actualOut < schedEnd.
 *    - Missing time-out penalty: configured via payroll_no_time_out_undertime_amount (default 240).
 *    - 480-minute cap balancing rule: if (late + penalty > 480) undertime = max(0, 480 - late) else penalty.
 * 3. Overtime: Excess out if approved OT request exists.
 */
export const computeApprovalMinutes = (
  dateYmd,
  logRow,
  scheduleRow,
  otReq,
  userOrOptions,
  penaltyOpt
) => {
  let userRow = null;
  let noTimeOutPenalty = 240;

  if (typeof userOrOptions === "number") {
    noTimeOutPenalty = userOrOptions;
  } else if (userOrOptions && typeof userOrOptions === "object") {
    if ("user_id" in userOrOptions || "is_flexible_schedule" in userOrOptions) {
      userRow = userOrOptions;
    } else if ("user" in userOrOptions) {
      userRow = userOrOptions.user;
    }
    if (typeof userOrOptions.noTimeOutPenalty === "number") {
      noTimeOutPenalty = userOrOptions.noTimeOutPenalty;
    } else if (typeof userOrOptions.penalty === "number") {
      noTimeOutPenalty = userOrOptions.penalty;
    }
  }

  if (typeof penaltyOpt === "number") {
    noTimeOutPenalty = penaltyOpt;
  }

  if (!userRow) {
    userRow = logRow?.user || logRow?.rawUser || scheduleRow?.user || null;
  }

  const sch = scheduleRow || {};
  const workStartStr = normalizeTimeHHmm(sch.work_start || sch.time_in) || "08:00";
  const workEndStr = normalizeTimeHHmm(sch.work_end || sch.time_out) || "17:00";

  const GRACE_MINUTES = sch.grace_period != null ? Number(sch.grace_period) : 5;
  const FULL_DAY_MINUTES = 480;

  const timeIn = parseDT(logRow?.time_in);
  const timeOut = parseDT(logRow?.time_out);

  // 1. ABSENT GUARD: If no time in, everything is 0
  if (!timeIn) {
    return {
      work_minutes: 0,
      late_minutes: 0,
      undertime_minutes: 0,
      overtime_minutes: 0,
      status: "Absent",
      isExemptFromLate: false,
    };
  }

  // Schedule source: "oncall" vs "department"
  const schedSource = sch.source || (sch.is_oncall ? "oncall" : "department");
  const isFlexible = isFlexibleScheduleUser(userRow?.is_flexible_schedule ?? sch.is_flexible_schedule);
  const isExemptFromLate = isFlexible && schedSource === "department";

  // 2. WORK MINUTES: Default to 480 since they have a Time In
  let work = FULL_DAY_MINUTES;

  const workStart = dayjs(`${dateYmd} ${workStartStr}`);
  const workEnd = dayjs(`${dateYmd} ${workEndStr}`);
  const gracePoint = workStart.add(GRACE_MINUTES, "minute");

  // 3. LATE CALCULATION
  let late = 0;
  if (timeIn.isAfter(workEnd)) {
    // Clocked in past scheduled time-out:
    // If exempt, late is 0; otherwise capped to 240 (half day)
    late = isExemptFromLate ? 0 : 240;
  } else {
    // Normal clock-in calculation:
    const diffInMs = timeIn.diff(workStart, "minute");
    if (!isExemptFromLate && diffInMs > GRACE_MINUTES) {
      late = diffInMs;
    } else {
      late = 0;
    }
  }

  // 4. UNDERTIME CALCULATION
  let undertime = 0;
  if (timeOut) {
    // Normal undertime if left early
    if (timeOut.isBefore(workEnd)) {
      undertime = workEnd.diff(timeOut, "minute");
    } else {
      undertime = 0;
    }
  } else {
    // MISSING TIME OUT: Apply setting-based penalty with 480-minute cap
    if (late + noTimeOutPenalty > 480) {
      undertime = Math.max(0, 480 - late);
    } else {
      undertime = noTimeOutPenalty;
    }
  }

  // 5. OVERTIME CALCULATION
  let overtime = 0;
  const isOtApproved = otReq && String(otReq.status || '').toLowerCase() === 'approved';
  if (timeOut && timeOut.isAfter(workEnd) && isOtApproved) {
    const excessOut = timeOut.diff(workEnd, "minute");
    let otDurationCap = Infinity;

    // Check if otReq specifies duration or start/end times
    const reqDuration = Number(otReq.duration_minutes ?? otReq.duration ?? 0);
    if (reqDuration > 0) {
      otDurationCap = reqDuration;
    } else if (otReq.from && otReq.to) {
      const otStart = dayjs(`${dateYmd} ${otReq.from}`);
      const otEnd = dayjs(`${dateYmd} ${otReq.to}`);
      if (otStart.isValid() && otEnd.isValid() && otEnd.isAfter(otStart)) {
        otDurationCap = otEnd.diff(otStart, "minute");
      }
    } else if (otReq.start_time && otReq.end_time) {
      const otStart = dayjs(otReq.start_time);
      const otEnd = dayjs(otReq.end_time);
      if (otStart.isValid() && otEnd.isValid() && otEnd.isAfter(otStart)) {
        otDurationCap = otEnd.diff(otStart, "minute");
      }
    }

    overtime = Math.min(excessOut, otDurationCap);
  }

  // 6. STATUS RESOLUTION
  let computedStatus = logRow?.remarks || logRow?.status || (timeIn ? "On Time" : "Absent");
  if (isExemptFromLate && computedStatus === "Late" && !logRow?.remarks) {
    computedStatus = "On Time";
  } else if (!isExemptFromLate && late > 0 && computedStatus === "On Time") {
    computedStatus = "Late";
  }

  return {
    work_minutes: clampNonNegInt(work),
    late_minutes: clampNonNegInt(late),
    undertime_minutes: clampNonNegInt(undertime),
    overtime_minutes: clampNonNegInt(overtime),
    status: computedStatus,
    isExemptFromLate,
  };
};