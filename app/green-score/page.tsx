"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import OnboardingStepper from "@/components/OnboardingStepper";
import GreenScoreGauge from "@/components/GreenScoreGauge";

export default function GreenScorePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (user.greenScore) {
      router.push("/");
    }
  }, [user, router]);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/api/green-score", {});
      setScore(res.score || 600);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 940, margin: "8px auto", display: "grid", gap: 14 }}>
      <OnboardingStepper currentStep={4} />
      <section className="surface-card" style={{ padding: 30, textAlign: "center" }}>
        <h2 style={{ color: "var(--ink-secondary)", marginTop: 0, marginBottom: 4 }}>🌱 Your Green Credit Score</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 0 }}>
          Your .greeniFy+ score increases as you take green actions and shop sustainably.
        </p>

        {score !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 16 }}>
            <GreenScoreGauge score={score} size={220} label=".greeniFy+" />

            <div
              style={{
                background: "var(--accent-muted)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 16,
                textAlign: "left",
                maxWidth: 430,
                width: "100%",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.55 }}>
                <strong>How your score grows:</strong>
                <br />
                <span style={{ color: "var(--accent)" }}>✦</span> Base score: 600
                <br />
                <span style={{ color: "var(--accent)" }}>✦</span> +50 for KYC verification
                <br />
                <span style={{ color: "var(--accent)" }}>✦</span> +50 for fraud clearance
                <br />
                <span style={{ color: "var(--accent)" }}>✦</span> +5 per green action claim (up to +150)
                <br />
                <span style={{ color: "var(--accent)" }}>✦</span> +3 per marketplace purchase (up to +100)
              </div>
            </div>

            <button onClick={() => router.push("/")} className="primary-btn" style={{ marginTop: 4 }}>
              Go to Dashboard →
            </button>
          </div>
        ) : (
          <button onClick={calculate} disabled={loading} className="primary-btn" style={{ marginTop: 12 }}>
            {loading ? "Calculating..." : "Calculate My Green Score"}
          </button>
        )}
      </section>
    </div>
  );
}
