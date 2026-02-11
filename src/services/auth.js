// src/services/auth.js
import { api } from "./api";

/**
 * "Login" by querying /items/user and comparing plaintext password.
 * - If you want to restrict to user 176 only, set RESTRICT_TO_ID_176=true.
 */
const RESTRICT_TO_ID_176 = false; // set true if only user 176 may login

export async function login(email, password) {
    if (!email || !password) throw new Error("Email and password are required.");

    // If restricted to a single user:
    if (RESTRICT_TO_ID_176) {
        const res = await api.get("/items/user/141?fields=user_id,user_email,user_password,user_fname,user_lname,user_department");
        const u = res?.data?.data;
        if (!u) throw new Error("User 176 not found.");
        if (String(u.user_email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
            throw new Error("Email does not match user 176.");
        }
        if (String(u.user_password) !== String(password)) {
            throw new Error("Invalid password.");
        }
        const currentUser = {
            user_id: u.user_id,
            user_email: u.user_email,
            user_fname: u.user_fname,
            user_lname: u.user_lname,
            user_department: u.user_department,
        };
        localStorage.setItem("CURRENT_USER", JSON.stringify(currentUser));
        return currentUser;
    }

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
