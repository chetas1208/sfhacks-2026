"use client";

import { useCart } from "@/components/CartContext";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CheckoutPage() {
    const { items, totalCost, clearCart } = useCart();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchingBalance, setFetchingBalance] = useState(true);
    const [error, setError] = useState("");
    const [orderResult, setOrderResult] = useState<{
        order_id: string;
        items_purchased: number;
        total_cost: number;
        new_balance: number;
        timestamp: string;
    } | null>(null);

    useEffect(() => {
        if (!authLoading && !user) router.push("/auth");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem("gecb_token");
        if (!token) return;
        fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => setBalance(data.balance || 0))
            .catch(console.error)
            .finally(() => setFetchingBalance(false));
    }, [user]);

    const handlePlaceOrder = async () => {
        if (items.length === 0 || totalCost > balance) return;
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("gecb_token");
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Checkout failed" }));
                throw new Error(err.detail || "Checkout failed");
            }

            const data = await res.json();
            setOrderResult(data);
            clearCart();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || fetchingBalance) {
        return <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 64 }}>Loading...</div>;
    }

    if (orderResult) {
        return (
            <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 16 }}>
                <div
                    className="surface-card"
                    style={{ padding: 32, textAlign: "center" }}
                >
                    <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--positive)" }}>
                        Order Placed!
                    </h1>
                    <p style={{ color: "var(--ink-muted)", margin: "8px 0 0" }}>Your redemption was successful.</p>
                </div>

                <div className="surface-card" style={{ padding: 22 }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "var(--ink-secondary)" }}>
                        Order Receipt
                    </h2>
                    <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-muted)" }}>
                            <span>Order ID</span>
                            <span style={{ fontWeight: 700, color: "var(--ink-secondary)", fontFamily: "monospace" }}>
                                {orderResult.order_id}
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-muted)" }}>
                            <span>Items Purchased</span>
                            <span style={{ fontWeight: 700, color: "var(--ink-secondary)" }}>{orderResult.items_purchased}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-muted)" }}>
                            <span>Total Cost</span>
                            <span style={{ fontWeight: 800, color: "var(--ink-secondary)" }}>{orderResult.total_cost} pts</span>
                        </div>
                        <div
                            style={{
                                borderTop: "1px solid var(--line-subtle)",
                                paddingTop: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                color: "var(--ink-muted)",
                            }}
                        >
                            <span>Remaining Balance</span>
                            <span style={{ fontWeight: 800, color: "var(--positive)", fontSize: 16 }}>
                                {orderResult.new_balance} pts
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-muted)" }}>
                            <span>Date</span>
                            <span style={{ fontWeight: 600 }}>
                                {new Date(orderResult.timestamp).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
                    <Link href="/marketplace" style={{ textDecoration: "none" }}>
                        <button className="aurora-btn-secondary" style={{ padding: "10px 20px" }}>
                            Continue Shopping
                        </button>
                    </Link>
                    <button
                        className="aurora-btn"
                        style={{ padding: "10px 20px" }}
                        onClick={() => {
                            const token = localStorage.getItem("gecb_token");
                            if (!token) return;
                            fetch(`/api/marketplace/invoice/${orderResult.order_id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                                .then(res => res.blob())
                                .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `Invoice_${orderResult.order_id}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                })
                                .catch(alert);
                        }}
                    >
                        📄 Download Invoice
                    </button>
                </div>
            </div >
        );
    }

    // Empty cart
    if (items.length === 0) {
        return (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div
                    className="surface-card"
                    style={{ padding: 48, textAlign: "center", display: "grid", gap: 12, placeItems: "center" }}
                >
                    <span style={{ fontSize: 48 }}>🛒</span>
                    <p style={{ color: "var(--ink-muted)", fontSize: 16, margin: 0 }}>Your cart is empty</p>
                    <Link
                        href="/marketplace"
                        className="primary-btn"
                        style={{ textDecoration: "none", fontSize: 14, padding: "10px 20px" }}
                    >
                        Browse Marketplace
                    </Link>
                </div>
            </div>
        );
    }

    const canAfford = balance >= totalCost;

    return (
        <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gap: 16 }}>
            {/* Back */}
            <Link href="/marketplace/cart" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                ← Back to Cart
            </Link>

            <h1 className="headline" style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Checkout</h1>

            {/* Invoice */}
            <div className="surface-card" style={{ padding: 22 }}>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "var(--ink-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📄</span> Invoice
                </h2>

                {/* Line items */}
                <div style={{ display: "grid", gap: 0 }}>
                    {/* Header */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 60px 80px",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--line)",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "var(--ink-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                        }}
                    >
                        <span>Item</span>
                        <span style={{ textAlign: "center" }}>Qty</span>
                        <span style={{ textAlign: "right" }}>Subtotal</span>
                    </div>

                    {items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 60px 80px",
                                padding: "10px 0",
                                borderBottom: "1px solid var(--line-subtle)",
                                fontSize: 14,
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700, color: "var(--ink)" }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{item.cost} pts each · {item.brand || "Marketplace"}</div>
                            </div>
                            <span style={{ textAlign: "center", fontWeight: 700, color: "var(--ink-secondary)" }}>{item.quantity}</span>
                            <span style={{ textAlign: "right", fontWeight: 800, color: "var(--ink-secondary)" }}>{item.cost * item.quantity} pts</span>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div
                    style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "2px solid var(--line-strong)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)" }}>{totalCost} pts</span>
                </div>
            </div>

            {/* Balance + Place Order */}
            <div className="surface-card" style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ color: "var(--ink-muted)", fontSize: 14 }}>Your Balance</span>
                    <span style={{ fontWeight: 800, fontSize: 20, color: canAfford ? "var(--positive)" : "var(--negative)" }}>
                        {balance} pts
                    </span>
                </div>

                {!canAfford && (
                    <div
                        style={{
                            background: "var(--negative-bg)",
                            border: "1px solid var(--error-border)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            color: "var(--negative)",
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 14,
                        }}
                    >
                        Insufficient balance. You need {totalCost - balance} more points.
                    </div>
                )}

                {error && (
                    <div
                        style={{
                            background: "var(--error-bg)",
                            border: "1px solid var(--error-border)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            color: "var(--error-text)",
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 14,
                        }}
                    >
                        {error}
                    </div>
                )}

                <button
                    onClick={handlePlaceOrder}
                    disabled={loading || !canAfford}
                    className="primary-btn"
                    style={{
                        width: "100%",
                        padding: "14px 24px",
                        fontSize: 16,
                    }}
                >
                    {loading ? "Processing Order..." : `Place Order · ${totalCost} pts`}
                </button>
            </div>
        </div>
    );
}
