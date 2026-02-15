"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
    const { user, logout, loading: authLoading } = useAuth();
    const router = useRouter();
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) router.push("/auth");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem("gecb_token");
            const res = await fetch("/api/profile", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfileData(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>;

    if (!profileData) return null;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                        My Profile
                    </h1>
                    <button onClick={logout} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                        Sign Out
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="text-sm text-gray-400 mb-1">Total Balance</div>
                        <div className="text-3xl font-bold text-green-400">{profileData.balance} <span className="text-lg text-gray-500">Credits</span></div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="text-sm text-gray-400 mb-1">Green Score</div>
                        <div className="text-3xl font-bold text-emerald-400">{profileData.user.greenScore || "N/A"}</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="text-sm text-gray-400 mb-1">Status</div>
                        <div className="flex items-center gap-2 mt-2">
                            {profileData.user.kycComplete ? (
                                <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">KYC Verified</span>
                            ) : (
                                <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">KYC Pending</span>
                            )}
                            {profileData.user.fraudClear ? (
                                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">Fraud Clear</span>
                            ) : (
                                <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full border border-red-500/30">Flagged</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-xl font-semibold mb-6">Recent Transactions</h2>
                    <div className="space-y-4">
                        {profileData.transactions && profileData.transactions.length > 0 ? (
                            profileData.transactions.map((tx: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === "EARN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.type === "EARN" ? "↓" : "↑"}
                                        </div>
                                        <div>
                                            <div className="font-medium">{tx.description}</div>
                                            <div className="text-sm text-gray-500">{new Date(tx.timestamp).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${tx.amount > 0 ? "text-green-400" : "text-white"}`}>
                                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 py-8">No transactions yet</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
