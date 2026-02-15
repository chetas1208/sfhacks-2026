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
    ssn: "",
    dob: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", display: "grid", gap: 24 }}>
      <OnboardingStepper currentStep={2} />

      <section className="glass-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 className="headline-gradient" style={{ margin: "0 0 8px", fontSize: 24 }}>Identity Verification</h2>
          <p style={{ color: "var(--ink-secondary)", fontSize: 14, margin: 0 }}>
            Securely powered by CRS FlexID & LexisNexis
          </p>
        </div>

        {result?.verified ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{
              width: 80, height: 80,
              background: "var(--positive-bg)",
              color: "var(--positive)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, margin: "0 auto 20px"
            }}>
              ✅
            </div>
            <h3 style={{ color: "var(--ink)", margin: "0 0 8px", fontSize: 22 }}>Verified Successfully</h3>
            <p style={{ color: "var(--ink-secondary)", margin: 0 }}>Redirecting you to fraud check...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* First Name */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">FIRST NAME</span>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="First Name"
                />
              </label>

              {/* Last Name */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">LAST NAME</span>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="Last Name"
                />
              </label>

              {/* SSN - Custom Label */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">LAST 4 DIGITS OF SSN</span>
                <input
                  name="ssn"
                  value={form.ssn}
                  onChange={handleChange}
                  required
                  maxLength={4}
                  className="aurora-input"
                  placeholder="e.g. 1234"
                />
              </label>

              {/* DOB - Date Input */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">DATE OF BIRTH</span>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                />
              </label>

              {/* Address - Full Width */}
              <label style={{ display: "grid", gap: 6, gridColumn: "span 2" }}>
                <span className="label-text">ADDRESS</span>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="Street Address"
                />
              </label>

              {/* City */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">CITY</span>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="City"
                />
              </label>

              {/* State */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">STATE</span>
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="State"
                />
              </label>

              {/* Zip */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">ZIP CODE</span>
                <input
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  required
                  className="aurora-input"
                  placeholder="Zip Code"
                />
              </label>

              {/* Phone */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="label-text">PHONE</span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  type="tel"
                  className="aurora-input"
                  placeholder="Phone Number"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="aurora-btn"
              style={{ width: "100%", marginTop: 12, fontSize: 16 }}
            >
              {loading ? (
                <span className="spinner" style={{ marginRight: 8 }} />
              ) : "🔒 Verify Identity"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)", margin: "12px 0 0" }}>
              Your data is encrypted and never shared without consent.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
