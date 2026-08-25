// src/services/auth.js
import { api } from "./api";

/**
 * "Login" by querying /items/user and comparing plaintext password.
 * - Restricts login to users in a specific department (default: 2, or VITE_DEPARTMENT_ID).
 */
const ALLOWED_DEPARTMENT_ID = import.meta.env.VITE_DEPARTMENT_ID || 2;

export async function login(email, password) {
    if (!email || !password) throw new Error("Email and password are required.");

    // General lookup by email (Directus-style filters)
    const res = await api.get(
        "/items/user",
        {
            params: {
                "filter[user_email][_eq]": email,
                fields: "user_id,user_email,user_password,user_fname,user_lname,user_department",
                limit: 1,
            },
        }
    );

    const user = Array.isArray(res?.data?.data) ? res.data.data[0] : res?.data?.data;
    if (!user) throw new Error("User not found.");
    if (String(user.user_password) !== String(password)) {
        throw new Error("Invalid password.");
    }

    if (String(user.user_department) !== String(ALLOWED_DEPARTMENT_ID)) {
        throw new Error("Access denied: User does not belong to the allowed department.");
    }

    const currentUser = {
        user_id: user.user_id,
        user_email: user.user_email,
        user_fname: user.user_fname,
        user_lname: user.user_lname,
        user_department: user.user_department,
    };
    localStorage.setItem("CURRENT_USER", JSON.stringify(currentUser));
    return currentUser;
}

export function getCurrentUser() {
    const raw = localStorage.getItem("CURRENT_USER");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export function logout() {
    localStorage.removeItem("CURRENT_USER");
}
