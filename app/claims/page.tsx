"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function MyClaims() {
    const { status } = useSession();
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "authenticated") {
            fetch("/api/claims")
                .then((res) => res.json())
                .then((data) => {
                    setClaims(data);
                    setLoading(false);
                });
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [status]);

    if (loading) return <div className="p-8">Loading claims...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">My Claims</h1>
                <Link
                    href="/submit"
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                    New Claim
                </Link>
            </div>

            {claims.length === 0 ? (
                <p className="text-gray-500">You haven't submitted any claims yet.</p>
            ) : (
                <div className="grid gap-4">
                    {claims.map((claim) => (
                        <div key={claim.id} className="bg-white p-4 rounded shadow border border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-lg">{claim.actionType.title}</h3>
                                <p className="text-sm text-gray-500">
                                    Submitted on {new Date(claim.submittedAt).toLocaleDateString()}
                                </p>
                                <p className="text-gray-700 mt-1">{claim.description}</p>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${claim.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        claim.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {claim.status}
                                </span>
                                {claim.creditsAwarded && (
                                    <p className="text-sm font-bold text-green-600 mt-1">+{claim.creditsAwarded} Credits</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
