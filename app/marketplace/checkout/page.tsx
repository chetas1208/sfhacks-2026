"use client";

import { useCart } from "@/components/CartContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Checkout() {
    const { items, removeFromCart, totalCost, clearCart } = useCart();
    const { data: session } = useSession();
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetch("/api/wallet")
            .then(res => res.json())
            .then(data => setBalance(data.balance || 0))
            .catch(console.error);
    }, []);

    const handleCheckout = async () => {
        if (totalCost > balance) {
            setError("Insufficient funds.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            // Sequentially redeem for MVP, or bulk API.
            // Let's do sequential to reuse existing /api/redeem 
            // OR create a bulk API. Sequential is easier for now but bulk is better.
            // I'll update /api/redeem to assume bulk for efficiency if possible, 
            // OR just loop here. Looping is easiest without changing backend validation logic too much.

            // Loop through items (considering quantity)
            for (const item of items) {
                for (let i = 0; i < item.quantity; i++) {
                    const res = await fetch("/api/redeem", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rewardId: item.id })
                    });
                    if (!res.ok) {
                        const j = await res.json();
                        throw new Error(j.error || "Redemption failed");
                    }
                }
            }

            setSuccess(true);
            clearCart();
            setTimeout(() => router.push("/marketplace"), 3000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto text-center p-12">
                <h2 className="text-3xl font-bold text-green-600 mb-4">Redemption Successful!</h2>
                <p>Your rewards have been claimed. Redirecting...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <Link href="/marketplace" className="text-gray-500 hover:text-gray-800 flex items-center mb-6">
                <ArrowLeft size={16} className="mr-1" /> Back to Marketplace
            </Link>

            <h1 className="text-3xl font-bold mb-8">Checkout</h1>

            {items.length === 0 ? (
                <p className="text-gray-500">Your cart is empty.</p>
            ) : (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold">{item.title}</div>
                                        <div className="text-sm text-gray-500">{item.description}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">{item.quantity}</td>
                                    <td className="px-6 py-4 text-right">{item.cost * item.quantity}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={2} className="px-6 py-4 font-bold text-right">Total</td>
                                <td className="px-6 py-4 font-bold text-right text-green-700">{totalCost}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {items.length > 0 && (
                <div className="mt-8 flex flex-col items-end">
                    <div className="text-right mb-4">
                        <p className="text-gray-600">Current Balance: <span className="font-bold">{balance}</span></p>
                        <p className={`text-sm ${balance >= totalCost ? 'text-green-600' : 'text-red-600'}`}>
                            {balance >= totalCost ? 'Success: Sufficient funds' : 'Error: Insufficient funds'}
                        </p>
                    </div>

                    {error && <p className="text-red-600 mb-4">{error}</p>}

                    <button
                        onClick={handleCheckout}
                        disabled={loading || balance < totalCost}
                        className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Processing..." : "Confirm Redemption"}
                    </button>
                </div>
            )}
        </div>
    );
}
