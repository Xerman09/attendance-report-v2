// src/services/api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
});

/* ---------- READ ---------- */
export const fetchUsers = async () => {
  const { data } = await api.get("/items/user?limit=-1");
  return data?.data ?? [];
};

export const fetchDepartments = async () => {
  const { data } = await api.get("/items/department?limit=-1");
  return data?.data ?? [];
};

export const fetchSchedules = async () => {
  const { data } = await api.get("/items/department_schedule?limit=-1");
  return data?.data ?? [];
};

export const fetchAttendance = async () => {
  const { data } = await api.get("/items/attendance_log?limit=-1");
  return data?.data ?? [];
};

/**
 * ✅ Only logs for one date (use for Per Day view)
 */
export const fetchAttendanceByDate = async (ymd) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[log_date][_eq]", ymd);

  const { data } = await api.get(`/items/attendance_log?${params.toString()}`);
  return data?.data ?? [];
};

/**
 * ✅ Only logs for one employee + date range (use for Per Employee view)
 */
export const fetchAttendanceByEmployeeRange = async (userId, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[user_id][_eq]", String(userId));
  params.set("filter[log_date][_between]", `${dateFrom},${dateTo}`);
  params.set("sort", "-log_date");

  const { data } = await api.get(`/items/attendance_log?${params.toString()}`);
  return data?.data ?? [];
};

/**
 * ✅ Attendance approvals (minutes) by employee + date range
 */
export const fetchAttendanceApprovalsByEmployeeRange = async (employeeId, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[employee_id][_eq]", String(employeeId));
  params.set("filter[date_schedule][_between]", `${dateFrom},${dateTo}`);
  params.set("sort", "-date_schedule");

  const { data } = await api.get(`/items/attendance_approval?${params.toString()}`);
  return data?.data ?? [];
};

/**
 * ✅ (Optional) approvals by one day (for quick day checks)
 */
export const fetchAttendanceApprovalsByEmployeeDay = async (employeeId, ymd) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[employee_id][_eq]", String(employeeId));
  params.set("filter[date_schedule][_eq]", String(ymd));

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

/**
 * ✅ Create Attendance Approval (minutes)
 * - approved_at is auto default in DB (CURRENT_TIMESTAMP)
 * - status defaults to 'approved' if not passed
 */
export const createAttendanceApproval = async (payload) => {
  const { data } = await api.post(`/items/attendance_approval`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};
/**
 * ✅ Update Attendance Approval (minutes)
 */
export const updateAttendanceApproval = async (approvalId, payload) => {
  const { data } = await api.patch(`/items/attendance_approval/${approvalId}`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return data?.data ?? data;
};
/**
 * ✅ Attendance approvals (minutes) by date (Per Day view)
 * Optionally restrict results to a set of employee ids (recommended).
 */
export const fetchAttendanceApprovalsByDate = async (ymd, employeeIds = []) => {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("filter[date_schedule][_eq]", String(ymd));
  params.set("sort", "employee_id");

  // Optional: reduce payload to only employees you will display (Dept 4 users)
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    params.set("filter[employee_id][_in]", employeeIds.map((x) => String(x)).join(","));
  }

  const { data } = await api.get(`/items/attendance_approval?${params.toString()}`);
  return data?.data ?? [];
};
