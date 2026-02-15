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

    if (loading) return <div style={{ textAlign: "center", color: "var(--ink-soft)", padding: 64 }}>Loading lessons...</div>;

    return (
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
            <section className="surface-card" style={{ padding: 22 }}>
                <h1 className="headline" style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Education Center</h1>
                <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>
                    Learn about sustainability and earn a <strong>1.2x Multiplier</strong> on your next claim!
                </p>
            </section>

            <div style={{ display: "grid", gap: 12 }}>
                {lessons.map((lesson) => (
                    <Link key={lesson.id} href={`/learn/${lesson.id}`} style={{ textDecoration: "none" }}>
                        <div className="surface-card" style={{
                            padding: "18px 20px",
                            borderLeft: "4px solid var(--accent)",
                            cursor: "pointer",
                        }}>
                            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{lesson.title}</h2>
                            <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>Click to read and take the quiz →</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
