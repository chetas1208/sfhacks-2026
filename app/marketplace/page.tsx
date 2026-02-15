"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useCart } from "@/components/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const { addToCart, itemCount } = useCart();
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeTab, setActiveTab] = useState<"product" | "offer">("product");
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
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

  const handleAddToCart = (item: MarketplaceItem) => {
    const image = item.image || item.imageUrl || item.image_url || "";
    addToCart({
      id: item._id,
      title: item.title,
      description: item.description,
      cost: item.cost,
      image_url: image,
      brand: item.brand,
    });
    setAddedId(item._id);
    setTimeout(() => setAddedId(null), 1200);
  };

  if (authLoading || loading) {
    return <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 64 }}>Loading marketplace...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <section
        className="surface-card"
        style={{
          padding: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
            Marketplace
          </h1>

        </div>

        <Link
          href="/marketplace/cart"
          style={{
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: itemCount > 0
              ? "var(--accent-gradient)"
              : "var(--nav-pill-bg)",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: itemCount > 0
              ? "var(--btn-primary-shadow)"
              : "var(--shadow-soft)",
            textDecoration: "none",
            color: itemCount > 0 ? "#fff" : "var(--ink-secondary)",
            fontWeight: 800,
            fontSize: 14,
            transition: "all 0.25s ease",
          }}
        >
          <span style={{ fontSize: 18 }}>🛒</span>
          Cart
          {itemCount > 0 && (
            <span
              style={{
                background: "rgba(255,255,255,0.25)",
                padding: "2px 9px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {itemCount}
            </span>
          )}
        </Link>
      </section>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["product", "offer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              background: activeTab === tab ? "var(--accent-gradient)" : "var(--nav-pill-bg)",
              color: activeTab === tab ? "#fff" : "var(--ink-secondary)",
              boxShadow: activeTab === tab ? "var(--btn-primary-shadow)" : "none",
              transition: "all 0.22s ease",
            }}
          >
            {tab === "offer" ? "Offers" : "Products"}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="surface-card" style={{ padding: 26, textAlign: "center", color: "var(--ink-muted)" }}>
          No {activeTab}s available right now.
        </div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {filteredItems.map((item) => {
            const image = item.image || item.imageUrl || item.image_url || "";
            const justAdded = addedId === item._id;
            return (
              <article
                key={item._id}
                className="surface-card"
                style={{
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  minHeight: 320,
                }}
              >
                <div
                  style={{
                    height: 150,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--accent-muted)",
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
                        color: "var(--accent)",
                        fontWeight: 800,
                      }}
                    >
                      {item.brand || (activeTab === "offer" ? "Featured Offer" : "Marketplace")}
                    </span>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "2px 8px",
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {activeTab === "offer" ? "Offer" : "Product"}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, color: "var(--ink)", fontSize: 16 }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13, lineHeight: 1.35 }}>{item.description}</p>
                </div>

                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ color: "var(--ink-secondary)", fontWeight: 800 }}>
                    {item.cost} pts
                    {typeof item.inventory === "number" ? (
                      <div style={{ color: "var(--ink-soft)", fontSize: 11, fontWeight: 600 }}>{item.inventory} left</div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleAddToCart(item)}
                    className="primary-btn"
                    style={{
                      fontSize: 12,
                      padding: "8px 14px",
                      transform: justAdded ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    {justAdded ? "✓ Added!" : "Add to Cart"}
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
