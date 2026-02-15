"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function FraudPage() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ status?: string; riskScore?: number } | null>(null);

    useEffect(() => {
        if (!user) { router.push("/auth"); return; }
        if (user.fraudClear) { router.push("/green-score"); }
    }, [user, router]);

    const runCheck = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/api/fraud");
            setResult(res);
            await refreshUser();
            setTimeout(() => router.push("/green-score"), 2500);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const steps = ["Sign In", "KYC", "Fraud Check", "Green Score", "Dashboard"];

    return (
        <div style={{ maxWidth: 500, margin: "40px auto" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
                {steps.map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: i <= 2 ? "#059669" : "#e5e7eb", color: i <= 2 ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 11, color: i <= 2 ? "#059669" : "#9ca3af" }}>{s}</span>
                        {i < steps.length - 1 && <div style={{ width: 16, height: 2, background: i < 2 ? "#059669" : "#e5e7eb" }} />}
                    </div>
                ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <h2 style={{ color: "#065f46", marginTop: 0 }}>🛡️ Fraud Detection</h2>
                <p style={{ color: "#6b7280", fontSize: 14 }}>CRS Fraud Finder — real-time risk assessment</p>

                {result ? (
                    <div style={{ padding: 20 }}>
                        <div style={{ fontSize: 56 }}>{result.status === "CLEAR" ? "✅" : "⚠️"}</div>
                        <h3 style={{ color: result.status === "CLEAR" ? "#059669" : "#dc2626" }}>
                            {result.status === "CLEAR" ? "No Fraud Detected" : "Review Required"}
                        </h3>
                        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 16, marginTop: 12 }}>
                            <div style={{ fontSize: 32, fontWeight: 700, color: "#059669" }}>{result.riskScore}/100</div>
                            <div style={{ color: "#6b7280", fontSize: 13 }}>Risk Score (lower = better)</div>
                        </div>
                        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 16 }}>Redirecting to Green Score...</p>
                    </div>
                ) : (
                    <button onClick={runCheck} disabled={loading} style={{
                        marginTop: 20, padding: "14px 32px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: loading ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, fontSize: 15,
                    }}>{loading ? "Checking..." : "Run Fraud Check"}</button>
                )}
            </div>
        </div>
    );
}
