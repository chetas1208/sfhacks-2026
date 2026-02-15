"use client";
import { useCart } from "@/components/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, itemCount } = useCart();
    const router = useRouter();
    const total = items.reduce((sum, i) => sum + i.cost * i.quantity, 0);

    if (items.length === 0) {
        return (
            <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
                <div className="surface-card" style={{ padding: 48, textAlign: "center", display: "grid", gap: 16, placeItems: "center" }}>
                    <span style={{ fontSize: 56 }}>🛒</span>
                    <h2 style={{ margin: 0, color: "var(--ink)", fontWeight: 800, fontSize: 24 }}>Your cart is empty</h2>
                    <Link href="/marketplace" className="primary-btn" style={{ textDecoration: "none", marginTop: 8, fontSize: 14, padding: "11px 20px" }}>
                        Browse Marketplace
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
            {/* Header */}
            <section className="surface-card" style={{ padding: 22 }}>
                <h1 className="headline" style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                    Your Cart
                </h1>
                <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""} — Review and proceed to checkout.
                </p>
            </section>

            {/* Items */}
            <div className="surface-card" style={{ padding: 0, overflow: "hidden" }}>
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "72px 1fr auto",
                            gap: 14,
                            padding: "14px 18px",
                            alignItems: "center",
                            borderBottom: idx < items.length - 1 ? "1px solid var(--line-subtle)" : "none",
                        }}
                    >
                        {/* Image */}
                        <div style={{
                            width: 72, height: 72, borderRadius: 12, overflow: "hidden",
                            background: "var(--accent-muted)", display: "grid", placeItems: "center",
                        }}>
                            {item.image_url ? (
                                <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <span style={{ fontSize: 28 }}>🛍️</span>
                            )}
                        </div>

                        {/* Details */}
                        <div style={{ minWidth: 0 }}>
                            {item.brand && (
                                <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    {item.brand}
                                </div>
                            )}
                            <div style={{ color: "var(--ink)", fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{item.cost} pts each</div>

                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{
                                    width: 26, height: 26, borderRadius: 8,
                                    border: "1px solid var(--line-strong)", background: "var(--surface-subtle)",
                                    cursor: "pointer", fontWeight: 800, color: "var(--ink-secondary)",
                                    display: "grid", placeItems: "center", fontSize: 14,
                                }}>−</button>
                                <span style={{ fontWeight: 800, color: "var(--ink)", minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{
                                    width: 26, height: 26, borderRadius: 8,
                                    border: "1px solid var(--line-strong)", background: "var(--surface-subtle)",
                                    cursor: "pointer", fontWeight: 800, color: "var(--ink-secondary)",
                                    display: "grid", placeItems: "center", fontSize: 14,
                                }}>+</button>
                                <button onClick={() => removeFromCart(item.id)} style={{
                                    marginLeft: 10, border: "none", background: "var(--negative-bg)",
                                    color: "var(--negative)", borderRadius: 8, padding: "4px 10px",
                                    cursor: "pointer", fontWeight: 700, fontSize: 11,
                                }}>Remove</button>
                            </div>
                        </div>

                        {/* Subtotal */}
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>{item.cost * item.quantity} pts</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Summary */}
            <div className="surface-card" style={{ padding: 20 }}>
                <h3 style={{ margin: "0 0 12px", color: "var(--ink-secondary)", fontWeight: 700 }}>Order Summary</h3>
                {items.map((item) => (
                    <div key={item.id} style={{
                        display: "flex", justifyContent: "space-between", padding: "4px 0",
                        fontSize: 13, color: "var(--ink-muted)",
                    }}>
                        <span>{item.title} × {item.quantity}</span>
                        <span style={{ fontWeight: 700 }}>{item.cost * item.quantity} pts</span>
                    </div>
                ))}
                <div style={{
                    borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10,
                    display: "flex", justifyContent: "space-between",
                    fontWeight: 800, fontSize: 16, color: "var(--ink)",
                }}>
                    <span>Total</span>
                    <span>{total} pts</span>
                </div>

                <button
                    onClick={() => router.push("/marketplace/checkout")}
                    className="primary-btn"
                    style={{ width: "100%", marginTop: 14, fontSize: 14, padding: "12px 14px" }}
                >
                    Proceed to Checkout
                </button>
            </div>
        </div>
    );
}
