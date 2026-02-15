"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import OnboardingStepper from "@/components/OnboardingStepper";

export default function FraudPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status?: string; riskScore?: number } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (user.fraudClear) {
      router.push("/green-score");
    }
  }, [user, router]);

  const runCheck = async () => {
    setLoading(true);
    try {
      const payload = {
        deviceId: "browser-" + Math.random().toString(36).substring(7),
        ip: "127.0.0.1",
      };
      const res = await apiPost("/api/fraud", payload);
      setResult(res);
      await refreshUser();
      setTimeout(() => router.push("/green-score"), 2500);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 940, margin: "8px auto", display: "grid", gap: 14 }}>
      <OnboardingStepper currentStep={3} />
      <section className="surface-card" style={{ padding: 30, textAlign: "center" }}>
        <h2 style={{ color: "var(--ink-secondary)", marginTop: 0, marginBottom: 4 }}>🛡️ Fraud Detection</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 0 }}>CRS Fraud Finder — real-time risk assessment</p>

        {result ? (
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 62 }}>{result.status === "CLEAR" ? "✅" : "⚠️"}</div>
            <h3 style={{ color: result.status === "CLEAR" ? "var(--positive)" : "var(--negative)", marginBottom: 8 }}>
              {result.status === "CLEAR" ? "No Fraud Detected" : "Review Required"}
            </h3>
            <div
              style={{
                background: "var(--accent-muted)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 18,
                marginTop: 12,
                display: "inline-block",
                minWidth: 220,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--positive)", lineHeight: 1 }}>
                {result.riskScore}/100
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Risk Score (lower = better)</div>
            </div>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 16 }}>Redirecting to Green Score...</p>
          </div>
        ) : (
          <button onClick={runCheck} disabled={loading} className="primary-btn" style={{ marginTop: 8 }}>
            {loading ? "Checking..." : "Run Fraud Check"}
          </button>
        )}
      </section>
    </div>
  );
}
