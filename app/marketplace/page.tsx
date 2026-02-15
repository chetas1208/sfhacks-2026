"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function MarketplacePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [activeTab, setActiveTab] = useState("product"); // "product" or "offer"
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<number | null>(null);

    useEffect(() => {
        if (!authLoading && !user) router.push("/auth");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("gecb_token");

            // Fetch wallet
            const walletRes = await fetch("/api/wallet", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (walletRes.ok) {
                const w = await walletRes.json();
                setBalance(w.balance);
            }

            // Fetch marketplace items
            const marketRes = await fetch("/api/marketplace");
            if (marketRes.ok) {
                const data = await marketRes.json();
                setItems(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async (item: any) => {
        if (balance < item.cost) return;
        setPurchasing(item._id);
        try {
            const token = localStorage.getItem("gecb_token");

            // Passing item_id as query param to match backend expectation
            const res = await fetch(`/api/marketplace/redeem?item_id=${item._id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setBalance(data.new_balance);
                alert(`Successfully redeemed: ${item.title}`);
            } else {
                const err = await res.json();
                alert(err.detail || "Redemption failed");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setPurchasing(null);
        }
    };

    const filteredItems = items.filter(i => (i.type || "product") === activeTab);

    if (authLoading || loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                            Marketplace
                        </h1>
                        <p className="text-gray-400 mt-1">Redeem your credits for eco-friendly rewards</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Your Balance:</span>
                        <span className="text-2xl font-bold text-green-400">{balance}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Credits</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                    {["product", "offer"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg transition-all capitalize ${activeTab === tab
                                ? "bg-green-500/20 text-green-400 font-bold"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {tab}s
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map((item) => (
                        <div key={item._id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-green-500/30 transition-all group">
                            <div className="h-48 bg-gray-800 relative">
                                {/* Placeholder image logic */}
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                    {item.image ? (
                                        <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <span className="text-4xl">🛍️</span>
                                    )}
                                </div>
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white border border-white/10">
                                    {item.cost} Credits
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                <p className="text-gray-400 text-sm mb-4 min-h-[40px]">{item.description}</p>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleRedeem(item)}
                                        disabled={balance < item.cost || purchasing === item._id}
                                        className={`w-full py-3 rounded-xl font-bold transition-all ${balance >= item.cost
                                            ? "bg-white text-black hover:bg-green-400 hover:text-black"
                                            : "bg-white/10 text-gray-500 cursor-not-allowed"
                                            }`}
                                    >
                                        {purchasing === item._id ? "Processing..." : balance >= item.cost ? "Redeem" : "Insufficient Credits"}
                                    </button>
                                    <div className="text-center text-xs text-gray-500">
                                        {item.inventory !== undefined ? `${item.inventory} left` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        No {activeTab}s available currently.
                    </div>
                )}
            </div>
        </div>
    );
}
