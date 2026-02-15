"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import OnboardingStepper from "@/components/OnboardingStepper";

export default function GreenScorePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<{
    greenScore?: number;
    creditScore?: number;
    rating?: string;
    formula?: string;
  } | null>(null);
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (user.greenScore) {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!score?.greenScore) return;
    const target = Math.min((score.greenScore / 850) * 100, 100);
    let cur = 0;
    const iv = setInterval(() => {
      cur += 2;
      if (cur >= target) {
        cur = target;
        clearInterval(iv);
      }
      setAnimPct(cur);
    }, 20);
    return () => clearInterval(iv);
  }, [score]);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/api/green-score", {});
      setScore(res);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const circumference = 2 * Math.PI * 80;
  const offset = circumference - (animPct / 100) * circumference;

  return (
    <div style={{ maxWidth: 940, margin: "8px auto", display: "grid", gap: 14 }}>
      <OnboardingStepper currentStep={4} />
      <section className="surface-card" style={{ padding: 30, textAlign: "center" }}>
        <h2 style={{ color: "#065f46", marginTop: 0, marginBottom: 4 }}>🌱 Your Green Credit Score</h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
          Calculated from CRS credit data + environmental factors
        </p>

        {score ? (
          <div>
            <svg width="220" height="220" viewBox="0 0 200 200" style={{ margin: "20px auto", display: "block" }}>
              <circle cx="100" cy="100" r="80" fill="none" stroke="#deebea" strokeWidth="12" />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#059669"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ transition: "stroke-dashoffset 0.3s ease" }}
              />
              <text x="100" y="92" textAnchor="middle" fontSize="36" fontWeight="700" fill="#065f46">
                {score.greenScore}
              </text>
              <text x="100" y="116" textAnchor="middle" fontSize="14" fill="#059669">
                {score.rating}
              </text>
            </svg>

            <div
              style={{
                background: "linear-gradient(145deg, rgba(15,157,139,0.12), rgba(90,184,255,0.1))",
                border: "1px solid rgba(9,76,64,0.14)",
                borderRadius: 14,
                padding: 16,
                margin: "16px auto 0",
                textAlign: "left",
                maxWidth: 430,
              }}
            >
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
                <strong>Formula:</strong> {score.formula}
                <br />
                <strong>Credit Score:</strong> {score.creditScore}
                <br />
                <strong>Environmental Bonus:</strong> 500 (starting)
              </div>
            </div>

            <button onClick={() => router.push("/")} className="primary-btn" style={{ marginTop: 16 }}>
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
