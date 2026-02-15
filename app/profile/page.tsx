"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProfileData = {
  balance?: number;
  user?: {
    name?: string;
    email?: string;
    greenScore?: number | null;
    kycComplete?: boolean;
    fraudClear?: boolean;
  };
  transactions?: Array<{
    type?: string;
    amount?: number;
    description?: string;
    memo?: string;
    timestamp?: string;
    date?: string;
  }>;
};

export default function ProfilePage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("gecb_token");
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div style={{ textAlign: "center", color: "#6f8d85", padding: 72 }}>Loading profile...</div>;
  }

  if (!profileData) return null;

  const score = profileData.user?.greenScore ?? null;
  const scoreProgress = score ? Math.min((score / 850) * 100, 100) : 0;
  const txs = profileData.transactions || [];
  const statusPill = (ok: boolean | undefined, okLabel: string, badLabel: string) => (
    <span
      style={{
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 800,
        border: ok ? "1px solid rgba(16,185,129,0.32)" : "1px solid rgba(245,158,11,0.35)",
        background: ok ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
        color: ok ? "#0f8a69" : "#ad7a04",
      }}
    >
      {ok ? okLabel : badLabel}
    </span>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        className="surface-card"
        style={{
          padding: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background:
            "linear-gradient(130deg, rgba(255,255,255,0.88), rgba(227,249,241,0.78), rgba(223,242,255,0.72))",
        }}
      >
        <div>
          <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
            My Profile
          </h1>
          <p className="hero-subtext">
            {profileData.user?.name || "User"} • {profileData.user?.email || "No email found"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/submit" className="ghost-btn" style={{ textDecoration: "none" }}>
            New Claim
          </Link>
          <button
            onClick={logout}
            style={{
              borderRadius: 12,
              padding: "10px 12px",
              border: "1px solid rgba(220,38,38,0.28)",
              background: "rgba(220,38,38,0.08)",
              color: "#b4233f",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Sign Out
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        <article className="surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, color: "#66847c", fontWeight: 700 }}>Total Balance</div>
          <div style={{ fontSize: 34, marginTop: 6, color: "#0f5f4e", fontWeight: 800 }}>
            {profileData.balance || 0}
            <span style={{ fontSize: 15, color: "#6a8880", marginLeft: 6 }}>credits</span>
          </div>
        </article>

        <article className="surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, color: "#66847c", fontWeight: 700, marginBottom: 8 }}>Green Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 34, color: "#0f5f4e", fontWeight: 800 }}>{score ?? "N/A"}</span>
            {score ? <span style={{ color: "#6a8880", fontSize: 12 }}>/ 850</span> : null}
          </div>
          <div style={{ height: 8, marginTop: 10, borderRadius: 999, background: "rgba(13,49,39,0.1)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${scoreProgress}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, #0f9d8b, #2bb673)",
              }}
            />
          </div>
        </article>

        <article className="surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, color: "#66847c", fontWeight: 700, marginBottom: 10 }}>Verification Status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statusPill(profileData.user?.kycComplete, "KYC Verified", "KYC Pending")}
            {statusPill(profileData.user?.fraudClear, "Fraud Clear", "Fraud Review")}
          </div>
        </article>
      </section>

      <section className="surface-card" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 10px", color: "#104236" }}>Recent Transactions</h2>
        {!txs.length ? (
          <div style={{ textAlign: "center", color: "#739089", padding: 20 }}>No transactions yet</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {txs.map((tx, idx) => {
              const amount = tx.amount ?? 0;
              const positive = amount > 0;
              const timeRaw = tx.timestamp || tx.date;
              const when = timeRaw ? new Date(timeRaw).toLocaleString() : "No date";
              const label = tx.description || tx.memo || "Transaction";
              return (
                <div
                  key={`${timeRaw || "tx"}-${idx}`}
                  style={{
                    border: "1px solid rgba(9,76,64,0.12)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    background: "rgba(255,255,255,0.66)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: positive ? "rgba(16,185,129,0.16)" : "rgba(220,38,38,0.14)",
                        color: positive ? "#0f8a69" : "#b4233f",
                        fontWeight: 900,
                      }}
                    >
                      {positive ? "↓" : "↑"}
                    </div>
                    <div>
                      <div style={{ color: "#133e34", fontWeight: 700, fontSize: 14 }}>{label}</div>
                      <div style={{ color: "#77948d", fontSize: 12 }}>{when}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: positive ? "#0f8a69" : "#b4233f" }}>
                    {positive ? "+" : ""}
                    {amount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
