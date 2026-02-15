"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav style={{
            background: "linear-gradient(135deg, #0d9488, #059669)",
            padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
            <Link href="/" style={{ color: "#fff", fontWeight: 700, fontSize: 18, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                🌿 Green Energy Credit Bank
            </Link>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {user ? (
                    <>
                        <Link href="/submit" style={{ color: "#d1fae5", textDecoration: "none", fontSize: 14 }}>Submit Action</Link>
                        <Link href="/marketplace" style={{ color: "#d1fae5", textDecoration: "none", fontSize: 14 }}>Marketplace</Link>
                        <span style={{ color: "#a7f3d0", fontSize: 13 }}>{user.name}</span>
                        <button onClick={logout} style={{
                            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                            color: "#fff", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                        }}>Sign Out</button>
                    </>
                ) : (
                    <Link href="/auth" style={{
                        color: "#fff", background: "rgba(255,255,255,0.2)", padding: "6px 16px",
                        borderRadius: 8, textDecoration: "none", fontSize: 14,
                    }}>Sign In</Link>
                )}
            </div>
        </nav>
    );
}
