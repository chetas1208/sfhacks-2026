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
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    category,
                    date,
                    description,
                    receiptNumber,
                    amount: parseFloat(amount)
                }),
            });

            if (res.ok) {
                router.push("/profile");
            } else {
                const data = await res.json();
                setMessage(data.detail || "Submission failed");
            }
        } catch (err) {
            setMessage("Error submitting claim");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <div className="max-w-2xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                    Submit Green Action
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-green-500"
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-green-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Receipt Number</label>
                            <input
                                type="text"
                                value={receiptNumber}
                                onChange={(e) => setReceiptNumber(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-green-500"
                                placeholder="REC-12345"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Bill Amount ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-green-500"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-green-500 h-32"
                            placeholder="Describe your trip or activity..."
                        />
                    </div>

                    {message && <div className="mt-2 text-sm text-yellow-500">{message}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? "Submitting..." : "Submit Claim"}
                    </button>
                </form>
            </div>
        </div>
    );
}
