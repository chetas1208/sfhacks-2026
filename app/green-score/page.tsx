"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function GreenScorePage() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [score, setScore] = useState<{ greenScore?: number; creditScore?: number; rating?: string; formula?: string } | null>(null);
    const [animPct, setAnimPct] = useState(0);

    useEffect(() => {
        if (!user) { router.push("/auth"); return; }
        if (user.greenScore) { router.push("/"); }
    }, [user, router]);

    useEffect(() => {
        if (score?.greenScore) {
            const target = Math.min((score.greenScore / 850) * 100, 100);
            let cur = 0;
            const iv = setInterval(() => { cur += 2; if (cur >= target) { cur = target; clearInterval(iv); } setAnimPct(cur); }, 20);
            return () => clearInterval(iv);
        }
    }, [score]);

    const calculate = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/api/green-score");
            setScore(res);
            await refreshUser();
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const steps = ["Sign In", "KYC", "Fraud Check", "Green Score", "Dashboard"];
    const circumference = 2 * Math.PI * 80;
    const offset = circumference - (animPct / 100) * circumference;

    return (
        <div style={{ maxWidth: 500, margin: "40px auto" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
                {steps.map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: i <= 3 ? "#059669" : "#e5e7eb", color: i <= 3 ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 11, color: i <= 3 ? "#059669" : "#9ca3af" }}>{s}</span>
                        {i < steps.length - 1 && <div style={{ width: 16, height: 2, background: i < 3 ? "#059669" : "#e5e7eb" }} />}
                    </div>
                ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <h2 style={{ color: "#065f46", marginTop: 0 }}>🌱 Your Green Credit Score</h2>
                <p style={{ color: "#6b7280", fontSize: 14 }}>Calculated from CRS credit data + environmental factors</p>

                {score ? (
                    <div>
                        <svg width="200" height="200" viewBox="0 0 200 200" style={{ margin: "20px auto", display: "block" }}>
                            <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                            <circle cx="100" cy="100" r="80" fill="none" stroke="#059669" strokeWidth="12"
                                strokeDasharray={circumference} strokeDashoffset={offset}
                                strokeLinecap="round" transform="rotate(-90 100 100)"
                                style={{ transition: "stroke-dashoffset 0.3s ease" }} />
                            <text x="100" y="92" textAnchor="middle" fontSize="36" fontWeight="700" fill="#065f46">{score.greenScore}</text>
                            <text x="100" y="116" textAnchor="middle" fontSize="14" fill="#059669">{score.rating}</text>
                        </svg>

                        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 16, margin: "16px 0", textAlign: "left" }}>
                            <div style={{ fontSize: 13, color: "#374151" }}>
                                <strong>Formula:</strong> {score.formula}<br />
                                <strong>Credit Score:</strong> {score.creditScore}<br />
                                <strong>Environmental Bonus:</strong> 500 (starting)
                            </div>
                        </div>

                        <button onClick={() => router.push("/")} style={{
                            marginTop: 12, padding: "14px 32px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: "#059669", color: "#fff", fontWeight: 600, fontSize: 15,
                        }}>Go to Dashboard →</button>
                    </div>
                ) : (
                    <button onClick={calculate} disabled={loading} style={{
                        marginTop: 20, padding: "14px 32px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: loading ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, fontSize: 15,
                    }}>{loading ? "Calculating..." : "Calculate My Green Score"}</button>
                )}
            </div>
        </div>
    );
}
