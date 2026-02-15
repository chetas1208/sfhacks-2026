"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type Transaction = {
    _id: number;
    email: string;
    type: string;
    description: string;
    amount: number;
    timestamp: string;
    order_id?: string;
    items?: { title: string; quantity: number; cost: number }[];
};

export default function TransactionsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const POINTS_PER_USD = 0.5; // $1 = 0.5 points
    const dollarsFromPoints = (points: number) => Math.abs(points) / POINTS_PER_USD;
    const formatPoints = (points: number) =>
        `${points > 0 ? "+" : points < 0 ? "" : ""}${Number.isInteger(points) ? points : points.toFixed(2)} pts`;

    useEffect(() => {
        if (!authLoading && !user) router.push("/auth");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem("gecb_token");
        if (!token) return;

        fetch("/api/transactions", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => setTransactions(data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user]);

    if (authLoading || loading) {
        return <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 64 }}>Loading transactions...</div>;
    }

    return (
        <div style={{ display: "grid", gap: 16, maxWidth: 860, margin: "0 auto" }}>
            {/* Header */}
            <section className="surface-card" style={{ padding: 22 }}>
                <h1 className="headline" style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                    Transaction History
                </h1>
            </section>

            {transactions.length === 0 ? (
                <div
                    className="surface-card"
                    style={{ padding: 48, textAlign: "center", display: "grid", gap: 12, placeItems: "center" }}
                >
                    <span style={{ fontSize: 48 }}>📋</span>
                    <p style={{ color: "var(--ink-muted)", fontSize: 16, margin: 0 }}>No transactions yet</p>
                    <Link
                        href="/marketplace"
                        className="primary-btn"
                        style={{ textDecoration: "none", fontSize: 14, padding: "10px 20px" }}
                    >
                        Browse Marketplace
                    </Link>
                </div>
            ) : (
                <div className="surface-card" style={{ padding: 0, overflow: "hidden" }}>
                    {transactions.map((tx, idx) => {
                        const isSpend = tx.amount < 0;
                        const expanded = expandedId === tx._id;
                        return (
                            <div key={tx._id}>
                                <div
                                    onClick={() => tx.items ? setExpandedId(expanded ? null : tx._id) : undefined}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "auto 1fr auto",
                                        gap: 14,
                                        padding: "14px 18px",
                                        alignItems: "center",
                                        borderBottom: idx < transactions.length - 1 ? "1px solid var(--line-subtle)" : "none",
                                        cursor: tx.items ? "pointer" : "default",
                                        transition: "background 0.15s ease",
                                    }}
                                >
                                    {/* Icon */}
                                    <div
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 10,
                                            display: "grid",
                                            placeItems: "center",
                                            fontSize: 18,
                                            background: isSpend
                                                ? "var(--negative-bg)"
                                                : "var(--positive-bg)",
                                        }}
                                    >
                                        {isSpend ? "🛒" : "💰"}
                                    </div>

                                    {/* Info */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>
                                            {tx.description}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                                            {tx.order_id && (
                                                <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                                                    #{tx.order_id.slice(0, 8)}
                                                </span>
                                            )}
                                            {tx.items && (
                                                <span style={{ color: "var(--accent)" }}>
                                                    {expanded ? "▲ Hide details" : "▼ View details"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div
                                        style={{
                                            fontWeight: 800,
                                            fontSize: 15,
                                            color: isSpend ? "var(--negative)" : "var(--positive)",
                                            textAlign: "right",
                                        }}
                                    >
                                        <div>{formatPoints(tx.amount)}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>
                                            ≈ ${dollarsFromPoints(tx.amount).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded items */}
                                {expanded && tx.items && (
                                    <div
                                        style={{
                                            background: "var(--surface-subtle)",
                                            padding: "10px 18px 14px 72px",
                                            borderBottom: idx < transactions.length - 1 ? "1px solid var(--line-subtle)" : "none",
                                        }}
                                    >
                                        {tx.items.map((item, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    padding: "4px 0",
                                                    fontSize: 13,
                                                    color: "var(--ink-muted)",
                                                }}
                                            >
                                                <span>{item.title} × {item.quantity}</span>
                                                <span style={{ fontWeight: 700 }}>
                                                    {item.cost * item.quantity} pts
                                                    <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}> · ${dollarsFromPoints(item.cost * item.quantity).toFixed(2)}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
