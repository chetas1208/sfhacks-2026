"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function SubmitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState("Bart");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const CATEGORIES = ["Bart", "CalTrain", "MUNI", "Bike charging", "EV charging"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setMessage(data.detail || "Submission failed");
      }
    } catch {
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
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(220,38,38,0.28)",
                background: "rgba(220,38,38,0.08)",
                color: "#7f1d1d",
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
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
