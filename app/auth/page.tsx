"use client";
import React, { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
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
    const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");

    useEffect(() => {
        // Check backend health
        fetch("/api/health")
            .then(res => res.ok ? setServerStatus("online") : setServerStatus("offline"))
            .catch(() => setServerStatus("offline"));
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const data = await login(email, password);

            // Redirect based on flow
            if (data.flow === "kyc") {
                router.push("/kyc");
            } else if (data.flow === "fraud") {
                router.push("/fraud");
            } else {
                router.push("/"); // Dashboard
            }
        } catch (err: any) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const data = await signup(name, email, password);
            router.push("/kyc"); // Signup always goes to KYC
        } catch (err: any) {
            const msg = err.message || "Signup failed";
            setError(msg);
            // If fraud/email exists, user might want to login
            if (msg.toLowerCase().includes("fraud") || msg.toLowerCase().includes("exists")) {
                setTimeout(() => setTab("login"), 2000);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        if (tab === "login") await handleLogin(e);
        else await handleSignup(e);
    };

    const steps = ["Sign In", "KYC", "Fraud Check", "Green Score", "Dashboard"];

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans relative">
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
                <div className={`w-2 h-2 rounded-full ${serverStatus === "online" ? "bg-green-500" : serverStatus === "checking" ? "bg-yellow-500" : "bg-red-500"}`} />
                Backend: {serverStatus.toUpperCase()}
            </div>

            <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600 mb-2">
                        {tab === "login" ? "Welcome Back" : "Join GECB"}
                    </h1>
                    <p className="text-gray-400 text-sm">
                        {tab === "login" ? "Access your eco-portfolio" : "Start your green journey today"}
                    </p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                    {(["login", "signup"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(""); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-green-500 text-white shadow-lg" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {t === "login" ? "Sign In" : "Sign Up"}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    {tab === "signup" && (
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-colors"
                                placeholder="John Doe"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-colors"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
                    >
                        {loading ? "Processing..." : tab === "login" ? "Sign In" : "Create Account"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Protected by Actian VectorAI</span>
                        <div className="flex gap-1">
                            {steps.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-green-500" : "bg-gray-700"}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
