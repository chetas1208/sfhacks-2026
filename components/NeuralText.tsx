"use client";
import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";

interface NeuralTextProps {
    text: string;
    className?: string;
    style?: React.CSSProperties;
    scrambleSpeed?: number;
}

export default function NeuralText({ text, className, style, scrambleSpeed = 30 }: NeuralTextProps) {
    const [displayText, setDisplayText] = useState(text);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const scramble = () => {
        let iteration = 0;

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setDisplayText((prev) =>
                text
                    .split("")
                    .map((char, index) => {
                        if (index < iteration) {
                            return text[index];
                        }
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }

            iteration += 1 / 2; // Speed of decoding (higher denominator = slower)
        }, scrambleSpeed);
    };

    useEffect(() => {
        scramble();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
    }, [text]);

    return (
        <span
            className={className}
            style={style}
            onMouseEnter={scramble}
        >
            {displayText}
        </span>
    );
}
