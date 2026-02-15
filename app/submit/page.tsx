"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function SubmitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form State
  const [category, setCategory] = useState("EV charging");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptImage, setReceiptImage] = useState<File | null>(null);

  // Analysis State
  const [analysis, setAnalysis] = useState<{
    estimatedPoints?: number;
    lineCount?: number;
    linesPreview?: string[];
    warning?: string | null;
  } | null>(null);

  // UI State
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // New: Submitted State for Print View
  const [submittedData, setSubmittedData] = useState<{
    category: string;
    date: string;
    description: string;
    receiptNumber: string;
    amount: string;
    points: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const CATEGORIES = ["Bart", "CalTrain", "MUNI", "Bike charging", "EV charging"];
  const POINTS_PER_USD = 0.5; // $1 = 0.5 points

  const handleFileSelected = (selected: File | null) => {
    setReceiptImage(selected);
    if (selected) void analyzeImage(selected);
  };

  const fileSizeLabel = receiptImage
    ? receiptImage.size / 1024 < 1024
      ? `${Math.max(1, Math.round(receiptImage.size / 1024))} KB`
      : `${(receiptImage.size / (1024 * 1024)).toFixed(2)} MB`
    : "";

  useEffect(() => {
    if (!receiptImage) {
      setImagePreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(receiptImage);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [receiptImage]);

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    setMessage("");
    setMessageTone("info");
    setAnalysis(null);
    try {
      const token = localStorage.getItem("gecb_token");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/claims/analyze-image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Image analysis failed");
      }

      if (data.category) setCategory(data.category);
      if (data.date) setDate(data.date);
      if (data.receiptNumber) setReceiptNumber(String(data.receiptNumber));
      if (typeof data.amount === "number") setAmount(String(data.amount));
      if (!description && data.description) setDescription(String(data.description));

      setAnalysis({
        estimatedPoints: data.estimatedPoints,
        lineCount: data.lineCount,
        linesPreview: data.linesPreview || [],
        warning: data.warning || null,
      });
      setMessageTone(data.warning ? "info" : "success");
      setMessage(data.warning ? "⚠️ Image analyzed — please verify extracted values." : "✅ Image analyzed & fields auto-filled!");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Image analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptImage) {
      setMessageTone("error");
      setMessage("Please upload an invoice image first.");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("gecb_token");
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          date,
          description,
          receiptNumber,
          amount: parseFloat(amount),
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const amountNum = parseFloat(amount);
        const pts =
          typeof data.points === "number"
            ? data.points
            : Number.isFinite(amountNum)
              ? Math.round(amountNum * POINTS_PER_USD * 100) / 100
              : 0;
        setSubmittedData({
          category,
          date,
          description,
          receiptNumber,
          amount,
          points: pts,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const data = await res.json();
        setMessageTone("error");
        setMessage(data.detail || "Submission failed");
      }
    } catch {
      setMessageTone("error");
      setMessage("Error submitting claim");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelected(file);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading) {
    return <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 64 }}>Loading submit form...</div>;
  }

  if (!user) {
    return null;
  }

  // SUCCESS VIEW (Printable)
  if (submittedData) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
        <div className="glass-card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{
            width: 100, height: 100,
            margin: "0 auto 24px",
            position: "relative",
          }}>
            <img src="/brand-logo-cropped.png" alt="Greenify Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h2 className="headline" style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Claim Submitted!</h2>
          <p style={{ color: "var(--ink-secondary)", marginBottom: 32 }}>
            Your green action has been logged and points have been added to your wallet.
          </p>

          <div className="invoice-box" style={{
            background: "var(--surface-subtle)",
            borderRadius: 16,
            padding: 24,
            textAlign: "left",
            border: "1px dashed var(--line-strong)",
            marginBottom: 32
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--ink-muted)", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              Transaction Receipt
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, fontSize: 14 }}>
              <span style={{ color: "var(--ink-secondary)" }}>Date</span>
              <span style={{ fontWeight: 600 }}>{submittedData.date}</span>

              <span style={{ color: "var(--ink-secondary)" }}>Category</span>
              <span style={{ fontWeight: 600 }}>{submittedData.category}</span>

              <span style={{ color: "var(--ink-secondary)" }}>Receipt #</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{submittedData.receiptNumber}</span>

              <div style={{ height: 1, background: "var(--line)", gridColumn: "span 2", margin: "4px 0" }} />

              <span style={{ color: "var(--ink-secondary)", fontWeight: 700 }}>Amount</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>${submittedData.amount}</span>

              <span style={{ color: "var(--primary)", fontWeight: 700 }}>Points Earned</span>
              <span style={{ color: "var(--primary)", fontWeight: 800, fontSize: 16 }}>
                +{Number.isInteger(submittedData.points) ? submittedData.points : submittedData.points.toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }} className="no-print">
            <button onClick={handlePrint} className="aurora-btn" style={{ background: "var(--surface-strong)", color: "var(--ink)", border: "1px solid var(--line-strong)" }}>
              🖨️ Print Invoice
            </button>
            <button onClick={() => router.push("/profile")} className="aurora-btn">
              Go to Profile →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORM VIEW
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      {/* Header */}
      <section className="glass-card" style={{ padding: "26px 24px" }}>
        <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
          Submit Green Action
        </h1>
      </section>

      <section className="glass-card" style={{ padding: 22 }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {/* ─── Upload Panel ──── */}
          <div className="upload-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📸</span>
                <span className="field-label" style={{ fontSize: 13, color: "var(--ink-secondary)" }}>Invoice Image</span>
              </div>
              {analysis?.estimatedPoints !== undefined ? (
                <span className="upload-pill">
                  ⚡ {analysis.estimatedPoints} estimated pts
                </span>
              ) : null}
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            <button
              type="button"
              className={`upload-dropzone${dragOver ? " drag-active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Receipt preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
              )}
              <div style={{ display: "grid", gap: 3, flex: 1 }}>
                <div style={{ color: "var(--ink-secondary)", fontWeight: 800, fontSize: 14 }}>
                  {receiptImage ? receiptImage.name : "Drop your invoice here or click to browse"}
                </div>
                <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                  {receiptImage ? `${fileSizeLabel} · JPG / PNG / WEBP` : "AI auto-fills category, date, amount & receipt #"}
                </div>
              </div>
              <span className="upload-cta">{receiptImage ? "Replace" : "Browse"}</span>
            </button>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="ghost-btn"
                disabled={!receiptImage || analyzing}
                onClick={() => { if (receiptImage) void analyzeImage(receiptImage); }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {analyzing ? (
                  <>
                    <span className="spinner" />
                    Analyzing...
                  </>
                ) : (
                  <>🔍 Re-analyze</>
                )}
              </button>

              {receiptImage ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setReceiptImage(null);
                    setAnalysis(null);
                    setMessage("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  style={{ color: "var(--negative)" }}
                >
                  ✕ Remove
                </button>
              ) : null}
            </div>
          </div>

          {/* ─── Extracted Text Preview ──── */}
          {analysis?.linesPreview?.length ? (
            <div className="ocr-preview">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ color: "var(--ink-secondary)", fontSize: 12, fontWeight: 800 }}>
                  🔤 Extracted Text
                </div>
                <span style={{ color: "var(--ink-muted)", fontSize: 11, fontWeight: 600 }}>
                  {analysis.lineCount} lines detected
                </span>
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {analysis.linesPreview.slice(0, 6).map((line, idx) => (
                  <div key={`${idx}-${line}`} className="ocr-line">
                    <span style={{ color: "var(--accent)", fontSize: 10, fontWeight: 700, minWidth: 18 }}>{idx + 1}</span>
                    {line}
                  </div>
                ))}
              </div>
              {(analysis.lineCount ?? 0) > 6 && (
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 6, fontStyle: "italic" }}>
                  …and {(analysis.lineCount ?? 0) - 6} more lines
                </div>
              )}
            </div>
          ) : null}

          {/* ─── Form Fields ──── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="aurora-input">
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="aurora-input" />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Receipt Number</span>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="aurora-input"
                placeholder="REC-12345"
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Bill Amount ($)</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="aurora-input"
                placeholder="0.00"
                required
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="aurora-input"
              placeholder="Describe your trip or activity..."
              style={{ minHeight: 120, resize: "vertical" }}
            />
          </label>

          {/* ─── Status Message ──── */}
          {message ? (
            <div className={`status-banner ${messageTone}`}>
              {message}
            </div>
          ) : null}

          {/* ─── Submit ──── */}
          <button type="submit" disabled={loading} className="aurora-btn" style={{ width: "100%" }}>
            {loading ? "Submitting..." : "Submit Claim"}
          </button>
        </form>
      </section>
    </div>
  );
}
