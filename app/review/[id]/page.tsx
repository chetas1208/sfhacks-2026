"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function ReviewDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [claim, setClaim] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        fetch(`/api/claims/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => {
                setClaim(data);
                setLoading(false);
            })
            .catch(() => router.push("/review"));
    }, [id, router]);

    const handleVote = async (approve: boolean) => {
        setVoting(true);
        try {
            const res = await fetch("/api/review/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claimId: id, vote: approve })
            });
            if (!res.ok) throw new Error("Vote failed");
            router.push("/review");
        } catch (err) {
            alert("Error voting");
            setVoting(false);
        }
    };

    if (loading || !claim) return <div className="p-8">Loading...</div>;

    const aiHints = claim.aiHintJson ? JSON.parse(claim.aiHintJson) : null;

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded shadow">
                    <h1 className="text-2xl font-bold mb-2">{claim.actionType.title}</h1>
                    <p className="text-gray-600 mb-4">
                        Submitted by <b>{claim.user.name}</b> on {new Date(claim.submittedAt).toLocaleString()}
                    </p>

                    <div className="bg-gray-50 p-4 rounded mb-4">
                        <h3 className="font-semibold text-sm text-gray-500 uppercase">Description</h3>
                        <p className="mt-1">{claim.description}</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded mb-4">
                        <h3 className="font-semibold text-sm text-gray-500 uppercase">Evidence</h3>
                        {claim.evidenceUrl ? (
                            <div className="mt-2 relative h-64 w-full">
                                {/* Using standard img for local dev simplicity if Image domain not configured, 
                    but requirement says Next.js + standard. 
                    I'll use img tag to avoid domain config issues with 'localhost' or 'uploads' 
                    since I implemented local storage. */}
                                <img
                                    src={claim.evidenceUrl}
                                    alt="Evidence"
                                    className="rounded object-contain w-full h-full bg-gray-200"
                                />
                            </div>
                        ) : (
                            <p className="text-gray-500 italic mt-1">No file uploaded.</p>
                        )}
                    </div>
                </div>

                {/* Voting Actions */}
                <div className="bg-white p-6 rounded shadow flex justify-between items-center">
                    <p className="text-gray-600">Review this claim:</p>
                    <div className="space-x-4">
                        <button
                            onClick={() => handleVote(false)}
                            disabled={voting}
                            className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 font-medium disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleVote(true)}
                            disabled={voting}
                            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                </div>
            </div>

            {/* Sidebar: AI & Similarity */}
            <div className="space-y-6">
                {/* AI Hints */}
                <div className="bg-blue-50 p-6 rounded shadow border border-blue-100">
                    <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                        🤖 AI Analysis
                    </h2>
                    {aiHints ? (
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Confidence:</span>
                                <span className="font-bold">{(aiHints.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="text-gray-600 block">Label Guess:</span>
                                <span className="font-medium bg-white px-2 py-1 rounded border inline-block mt-1">
                                    {aiHints.labelGuess}
                                </span>
                            </div>
                            {aiHints.warnings && aiHints.warnings.length > 0 && (
                                <div className="bg-yellow-100 p-2 rounded text-yellow-800">
                                    <strong>Warnings:</strong>
                                    <ul className="list-disc ml-4 mt-1">
                                        {aiHints.warnings.map((w: string, i: number) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mt-2">No AI analysis available.</p>
                    )}
                </div>

                {/* Similar Claims */}
                <div className="bg-white p-6 rounded shadow">
                    <h2 className="text-lg font-bold mb-4">Similar Claims</h2>
                    {claim.similar && claim.similar.length > 0 ? (
                        <div className="space-y-3">
                            {claim.similar.map((sim: any) => (
                                <div key={sim.id} className="text-sm border-b pb-2 last:border-0 hover:bg-gray-50 p-2 rounded">
                                    <p className="font-medium text-gray-800">{sim.metadata.title}</p>
                                    <p className="text-gray-500 truncate">{sim.metadata.description}</p>
                                    <div className="flex justify-between mt-1 text-xs text-gray-400">
                                        <span>{new Date(sim.metadata.occurredAt).toLocaleDateString()}</span>
                                        <span>{(sim.score * 100).toFixed(0)}% match</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No similar claims found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
