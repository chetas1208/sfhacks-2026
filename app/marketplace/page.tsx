"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

type MarketplaceItem = {
  _id: number;
  title: string;
  description: string;
  cost: number;
  type?: "offer" | "product" | string;
  category?: string;
  inventory?: number;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  brand?: string;
};

export default function MarketplacePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<"product" | "offer">("product");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("gecb_token");
    if (!token) return;

    (async () => {
      try {
        const walletRes = await fetch("/api/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (walletRes.ok) {
          const wallet = await walletRes.json();
          setBalance(wallet.balance || 0);
        }

        const marketRes = await fetch("/api/marketplace");
        if (marketRes.ok) {
          const data = await marketRes.json();
          setItems(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filteredItems = useMemo(
    () => items.filter((item) => (item.type || "product") === activeTab),
    [items, activeTab]
  );

  const handleRedeem = async (item: MarketplaceItem) => {
    if (balance < item.cost || purchasing) return;
    setPurchasing(item._id);
    try {
      const token = localStorage.getItem("gecb_token");
      const res = await fetch(`/api/marketplace/redeem?item_id=${item._id}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Redemption failed" }));
        throw new Error(err.detail || "Redemption failed");
      }
      const data = await res.json();
      setBalance(data.new_balance || 0);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Redemption failed");
    } finally {
      setPurchasing(null);
    }
  };

  if (authLoading || loading) {
    return <div style={{ textAlign: "center", color: "#6f8d85", padding: 64 }}>Loading marketplace...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        className="surface-card"
        style={{
          padding: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          background:
            "linear-gradient(130deg, rgba(255,255,255,0.85), rgba(225,249,240,0.78), rgba(221,241,255,0.72))",
        }}
      >
        <div>
          <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
            Marketplace
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6a8880" }}>
            Redeem your points for practical products and curated offers.
          </p>
        </div>
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(9,76,64,0.14)",
            background: "rgba(255,255,255,0.78)",
            padding: "8px 12px",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            boxShadow: "0 10px 24px rgba(10,83,68,0.12)",
          }}
        >
          <span style={{ color: "#5f7d75", fontSize: 12, fontWeight: 700 }}>Balance</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#0f5f4e" }}>{balance}</span>
          <span style={{ color: "#6a8880", fontSize: 12 }}>points</span>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["product", "offer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              border: "1px solid rgba(9,76,64,0.16)",
              borderRadius: 999,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              background: activeTab === tab ? "linear-gradient(135deg, #0f9d8b, #1f9967)" : "rgba(255,255,255,0.74)",
              color: activeTab === tab ? "#fff" : "#0f5f4e",
              boxShadow: activeTab === tab ? "0 10px 22px rgba(10,130,103,0.28)" : "none",
            }}
          >
            {tab === "offer" ? "Offers" : "Products"}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="surface-card" style={{ padding: 26, textAlign: "center", color: "#6a8880" }}>
          No {activeTab}s available right now.
        </div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {filteredItems.map((item) => {
            const image = item.image || item.imageUrl || item.image_url || "";
            const disabled = purchasing === item._id || balance < item.cost;
            return (
              <article
                key={item._id}
                className="surface-card"
                style={{
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  minHeight: 320,
                  background: "linear-gradient(155deg, rgba(255,255,255,0.86), rgba(239,250,245,0.74))",
                }}
              >
                <div
                  style={{
                    height: 150,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "linear-gradient(145deg, rgba(15,157,139,0.12), rgba(90,184,255,0.12))",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {image ? (
                    <img src={image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 36 }}>🛍️</span>
                  )}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        color: "#0c8a71",
                        fontWeight: 800,
                      }}
                    >
                      {item.brand || (activeTab === "offer" ? "Featured Offer" : "Marketplace")}
                    </span>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "2px 8px",
                        background: "rgba(15,157,139,0.12)",
                        color: "#0c7a63",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {activeTab === "offer" ? "Offer" : "Product"}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, color: "#104236", fontSize: 16 }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "#68847d", fontSize: 13, lineHeight: 1.35 }}>{item.description}</p>
                </div>

                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ color: "#0f5f4e", fontWeight: 800 }}>
                    {item.cost} pts
                    {typeof item.inventory === "number" ? (
                      <div style={{ color: "#7a958f", fontSize: 11, fontWeight: 600 }}>{item.inventory} left</div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleRedeem(item)}
                    disabled={disabled}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      background: disabled ? "#b5c6c1" : "linear-gradient(135deg, #0f9d8b, #1f9967)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {purchasing === item._id ? "Processing..." : balance >= item.cost ? "Redeem" : "Need points"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
