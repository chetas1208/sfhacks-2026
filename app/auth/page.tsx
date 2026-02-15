"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (tab === "login") {
        const data = await login(email, password);
        if (data?.flow === "kyc") router.push("/kyc");
        else if (data?.flow === "fraud") router.push("/fraud");
        else router.push("/");
      } else {
        await signup(name, email, password);
        router.push("/kyc");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "32px auto" }}>
      <div className="surface-card" style={{ padding: 26 }}>
        <div style={{ marginBottom: 20 }}>
          <div>
            <div className="headline" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
              {tab === "login" ? "Welcome Back" : "Create Your Account"}
            </div>
            <p style={{ margin: "6px 0 0", color: "#6a8880" }}>
              Access your green rewards journey.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(9,76,64,0.12)",
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {(["login", "signup"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                setTab(choice);
                setError("");
              }}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "10px 10px",
                cursor: "pointer",
                fontWeight: 700,
                background: tab === choice ? "linear-gradient(135deg, #0f9d8b, #1f9967)" : "transparent",
                color: tab === choice ? "#fff" : "#43685e",
              }}
            >
              {choice === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 12,
              border: "1px solid rgba(220,38,38,0.3)",
              background: "rgba(220,38,38,0.08)",
              color: "#7f1d1d",
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {tab === "signup" && (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#5f7d75", fontWeight: 700 }}>Full Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alice Johnson"
                required
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(9,76,64,0.18)",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.88)",
                  color: "#123f34",
                }}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#5f7d75", fontWeight: 700 }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                borderRadius: 12,
                border: "1px solid rgba(9,76,64,0.18)",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.88)",
                color: "#123f34",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#5f7d75", fontWeight: 700 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                borderRadius: 12,
                border: "1px solid rgba(9,76,64,0.18)",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.88)",
                color: "#123f34",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              border: "none",
              borderRadius: 12,
              padding: "11px 14px",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#93c5bd" : "linear-gradient(135deg, #0f9d8b, #1f9967)",
              color: "#fff",
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
          >
            {loading ? "Processing..." : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
