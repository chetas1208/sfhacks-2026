"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import Link from "next/link";

type Wallet = {
  balance: number;
};
type Transaction = {
  type?: string;
  amount?: number;
  description?: string;
  memo?: string;
  timestamp?: string;
  date?: string;
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/auth");
    if (!user.kycComplete) return void router.push("/kyc");
    if (!user.fraudClear) return void router.push("/fraud");
    if (!user.greenScore) return void router.push("/green-score");
    (async () => {
      try {
        const [walletData, profileData] = await Promise.all([apiGet("/api/wallet"), apiGet("/api/profile")]);
        setWallet(walletData);
        setTransactions(profileData?.transactions || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return <div style={{ textAlign: "center", padding: 72, color: "#7b9b93" }}>Loading dashboard...</div>;
  }

  const score = user.greenScore || 0;
  const progress = Math.min((score / 850) * 100, 100);
  const rating =
    score >= 700 ? "Excellent" : score >= 600 ? "Good" : score >= 500 ? "Fair" : "Needs Improvement";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        className="surface-card"
        style={{
          padding: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "linear-gradient(128deg, rgba(255,255,255,0.86), rgba(230,249,240,0.76), rgba(223,242,255,0.68))",
        }}
      >
        <div>
          <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#5f7a73" }}>
            Track your impact, earn credits, and redeem smarter rewards.
          </p>
        </div>
        <div style={{ border: "1px solid rgba(15,157,139,0.25)", borderRadius: 999, padding: "8px 14px", fontWeight: 700, color: "#0f5f4e" }}>
          {wallet?.balance ?? 0} points
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div className="surface-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 10px", color: "#0f5f4e" }}>Green Score</h3>
          <div style={{ height: 10, borderRadius: 999, background: "rgba(13,49,39,0.1)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #0f9d8b, #2bb673)",
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#104236" }}>{score}</span>
            <span style={{ color: "#5f7a73" }}>/ 850</span>
          </div>
          <div style={{ color: "#0f9d8b", fontWeight: 700 }}>{rating}</div>
        </div>

        <div className="surface-card" style={{ padding: 22, background: "linear-gradient(145deg, #0f9d8b, #178d62)", color: "#fff" }}>
          <h3 style={{ margin: "0 0 10px", fontWeight: 700 }}>Points Wallet</h3>
          <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{wallet?.balance ?? 0}</div>
          <p style={{ margin: "6px 0 14px", opacity: 0.9 }}>Available for redemptions</p>
          <Link
            href="/marketplace"
            style={{
              display: "inline-block",
              textDecoration: "none",
              color: "#104236",
              background: "#fff",
              borderRadius: 12,
              padding: "8px 14px",
              fontWeight: 700,
            }}
          >
            Open Marketplace
          </Link>
        </div>
      </section>

      <section className="surface-card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 12px", color: "#0f5f4e" }}>Quick Actions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { href: "/submit", title: "Submit Action", icon: "📝" },
            { href: "/marketplace", title: "Browse Rewards", icon: "🛒" },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              style={{
                textDecoration: "none",
                color: "#124339",
                borderRadius: 14,
                border: "1px solid rgba(9,76,64,0.14)",
                background: "rgba(255,255,255,0.72)",
                padding: "14px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontWeight: 700,
                transition: "transform .16s ease, box-shadow .16s ease",
                boxShadow: "0 6px 16px rgba(10,83,68,0.08)",
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="surface-card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 12px", color: "#0f5f4e" }}>Recent Transactions</h3>
        {!transactions.length ? (
          <p style={{ margin: 0, color: "#6d8982" }}>No transactions yet. Submit your first claim to earn points.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {transactions.slice(0, 8).map((tx, index) => {
              const amount = tx.amount ?? 0;
              const when = tx.timestamp || tx.date || "";
              return (
                <div
                  key={`${when}-${index}`}
                  style={{
                    border: "1px solid rgba(9,76,64,0.12)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "rgba(255,255,255,0.68)",
                  }}
                >
                  <div>
                    <div style={{ color: "#133e34", fontWeight: 600 }}>
                      {tx.description || tx.memo || "Transaction"}
                    </div>
                    <div style={{ color: "#799790", fontSize: 12 }}>
                      {when ? new Date(when).toLocaleString() : "No date"}
                    </div>
                  </div>
                  <div style={{ color: amount > 0 ? "#118e63" : "#b4233f", fontWeight: 800 }}>
                    {amount > 0 ? `+${amount}` : amount} pts
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
