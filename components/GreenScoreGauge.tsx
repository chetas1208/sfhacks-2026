"use client";
import { useEffect, useState, useRef } from "react";

interface Props {
    score: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
}

export default function GreenScoreGauge({ score, size = 200, strokeWidth = 14, label }: Props) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [mounted, setMounted] = useState(false);
    const rafRef = useRef(0);

    useEffect(() => {
        setMounted(true);
        let start: number | null = null;
        const duration = 1200;
        const from = 0;
        const to = score;

        const animate = (ts: number) => {
            if (!start) start = ts;
            const elapsed = ts - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedScore(Math.round(from + (to - from) * eased));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [score]);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(animatedScore / 1000, 1);
    // 270° arc (3/4 circle, gap at bottom)
    const arcLength = circumference * 0.75;
    const dashOffset = arcLength - pct * arcLength;

    // Color based on score range
    const getColor = (s: number): string => {
        if (s < 400) return "#ef4444";      // red
        if (s < 550) return "#f59e0b";      // amber
        if (s < 700) return "#10b981";      // green
        if (s < 850) return "#059669";      // emerald
        return "#0d9488";                    // teal
    };

    const getRating = (s: number): string => {
        if (s < 400) return "Poor";
        if (s < 550) return "Fair";
        if (s < 700) return "Good";
        if (s < 850) return "Excellent";
        return "Outstanding";
    };

    const color = getColor(animatedScore);
    const rating = getRating(animatedScore);

    if (!mounted) return null;

    return (
        <div style={{ position: "relative", width: size, height: size }}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ transform: "rotate(135deg)" }}
            >
                {/* Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--progress-track)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeLinecap="round"
                />
                {/* Active arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{
                        transition: "stroke 0.3s ease",
                        filter: `drop-shadow(0 0 8px ${color}66)`,
                    }}
                />
            </svg>

            {/* Center text */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: strokeWidth,
                }}
            >
                <span
                    style={{
                        fontSize: size * 0.2,
                        fontWeight: 900,
                        color: "var(--ink)",
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                    }}
                >
                    {animatedScore}
                </span>
                <span
                    style={{
                        fontSize: size * 0.065,
                        color: "var(--ink-muted)",
                        fontWeight: 600,
                        marginTop: 2,
                    }}
                >
                    / 1000
                </span>
                <span
                    style={{
                        fontSize: size * 0.07,
                        fontWeight: 800,
                        color,
                        marginTop: 4,
                        transition: "color 0.3s ease",
                    }}
                >
                    {rating}
                </span>
                {label && (
                    <span
                        style={{
                            fontSize: size * 0.055,
                            color: "var(--ink-soft)",
                            marginTop: 2,
                        }}
                    >
                        {label}
                    </span>
                )}
            </div>

            {/* Scale markers */}
            <div
                style={{
                    position: "absolute",
                    bottom: size * 0.08,
                    left: size * 0.1,
                    fontSize: size * 0.05,
                    color: "var(--ink-faint)",
                    fontWeight: 700,
                }}
            >
                0
            </div>
            <div
                style={{
                    position: "absolute",
                    bottom: size * 0.08,
                    right: size * 0.04,
                    fontSize: size * 0.05,
                    color: "var(--ink-faint)",
                    fontWeight: 700,
                }}
            >
                1000
            </div>
        </div >
    );
}
