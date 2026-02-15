"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import Link from "next/link";
import GreenScoreGauge from "@/components/GreenScoreGauge";
import NeuralText from "@/components/NeuralText";

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
  const [greenScore, setGreenScore] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/auth");
    if (!user.kycComplete) return void router.push("/kyc");
    if (!user.fraudClear) return void router.push("/fraud");
    if (!user.greenScore) return void router.push("/green-score");
    (async () => {
      try {
        const [walletData, txData, scoreData] = await Promise.all([
          apiGet("/api/wallet"),
          apiGet("/api/transactions"),
          apiGet("/api/green-score/current"),
        ]);
        setWallet(walletData);
        setTransactions(txData || []);
        setGreenScore(scoreData?.score || user.greenScore || 600);
      } catch (err) {
        console.error(err);
        setGreenScore(user.greenScore || 600);
      }
    })();
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return <div style={{ textAlign: "center", padding: 72, color: "var(--ink-soft)" }}>Loading dashboard...</div>;
  }

  return (
    <>
      <div style={{ display: "grid", gap: 18, position: "relative", zIndex: 2 }}>
        {/* Hero */}
        <section
          className="glass-card"
          style={{
            padding: "28px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <h1 className="headline" style={{ margin: 0, fontSize: 32, fontWeight: 800, display: "flex", gap: 8 }}>
              Hi, <NeuralText text={user.name.split(" ")[0]} />
            </h1>

          </div>
          <div
            style={{
              border: "1px solid var(--primary)",
              borderRadius: 999,
              padding: "8px 16px",
              fontWeight: 700,
              color: "var(--primary)",
              background: "var(--positive-bg)",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
            }}
          >
            {wallet?.balance !== undefined ? wallet.balance.toFixed(2) : "0.00"} points
          </div>
        </section>

        {/* Score + Wallet row */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {/* Green Score Card */}
          <div
            className="glass-card"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h3 style={{ margin: 0, color: "var(--ink-secondary)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "1px" }}>Green Credit Score</h3>
            <GreenScoreGauge score={greenScore} size={180} label=".greeniFy+" />
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", textAlign: "center", maxWidth: 220 }}>
              Score increases with green actions and marketplace activity
            </p>
          </div>

          {/* Points Wallet */}
          <div
            style={{
              padding: 32,
              borderRadius: 24,
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 20px 40px -10px rgba(4, 120, 87, 0.5)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Background decoration */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 140, height: 140, background: "rgba(255,255,255,0.1)", borderRadius: "50%", filter: "blur(30px)" }} />

            <div>
              <h3 style={{ margin: "0 0 4px", fontWeight: 700, opacity: 0.9, fontSize: 15 }}>Points Wallet</h3>
              <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 500 }}>$1.00 ≈ 0.5 GP</div>
            </div>

            <div style={{ margin: "20px 0" }}>
              <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: "-1px" }}>{wallet?.balance !== undefined ? wallet.balance.toFixed(2) : "0.00"}</div>
              <p style={{ margin: "4px 0 0", opacity: 0.9, fontSize: 14 }}>Available for redemptions</p>
            </div>

            <Link
              href="/marketplace"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "#064e3b",
                background: "#fff",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 800,
                fontSize: 14,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              Open Marketplace →
            </Link>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="surface-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 12px", color: "var(--ink-secondary)" }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { href: "/submit", title: "Submit Action", icon: "📝", desc: "Log a green action" },
              { href: "/marketplace", title: "Browse Rewards", icon: "🛒", desc: "" },
              { href: "/profile", title: "Your Profile", icon: "👤", desc: "View & edit details" },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: "var(--ink-secondary)",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "var(--surface-subtle)",
                  padding: "14px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 700,
                  transition: "transform .16s ease, box-shadow .16s ease",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <div>
                  <div>{item.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="surface-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: "var(--ink-secondary)" }}>Recent Transactions</h3>
            <Link
              href="/transactions"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              View All →
            </Link>
          </div>
          {!transactions.length ? (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              No transactions yet. Submit your first claim to earn points.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {transactions.slice(0, 8).map((tx, index) => {
                const amount = tx.amount ?? 0;
                const when = tx.timestamp || tx.date || "";
                return (
                  <div
                    key={`${when}-${index}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      background: "var(--surface-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {tx.description || tx.memo || "Transaction"}
                      </div>
                      <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                        {when ? new Date(when).toLocaleString() : "No date"}
                      </div>
                    </div>
                    <div style={{ color: amount > 0 ? "var(--positive)" : "var(--negative)", fontWeight: 800 }}>
                      {amount > 0 ? `+${amount}` : amount} pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
