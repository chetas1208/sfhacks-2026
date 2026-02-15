"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Learn() {
    const [lessons, setLessons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/lessons")
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse JSON:", text);
                    return [];
                }
            })
            .then((data) => {
                setLessons(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching lessons:", err);
                setLessons([]);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8">Loading lessons...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Education Center</h1>
            <p className="text-gray-600 mb-8">
                Learn about sustainability and earn a <strong>1.2x Multiplier</strong> on your next claim!
            </p>

            <div className="space-y-4">
                {lessons.map((lesson) => (
                    <Link key={lesson.id} href={`/learn/${lesson.id}`}>
                        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-l-4 border-blue-500">
                            <h2 className="text-xl font-bold mb-2">{lesson.title}</h2>
                            <p className="text-gray-500">Click to read and take the quiz &rarr;</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
