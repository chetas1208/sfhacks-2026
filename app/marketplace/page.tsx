"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiGet, apiPost } from "@/lib/api";

interface Product {
    _id: number; title: string; description: string; cost: number; category: string; inventory: number;
}

export default function MarketplacePage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [wallet, setWallet] = useState<{ balance: number } | null>(null);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        apiGet("/api/marketplace").then(setProducts).catch(console.error);
        if (user) apiGet("/api/wallet").then(setWallet).catch(console.error);
    }, [user]);

    const redeem = async (productId: number) => {
        try {
            const res = await apiPost("/api/redeem", { productId });
            setMsg(`✅ ${res.product} redeemed! New balance: ${res.newBalance}`);
            setWallet({ balance: res.newBalance });
        } catch (err: unknown) {
            setMsg(err instanceof Error ? `❌ ${err.message}` : "Failed to redeem");
        }
    };

    const categoryColors: Record<string, string> = {
        food: "#f59e0b", academic: "#3b82f6", tech: "#8b5cf6", lifestyle: "#ec4899", transport: "#06b6d4", impact: "#10b981",
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ color: "#065f46", margin: 0 }}>🛒 Marketplace</h1>
                {wallet && <div style={{ background: "#059669", color: "#fff", padding: "6px 16px", borderRadius: 20, fontWeight: 600, fontSize: 14 }}>{wallet.balance} credits</div>}
            </div>

            {msg && <div style={{ padding: 12, background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", borderRadius: 8, marginBottom: 16, fontSize: 14, color: msg.startsWith("✅") ? "#065f46" : "#991b1b" }}>{msg}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {products.map(p => (
                    <div key={p._id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: "#1f2937" }}>{p.title}</h3>
                            <span style={{ background: categoryColors[p.category] || "#6b7280", color: "#fff", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                                {p.category}
                            </span>
                        </div>
                        <p style={{ color: "#6b7280", fontSize: 13, margin: "8px 0 12px" }}>{p.description}</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "#059669", fontSize: 18 }}>{p.cost} pts</span>
                            <button onClick={() => redeem(p._id)} disabled={!user || (wallet?.balance ?? 0) < p.cost} style={{
                                padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                                background: (!user || (wallet?.balance ?? 0) < p.cost) ? "#d1d5db" : "#059669",
                                color: "#fff", fontWeight: 600, fontSize: 13,
                            }}>Redeem</button>
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{p.inventory} left</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
