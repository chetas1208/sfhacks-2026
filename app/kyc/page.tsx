"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function KycPage() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ verified?: boolean } | null>(null);

    const [form, setForm] = useState({
        firstName: "", lastName: "", ssn: "1234", dob: "1995-06-15",
        address: "123 Green St", city: "San Francisco", state: "CA", zip: "94102", phone: "4151234567",
    });

    useEffect(() => {
        if (!user) { router.push("/auth"); return; }
        if (user.kycComplete) { router.push("/fraud"); return; }
        setForm(f => ({ ...f, firstName: user.name.split(" ")[0] || "", lastName: user.name.split(" ").slice(1).join(" ") || "" }));
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiPost("/api/kyc", form);
            setResult(res);
            await refreshUser();
            setTimeout(() => router.push("/fraud"), 2000);
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
                            background: i <= 1 ? "#059669" : "#e5e7eb", color: i <= 1 ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 11, color: i <= 1 ? "#059669" : "#9ca3af" }}>{s}</span>
                        {i < steps.length - 1 && <div style={{ width: 16, height: 2, background: i < 1 ? "#059669" : "#e5e7eb" }} />}
                    </div>
                ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
                <h2 style={{ color: "#065f46", marginTop: 0 }}>🔐 Identity Verification (KYC)</h2>
                <p style={{ color: "#6b7280", fontSize: 14 }}>Powered by CRS FlexID — LexisNexis verification</p>

                {result?.verified ? (
                    <div style={{ textAlign: "center", padding: 24 }}>
                        <div style={{ fontSize: 48 }}>✅</div>
                        <h3 style={{ color: "#059669" }}>Identity Verified!</h3>
                        <p style={{ color: "#6b7280" }}>Redirecting to fraud check...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {Object.entries(form).map(([key, val]) => (
                                <div key={key}>
                                    <label style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</label>
                                    <input value={val} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box", marginTop: 2 }} />
                                </div>
                            ))}
                        </div>
                        <button type="submit" disabled={loading} style={{
                            width: "100%", marginTop: 20, padding: 12, borderRadius: 8, border: "none", cursor: "pointer",
                            background: loading ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, fontSize: 15,
                        }}>{loading ? "Verifying..." : "Verify Identity"}</button>
                    </form>
                )}
            </div>
        </div>
    );
}
