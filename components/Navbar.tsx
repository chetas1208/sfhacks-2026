"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const navItems = [
    { href: "/submit", label: "Submit Claim" },
    { href: "/marketplace", label: "Marketplace" },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "10px 0 8px",
        backdropFilter: "blur(8px)",
        background: "linear-gradient(180deg, rgba(236,249,244,0.82), rgba(236,249,244,0.38))",
        borderBottom: "1px solid rgba(9,76,64,0.08)",
      }}
    >
      <div
        style={{
          width: "calc(100% - 16px)",
          maxWidth: 1480,
          margin: "0 auto",
          minHeight: 72,
          padding: "10px 16px",
          borderRadius: 20,
          border: "1px solid rgba(9,76,64,0.16)",
          background: "linear-gradient(128deg, rgba(255,255,255,0.92), rgba(238,253,246,0.84), rgba(232,245,255,0.78))",
          backdropFilter: "blur(14px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: "0 14px 36px rgba(9,76,64,0.12)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#0f4f40",
            fontWeight: 800,
            fontSize: 17,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            letterSpacing: "-0.01em",
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              background:
                "radial-gradient(circle at 28% 25%, #34d399, #059669 60%, #065f46)",
              boxShadow: "0 6px 16px rgba(5,150,105,0.35)",
              color: "#fff",
            }}
          >
            ✦
          </span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span style={{ fontSize: 16 }}>Green Energy Bank</span>
            <span style={{ fontSize: 11, color: "#11967f", fontWeight: 700, letterSpacing: 0.4 }}>
              Rewards Platform
            </span>
          </span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {user ? (
          <>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color: active ? "#ffffff" : "#0f5f4e",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 13px",
                    borderRadius: 999,
                    border: active
                      ? "1px solid rgba(7,118,103,0.85)"
                      : "1px solid rgba(7,118,103,0.2)",
                    background: active
                      ? "linear-gradient(135deg, #0f9d8b, #169f66)"
                      : "rgba(255,255,255,0.72)",
                    boxShadow: active ? "0 7px 16px rgba(6,125,101,0.34)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
            <span
              style={{
                color: "#0f5f4e",
                fontSize: 12,
                fontWeight: 700,
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16,185,129,0.24)",
                padding: "7px 11px",
                borderRadius: 999,
                maxWidth: 140,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name}
            </span>
            <button
              onClick={logout}
              style={{
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(5, 150, 105, 0.3)",
                color: "#0f5f4e",
                padding: "7px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                transition: "background 0.2s ease, border-color 0.2s ease",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/auth"
            style={{
              color: "#fff",
              background: "linear-gradient(135deg, #059669, #0d9488, #0f766e)",
              padding: "8px 16px",
              borderRadius: 999,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 8px 20px rgba(5, 150, 105, 0.35)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            Sign In
          </Link>
        )}
        </div>
      </div>
    </nav>
  );
}
