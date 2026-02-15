"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
    id: number; email: string; name: string; role: string;
    kycComplete: boolean; fraudClear: boolean; greenScore: number | null;
}

interface AuthCtx {
    user: User | null; loading: boolean;
    login: (email: string, password: string) => Promise<any>;
    signup: (name: string, email: string, password: string) => Promise<any>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
    user: null, loading: true,
    login: async () => { }, signup: async () => { }, logout: () => { }, refreshUser: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem("gecb_user");
        if (saved) { try { setUser(JSON.parse(saved)); } catch { } }
        setLoading(false);
    }, []);

    const saveSession = (u: User, token: string) => {
        setUser(u);
        localStorage.setItem("gecb_user", JSON.stringify(u));
        localStorage.setItem("gecb_token", token);
    };

    const login = async (email: string, password: string) => {
        const res = await fetch("/api/auth/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || "Login failed"); }
        const data = await res.json();
        saveSession(data.user, data.token);
        return data;
    };

    const signup = async (name: string, email: string, password: string) => {
        const res = await fetch("/api/auth/signup", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || "Signup failed"); }
        const data = await res.json();
        saveSession(data.user, data.token);
        return data;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("gecb_user"); localStorage.removeItem("gecb_token");
        window.location.href = "/auth";
    };

    const refreshUser = async () => {
        const token = localStorage.getItem("gecb_token");
        if (!token) return;
        try {
            const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const u = await res.json();
                const updated = {
                    id: u._id, email: u.email, name: u.name, role: u.role,
                    kycComplete: u.kycComplete, fraudClear: u.fraudClear, greenScore: u.greenScore
                };
                setUser(updated);
                localStorage.setItem("gecb_user", JSON.stringify(updated));
            }
        } catch { }
    };

    return <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
