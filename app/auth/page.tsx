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
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="headline" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.3 }}>
            {tab === "login" ? "Log in" : "Sign Up"}
          </div>
          <div style={{ width: 80 }}></div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "var(--surface-subtle)",
            border: "1px solid var(--line)",
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
                background: tab === choice ? "var(--accent-gradient)" : "transparent",
                color: tab === choice ? "#fff" : "var(--ink-muted)",
                transition: "all 0.22s ease",
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
              border: "1px solid var(--error-border)",
              background: "var(--error-bg)",
              color: "var(--error-text)",
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
              <span className="field-label">Full Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alice Johnson"
                required
                className="field-input"
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="field-input"
              suppressHydrationWarning
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="field-input"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="primary-btn"
            style={{ marginTop: 6 }}
          >
            {loading ? "Processing..." : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
