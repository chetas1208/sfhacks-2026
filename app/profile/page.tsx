"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiGet, apiPut } from "@/lib/api";
import GreenScoreGauge from "@/components/GreenScoreGauge";

type ProfileData = {
  user: Record<string, unknown>;
  balance: number;
  transactions: {
    type?: string;
    amount?: number;
    description?: string;
    memo?: string;
    timestamp?: string;
    date?: string;
  }[];
};

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/auth");
    (async () => {
      try {
        const data = await apiGet("/api/profile");
        setProfile(data);
        const u = data.user || {};
        setEditName(u.name || "");
        setEditPhone(u.phone || "");
        setEditAddress(u.address || "");
        setEditCity(u.city || "");
        setEditState(u.state || "");
        setEditZip(u.zip || "");
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user, authLoading, router]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      await apiPut("/api/profile", {
        name: editName || undefined,
        phone: editPhone || undefined,
        address: editAddress || undefined,
        city: editCity || undefined,
        state: editState || undefined,
        zip: editZip || undefined,
      });
      await refreshUser();
      // Refresh profile data
      const data = await apiGet("/api/profile");
      setProfile(data);
      setSaveMsg("Profile updated!");
      setEditing(false);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div style={{ textAlign: "center", padding: 72, color: "var(--ink-soft)" }}>Loading profile...</div>;
  }

  const u = profile?.user || {};
  const greenScore = (u.greenScore as number) || user.greenScore || 600;
  const transactions = profile?.transactions || [];

  const downloadStatement = async () => {
    setDownloading(true);
    try {
      // Correct key from AuthContext
      const token = localStorage.getItem("gecb_token");
      if (!token) throw new Error("No token found");
      const res = await fetch("/api/profile/statement", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Greenify_Statement.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not download statement. Is the backend running?");
    } finally {
      setDownloading(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
  };

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 1000, margin: "20px auto" }}>
      {/* Header */}
      <section className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "var(--accent-gradient)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: "white", boxShadow: "0 8px 20px rgba(0,0,0,0.1)"
          }}>
            {(u.name as string)?.charAt(0) || "U"}
          </div>
          <div>
            <h1 className="headline-gradient" style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>
              {editing ? "Edit Profile" : u.name as string || "Your Profile"}
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--ink-secondary)", fontSize: 15 }}>
              {(u.email as string) || user.email}
            </p>
          </div>
        </div>

        {!editing ? (
          <button className="aurora-btn" onClick={() => setEditing(true)}>
            ✏️ Edit Profile
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="aurora-btn"
              style={{ background: "transparent", color: "var(--ink)", boxShadow: "none", border: "1px solid var(--line)" }}
              onClick={() => {
                setEditing(false);
                setSaveMsg("");
              }}
            >
              Cancel
            </button>
            <button className="aurora-btn" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Changes"}
            </button>
          </div>
        )}

        <div style={{ width: "100%", marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="aurora-btn"
            onClick={downloadStatement}
            disabled={downloading}
            style={{
              background: "var(--surface-strong)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              fontSize: 13,
              padding: "8px 16px",
              opacity: downloading ? 0.7 : 1,
              cursor: downloading ? "wait" : "pointer"
            }}
          >
            {downloading ? "⏳ Downloading..." : "📄 Download Statement (PDF)"}
          </button>
        </div>
      </section>

      {saveMsg && (
        <div className={`status-banner ${saveMsg.includes("fail") ? "error" : "success"}`}>
          {saveMsg.includes("fail") ? "⚠️" : "✅"} {saveMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        {/* Green Score */}
        <section className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          <h3 style={{ margin: "0 0 16px", color: "var(--ink-secondary)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", fontSize: 13 }}>
            Green Credit Score
          </h3>
          <GreenScoreGauge score={greenScore} size={200} label=".greeniFy+" />
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>
              {profile?.balance ?? 0} pts
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)", fontWeight: 600 }}>Current Balance</div>
          </div>
        </section>

        {/* Account Details */}
        <section className="glass-card">
          <h3 style={{ margin: "0 0 24px", color: "var(--ink-secondary)", fontWeight: 700, fontSize: 18 }}>
            Personal Details
          </h3>

          <div style={{ display: "grid", gap: 20 }}>
            {/* Name */}
            <div style={fieldStyle}>
              <span className="field-label" style={{ color: "var(--ink-muted)", fontSize: 13, fontWeight: 600 }}>FULL NAME</span>
              {editing ? (
                <input className="aurora-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{(u.name as string) || "—"}</div>
              )}
            </div>

            {/* Phone */}
            <div style={fieldStyle}>
              <span className="field-label" style={{ color: "var(--ink-muted)", fontSize: 13, fontWeight: 600 }}>PHONE</span>
              {editing ? (
                <input className="aurora-input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(555) 000-0000" />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{(u.phone as string) || "—"}</div>
              )}
            </div>

            {/* Address */}
            <div style={fieldStyle}>
              <span className="field-label" style={{ color: "var(--ink-muted)", fontSize: 13, fontWeight: 600 }}>ADDRESS</span>
              {editing ? (
                <input className="aurora-input" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="123 Green St" />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{(u.address as string) || "—"}</div>
              )}
            </div>

            {/* City/State/Zip Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div>
                <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}>CITY</span>
                {editing ? (
                  <input className="aurora-input" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
                ) : (
                  <div style={{ fontWeight: 600 }}>{(u.city as string) || "—"}</div>
                )}
              </div>
              <div>
                <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}>STATE</span>
                {editing ? (
                  <input className="aurora-input" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="CA" />
                ) : (
                  <div style={{ fontWeight: 600 }}>{(u.state as string) || "—"}</div>
                )}
              </div>
              <div>
                <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}>ZIP</span>
                {editing ? (
                  <input className="aurora-input" value={editZip} onChange={(e) => setEditZip(e.target.value)} placeholder="00000" />
                ) : (
                  <div style={{ fontWeight: 600 }}>{(u.zip as string) || "—"}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Account Status Badges */}
      <section className="glass-card" style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "var(--ink-secondary)", fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>
          Verification Status
        </h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "KYC Verified", done: !!u.kycComplete, icon: "🆔" },
            { label: "Fraud Cleared", done: !!u.fraudClear, icon: "🛡️" },
            { label: "Green Score Active", done: !!u.greenScore, icon: "🌱" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                border: `1px solid ${s.done ? "rgba(16, 185, 129, 0.3)" : "var(--line)"}`,
                background: s.done ? "rgba(16, 185, 129, 0.1)" : "var(--surface-subtle)",
                color: s.done ? "var(--positive)" : "var(--ink-muted)",
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              {s.icon} {s.label}
              {s.done && <span style={{ fontSize: 10, marginLeft: 4 }}>✓</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
