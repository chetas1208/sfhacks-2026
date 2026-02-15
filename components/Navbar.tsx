"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useTheme } from "./ThemeContext";
import { usePathname } from "next/navigation";

/* ── SVG icons for the theme toggle ──────────────────────── */
function SunIcon() {
  return (
    <svg className="theme-icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="theme-icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const navItems = [
    { href: "/submit", label: "Submit Claim" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/transactions", label: "Transactions" },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "10px 0 8px",
        backdropFilter: "blur(12px)",
        background: "var(--nav-outer)",
        borderBottom: "1px solid var(--line-subtle)",
        transition: "background 0.35s ease, border-color 0.35s ease",
      }}
    >
      <div
        style={{
          width: "calc(100% - 16px)",
          maxWidth: 1480,
          margin: "0 auto",
          minHeight: 72,
          padding: "10px 18px",
          borderRadius: 20,
          border: "1px solid var(--nav-border)",
          background: "var(--nav-bg)",
          backdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          boxShadow: "var(--nav-shadow)",
          transition: "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease",
        }}
      >
        {/* ── Logo ──────────────────────────────────── */}
        <Link
          href="/"
          style={{
            color: "var(--ink)",
            fontWeight: 800,
            fontSize: 17,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            letterSpacing: "-0.01em",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", width: 42, height: 42, borderRadius: "50%", overflow: "hidden" }}>
            <Image
              src="/brand-logo-cropped.png"
              alt="Greenify Logo"
              fill
              style={{ objectFit: "cover", transform: "scale(1.6)" }}
            />
          </div>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span style={{ fontSize: 16 }}>.greeniFy</span>
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: 0.4 }}>
              + Rewards
            </span>
          </span>
        </Link>

        {/* ── Right Section ─────────────────────────── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {user ? (
            <>
              {/* Nav Pill Links */}
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      color: active ? "#ffffff" : "var(--nav-text)",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: active
                        ? "1px solid transparent"
                        : "1px solid var(--nav-pill-border)",
                      background: active
                        ? "var(--accent-gradient)"
                        : "var(--nav-pill-bg)",
                      boxShadow: active
                        ? "0 7px 16px rgba(6,125,101,0.34)"
                        : "none",
                      transition: "all 0.22s ease",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Cart badge */}
              <Link
                href="/marketplace/cart"
                style={{
                  position: "relative",
                  color: "var(--nav-text)",
                  textDecoration: "none",
                  fontSize: 18,
                  padding: "7px 11px",
                  borderRadius: 999,
                  border: "1px solid var(--nav-pill-border)",
                  background: "var(--nav-pill-bg)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.22s ease",
                }}
              >
                🛒
                {itemCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: "linear-gradient(135deg, #ef4444, #dc2626)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 900,
                      borderRadius: 999,
                      minWidth: 18,
                      height: 18,
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 2px 6px rgba(220,38,38,0.35)",
                    }}
                  >
                    {itemCount}
                  </span>
                )}
              </Link>

              {/* User name */}
              <Link
                href="/profile"
                style={{
                  color: "var(--nav-text)",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "var(--badge-bg)",
                  border: "1px solid var(--badge-border)",
                  padding: "7px 12px",
                  borderRadius: 999,
                  maxWidth: 140,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  transition: "all 0.22s ease",
                }}
              >
                {user.name}
              </Link>

              {/* Logout */}
              <button
                onClick={logout}
                style={{
                  background: "var(--nav-pill-bg)",
                  border: "1px solid var(--nav-pill-border)",
                  color: "var(--nav-text)",
                  padding: "7px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  transition: "all 0.22s ease",
                }}
              >
                Logout
              </button>
            </>
          ) : null}

          {/* ── Theme Toggle (always visible) ──────── */}
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            style={{ color: "var(--nav-text)" }}
          >
            <SunIcon />
            <MoonIcon />
          </button>
        </div>
      </div>
    </nav>
  );
}
