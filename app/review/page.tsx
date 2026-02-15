"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ReviewQueue() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            const user = session?.user as any;
            if (user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
                router.push("/");
                return;
            }

            fetch("/api/review/queue")
                .then((res) => res.json())
                .then((data) => {
                    setClaims(data);
                    setLoading(false);
                });
        }
    }, [status, session, router]);

    if (loading) return <div className="p-8">Loading queue...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Review Queue</h1>

            {claims.length === 0 ? (
                <p className="text-gray-500">No pending claims to review.</p>
            ) : (
                <div className="grid gap-4">
                    {claims.map((claim) => (
                        <Link key={claim.id} href={`/review/${claim.id}`}>
                            <div className="bg-white p-4 rounded shadow border border-gray-100 hover:shadow-md transition cursor-pointer">
                                <div className="flex justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg">{claim.actionType.title}</h3>
                                        <p className="text-sm text-gray-500">
                                            By {claim.user.name || claim.user.email} • {new Date(claim.submittedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className="text-blue-600 text-sm font-medium">Review &rarr;</span>
                                </div>
                                <p className="text-gray-700 mt-2 truncate">{claim.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
