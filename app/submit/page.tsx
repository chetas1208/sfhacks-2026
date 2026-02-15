"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiUpload } from "@/lib/api";

interface ActionType { code: string; title: string; baseCredits: number; icon: string; }

export default function SubmitPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [types, setTypes] = useState<ActionType[]>([]);
    const [selected, setSelected] = useState("");
    const [desc, setDesc] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [ocrResult, setOcrResult] = useState<{ detected_total?: number; greenCredits?: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (!user) { router.push("/auth"); return; }
        apiGet("/api/action-types").then(setTypes).catch(console.error);
    }, [user, router]);

    const scanReceipt = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const res = await apiUpload("/api/ocr", file);
            setOcrResult(res);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected) return;
        setLoading(true);
        try {
            await apiPost("/api/claims", { actionTypeCode: selected, description: desc });
            setMsg("✅ Green action submitted for review!");
            setSelected(""); setDesc(""); setFile(null); setOcrResult(null);
        } catch (err: unknown) {
            setMsg(err instanceof Error ? `❌ ${err.message}` : "Failed to submit");
        }
        setLoading(false);
    };

    return (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ color: "#065f46" }}>📝 Submit Green Action</h1>

            {msg && <div style={{ padding: 12, background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", borderRadius: 8, marginBottom: 16, fontSize: 14, color: msg.startsWith("✅") ? "#065f46" : "#991b1b" }}>{msg}</div>}

            <form onSubmit={submit}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0, color: "#374151" }}>Select Action Type</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {types.map(t => (
                            <button key={t.code} type="button" onClick={() => setSelected(t.code)} style={{
                                padding: 12, borderRadius: 10, cursor: "pointer", textAlign: "left",
                                border: selected === t.code ? "2px solid #059669" : "1px solid #e5e7eb",
                                background: selected === t.code ? "#f0fdf4" : "#fff",
                            }}>
                                <span style={{ fontSize: 24 }}>{t.icon}</span>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginTop: 4 }}>{t.title}</div>
                                <div style={{ fontSize: 12, color: "#059669" }}>+{t.baseCredits} credits</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0, color: "#374151" }}>Description</h3>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} required placeholder="Describe your green action..."
                        style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, minHeight: 80, resize: "vertical", boxSizing: "border-box" }} />
                </div>

                <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0, color: "#374151" }}>📸 Evidence (Optional)</h3>
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
                        style={{ marginBottom: 12 }} />
                    {file && (
                        <button type="button" onClick={scanReceipt} disabled={loading} style={{
                            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: "#0d9488", color: "#fff", fontSize: 13, fontWeight: 500,
                        }}>{loading ? "Scanning..." : "🔍 Scan with OCR"}</button>
                    )}
                    {ocrResult && (
                        <div style={{ marginTop: 12, padding: 12, background: "#f0fdf4", borderRadius: 8 }}>
                            <div style={{ fontSize: 14, color: "#065f46" }}>💵 Detected: ${ocrResult.detected_total?.toFixed(2)}</div>
                            {ocrResult.greenCredits && <div style={{ fontSize: 14, color: "#059669", fontWeight: 600 }}>+{ocrResult.greenCredits} green credits</div>}
                        </div>
                    )}
                </div>

                <button type="submit" disabled={loading || !selected} style={{
                    width: "100%", padding: 14, borderRadius: 8, border: "none", cursor: "pointer",
                    background: (!selected || loading) ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, fontSize: 16,
                }}>{loading ? "Submitting..." : "Submit Green Action"}</button>
            </form>
        </div>
    );
}
