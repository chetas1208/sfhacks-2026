"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import OnboardingStepper from "@/components/OnboardingStepper";

export default function KycPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verified?: boolean } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    ssn: "1234",
    dob: "1995-06-15",
    address: "123 Green St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    phone: "4151234567",
  });

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (user.kycComplete) {
      router.push("/fraud");
      return;
    }
    setForm((entry) => ({
      ...entry,
      firstName: user.name.split(" ")[0] || "",
      lastName: user.name.split(" ").slice(1).join(" ") || "",
    }));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost("/api/kyc", form);
      setResult(res);
      await refreshUser();
      setTimeout(() => router.push("/fraud"), 2000);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 940, margin: "8px auto", display: "grid", gap: 14 }}>
      <OnboardingStepper currentStep={2} />
      <section className="surface-card" style={{ padding: 24 }}>
        <h2 style={{ color: "#065f46", marginTop: 0, marginBottom: 4 }}>🔐 Identity Verification (KYC)</h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
          Powered by CRS FlexID — LexisNexis verification
        </p>

        {result?.verified ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 54 }}>✅</div>
            <h3 style={{ color: "#059669", margin: "8px 0 4px" }}>Identity Verified</h3>
            <p style={{ color: "#6b7280", margin: 0 }}>Redirecting to fraud check...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {Object.entries(form).map(([key, val]) => (
                <label key={key} style={{ display: "grid", gap: 6 }}>
                  <span className="field-label">
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </span>
                  <input
                    value={val}
                    onChange={(e) => setForm((entry) => ({ ...entry, [key]: e.target.value }))}
                    required
                    className="field-input"
                  />
                </label>
              ))}
            </div>
            <button type="submit" disabled={loading} className="primary-btn" style={{ width: "100%", marginTop: 8 }}>
              {loading ? "Verifying..." : "Verify Identity"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
