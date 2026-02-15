"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function SubmitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState("EV charging");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<{
    estimatedPoints?: number;
    lineCount?: number;
    linesPreview?: string[];
    warning?: string | null;
  } | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const CATEGORIES = ["Bart", "CalTrain", "MUNI", "Bike charging", "EV charging"];

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
      setMessage(data.warning ? "Image analyzed with warning. Please verify values." : "Image analyzed successfully.");
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
        router.push("/profile");
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

  if (authLoading) {
    return <div style={{ textAlign: "center", color: "#6f8d85", padding: 64 }}>Loading submit form...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
      <section className="surface-card" style={{ padding: 24 }}>
        <h1 className="headline" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
          Submit Green Action
        </h1>
        <p className="hero-subtext">Add your eco-friendly action and earn verified points.</p>
      </section>

      <section className="surface-card" style={{ padding: 22 }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="upload-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="field-label" style={{ fontSize: 13, color: "#0f5f4e" }}>Invoice Image</span>
              {analysis?.estimatedPoints !== undefined ? (
                <span className="upload-pill">Estimated points: {analysis.estimatedPoints}</span>
              ) : null}
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            <button type="button" className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Receipt preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">📸</div>
              )}
              <div style={{ display: "grid", gap: 3, flex: 1 }}>
                <div style={{ color: "#174c40", fontWeight: 800, fontSize: 14 }}>
                  {receiptImage ? receiptImage.name : "Choose invoice image"}
                </div>
                <div style={{ color: "#68867f", fontSize: 12 }}>
                  {receiptImage ? `${fileSizeLabel} • JPG / PNG / WEBP` : "Upload a clear invoice photo for auto extraction"}
                </div>
              </div>
              <span className="upload-cta">{receiptImage ? "Replace" : "Browse"}</span>
            </button>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="ghost-btn"
                disabled={!receiptImage || analyzing}
                onClick={() => {
                  if (receiptImage) void analyzeImage(receiptImage);
                }}
              >
                {analyzing ? "Analyzing..." : "Analyze Image"}
              </button>

              {receiptImage ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setReceiptImage(null);
                    setAnalysis(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Receipt Number</span>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="field-input"
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
                className="field-input"
                placeholder="0.00"
                required
              />
            </label>
          </div>

          {analysis?.linesPreview?.length ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(9,76,64,0.14)",
                background: "rgba(255,255,255,0.72)",
                padding: "10px 12px",
              }}
            >
              <div style={{ color: "#0f5f4e", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                Extracted Text Preview ({analysis.lineCount} lines)
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {analysis.linesPreview.slice(0, 6).map((line, idx) => (
                  <div key={`${idx}-${line}`} style={{ fontSize: 12, color: "#5d7b73" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field-input"
              placeholder="Describe your trip or activity..."
              style={{ minHeight: 120, resize: "vertical" }}
            />
          </label>

          {message ? (
            <div className={`status-banner ${messageTone}`}>
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="primary-btn" style={{ width: "100%" }}>
            {loading ? "Submitting..." : "Submit Claim"}
          </button>
        </form>
      </section>
    </div>
  );
}
