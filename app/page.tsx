"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import Link from "next/link";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<{ balance: number; transactions: { type: string; amount: number; memo: string; date: string }[] } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth"); return; }
    if (!user.kycComplete) { router.push("/kyc"); return; }
    if (!user.fraudClear) { router.push("/fraud"); return; }
    if (!user.greenScore) { router.push("/green-score"); return; }
    apiGet("/api/wallet").then(setWallet).catch(console.error);
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading...</div>;

  const score = user.greenScore || 0;
  const circumference = 2 * Math.PI * 80;
  const pct = Math.min((score / 850) * 100, 100);
  const offset = circumference - (pct / 100) * circumference;
  const rating = score >= 700 ? "Excellent" : score >= 600 ? "Good" : score >= 500 ? "Fair" : "Needs Improvement";

  return (
    <div>
      <h1 style={{ color: "#065f46", marginBottom: 24 }}>Welcome back, {user.name.split(" ")[0]}! 🌿</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Green Score Card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h3 style={{ color: "#065f46", marginTop: 0, marginBottom: 8 }}>Green Credit Score</h3>
          <svg width="180" height="180" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle cx="100" cy="100" r="80" fill="none" stroke="#059669" strokeWidth="12"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 100 100)" />
            <text x="100" y="92" textAnchor="middle" fontSize="36" fontWeight="700" fill="#065f46">{score}</text>
            <text x="100" y="116" textAnchor="middle" fontSize="14" fill="#059669">{rating}</text>
          </svg>
        </div>

        {/* Green Points Card */}
        <div style={{ background: "linear-gradient(135deg, #059669, #0d9488)", borderRadius: 16, padding: 24, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Green Points Balance</div>
          <div style={{ fontSize: 48, fontWeight: 700, marginTop: 8 }}>{wallet?.balance ?? 0}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>credits available</div>
          <Link href="/marketplace" style={{ marginTop: 16, display: "inline-block", background: "rgba(255,255,255,0.2)", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, textAlign: "center" }}>
            Browse Marketplace →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <h3 style={{ color: "#065f46", marginTop: 0 }}>Quick Actions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { href: "/submit", icon: "📝", label: "Submit Action" },
            { href: "/marketplace", icon: "🛒", label: "Marketplace" },
            { href: "/submit", icon: "📸", label: "Scan Receipt" },
          ].map(a => (
            <Link key={a.label} href={a.href} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: 16, borderRadius: 12, border: "1px solid #e5e7eb", textDecoration: "none", color: "#374151",
              transition: "background 0.2s",
            }}>
              <span style={{ fontSize: 28 }}>{a.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h3 style={{ color: "#065f46", marginTop: 0 }}>Recent Transactions</h3>
        {(wallet?.transactions?.length ?? 0) === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>No transactions yet. Submit a green action to earn credits!</p>
        ) : (
          <div>
            {wallet?.transactions.slice(0, 10).map((tx, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{tx.memo}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(tx.date).toLocaleDateString()}</div>
                </div>
                <div style={{ fontWeight: 600, color: tx.amount > 0 ? "#059669" : "#dc2626" }}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
