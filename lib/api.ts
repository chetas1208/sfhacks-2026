/**
 * API helper — all /api/* calls go through Next.js proxy (no CORS).
 */

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("gecb_token");
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export async function apiGet(path: string) {
    const res = await fetch(path, { headers: authHeaders() });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
}

export async function apiPost(path: string, body?: unknown) {
    const res = await fetch(path, { method: "POST", headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `POST ${path} failed: ${res.status}`);
    }
    return res.json();
}

export async function apiUpload(path: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { method: "POST", headers, body: fd });
    return res.json();
}
