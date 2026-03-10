import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import EmployeeReports from "./views/attendanceReport/EmployeeReports.vue";
import TodaysAttendance from "./views/attendanceReport/TodaysAttendance.vue";
import EmployeeDetail from "./views/attendanceReport/EmployeeAttendanceHistory.vue";
import DepartmentReports from "./views/attendanceReport/DepartmentReports.vue";
import SummaryReports from "./views/attendanceReport/SummaryReports.vue";
import ManageAttendance from "./views/attendanceReport/ManageAttendance.vue";
import EditAttendanceLog from "./views/attendanceReport/EditAttendanceLog.vue";
import EidtEmployeeAttendance from "./views/attendanceReport/EditEmployeeAttendance.vue";

import ManageApprovedAttendanceEmployee from "./views/approval/AttendanceApprovalEmployee.vue";
import ManageApprovedAttendanceDaily from "./views/approval/AttendanceApprovalDaily.vue";
import ManegeAttendanceCutoffApprovalModule from "./views/approval/AttendanceCutoffApprovalModule.vue";

import Employees from "./views/wageManagement/Employees.vue";
import "./styles.css";
const routes = [
  { path: "/", redirect: { name: "todays-attendance" } },
  {
    path: "/attendance-report/todays-attendance",
    component: TodaysAttendance,
    name: "todays-attendance",
    meta: { title: "Todays Attendance" },
  },
  {
    path: "/attendance-report/employee-reports",
    component: EmployeeReports,
    name: "employee-reports",
    meta: { title: "EmployeeReports" },
  },
  {
    path: "/attendance-report/employee/:id",
    component: EmployeeDetail,
    name: "employee"
  },
  {
    path: "/attendance-report/department-reports",
    component: DepartmentReports,
    name: "department-reports",
    meta: { title: "Department Reports" },
  },
  {
    path: "/attendance-report/summary-reports",
    component: SummaryReports,
    name: "summary-reports",
    meta: { title: "Summary Reports" },
  },
  {
    path: "/attendance-report/manage-attendance",
    component: ManageAttendance,
    name: "manage-attendance",
    meta: { title: "Managae Attendance" },
  },
  {
    path: "/attendance-report/edit-attendance",
    component: EditAttendanceLog,
    name: "edit-attendance",
    meta: { title: "Edit Attendance" },
  },
  {
    path: "/attendance-report/edit-employee-attendance",
    component: EidtEmployeeAttendance,
    name: "edit-employee-attendance",
    meta: { title: "Edit Employee Attendance" },
  },
  {
    path: "/wage-management/employees",
    component: Employees,
    name: "employees",
    meta: { title: "Employees" },
  },
    {
    path: "/approval/employees",
    component: ManageApprovedAttendanceEmployee,
    name: "manage-approved-attendance-employee",
    meta: { title: "Manage Approved Attendance (Employee)" },
  },
  {
    path: "/approval/cutoff",
    component: ManegeAttendanceCutoffApprovalModule,
    name: "manage-approved-attendance-cutoff",
    meta: { title: "Manage Approved Attendance (Cutoff)" },
  },
  {
    path: "/approval/daily",
    component: ManageApprovedAttendanceDaily,
    name: "manage-approved-attendance-daily",
    meta: { title: "Manage Approved Attendance (Daily)" },
  }
];
const router = createRouter({ history: createWebHistory(), routes });
router.afterEach((to) => {
  document.title = to.meta?.title
    ? `${to.meta.title} — Attendance Report`
    : "Attendance Report";
});
createApp(App).use(router).mount("#app");
