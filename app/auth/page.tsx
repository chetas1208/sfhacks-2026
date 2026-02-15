"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function AuthPage() {
    const [tab, setTab] = useState<"login" | "signup">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login, signup } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            if (tab === "login") {
                await login(email, password);
            } else {
                await signup(name, email, password);
            }
            router.push("/kyc");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally { setLoading(false); }
    };

    const steps = ["Sign In", "KYC", "Fraud Check", "Green Score", "Dashboard"];

    return (
        <div style={{ maxWidth: 440, margin: "40px auto" }}>
            {/* Progress Steps */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
                {steps.map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: i === 0 ? "#059669" : "#e5e7eb", color: i === 0 ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600,
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 11, color: i === 0 ? "#059669" : "#9ca3af" }}>{s}</span>
                        {i < steps.length - 1 && <div style={{ width: 16, height: 2, background: "#e5e7eb" }} />}
                    </div>
                ))}
            </div>

            {/* Card */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
                    <h1 style={{ fontSize: 22, color: "#065f46", margin: 0 }}>Green Energy Credit Bank</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>Earn credits for sustainable actions</p>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                    {(["login", "signup"] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                            background: tab === t ? "#059669" : "#f9fafb", color: tab === t ? "#fff" : "#6b7280",
                        }}>{t === "login" ? "Log In" : "Sign Up"}</button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {tab === "signup" && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Full Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Doe"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
                        </div>
                    )}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="alice@greenbank.io"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Pass123!"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
                    </div>

                    {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}

                    <button type="submit" disabled={loading} style={{
                        width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: loading ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, fontSize: 15,
                    }}>{loading ? "Please wait..." : tab === "login" ? "Log In" : "Create Account"}</button>
                </form>

                <div style={{ marginTop: 16, padding: 12, background: "#f0fdf4", borderRadius: 8, textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#065f46", margin: 0, fontWeight: 500 }}>🔑 Demo: alice@greenbank.io / Pass123!</p>
                </div>
            </div>
        </div>
    );
}
