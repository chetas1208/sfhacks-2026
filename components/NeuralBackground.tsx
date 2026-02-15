"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";

type ColorType = "primary" | "secondary" | "accent";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    opacity: number;
    pulse: number;
    pulseSpeed: number;
    colorType: ColorType;
}

export default function NeuralBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { theme } = useTheme();
    const themeRef = useRef(theme);
    const animId = useRef(0);
    const mouseRef = useRef({ x: -1000, y: -1000 });

    useEffect(() => {
        themeRef.current = theme;
    }, [theme]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let W = 0;
        let H = 0;
        const particles: Particle[] = [];
        const CONNECTION_DIST = 160;
        const MOUSE_DIST = 200;
        const PARTICLE_COUNT_FACTOR = 0.00006;

        const makeParticle = (w: number, h: number): Particle => {
            const types: ColorType[] = ["primary", "primary", "secondary", "accent", "primary"];
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                vx: 0,
                vy: Math.random() * 0.5 + 0.2, // Slow downward flow
                radius: Math.random() * 2 + 1.2,
                opacity: Math.random() * 0.5 + 0.3,
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: Math.random() * 0.01 + 0.002,
                colorType: types[Math.floor(Math.random() * types.length)],
            };
        };

        const resize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * devicePixelRatio;
            canvas.height = H * devicePixelRatio;
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;
            ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

            const target = Math.floor(W * H * PARTICLE_COUNT_FACTOR);
            while (particles.length < target) {
                particles.push(makeParticle(W, H));
            }
            while (particles.length > target) {
                particles.pop();
            }
        };

        const getParticleColor = (type: ColorType, dark: boolean, alpha: number) => {
            if (dark) {
                switch (type) {
                    case "primary": return `rgba(52, 211, 153, ${alpha})`; // Emerald
                    case "secondary": return `rgba(167, 139, 250, ${alpha})`; // Violet
                    case "accent": return `rgba(251, 191, 36, ${alpha})`; // Amber
                }
            } else {
                switch (type) {
                    case "primary": return `rgba(16, 185, 129, ${alpha})`; // Emerald
                    case "secondary": return `rgba(139, 92, 246, ${alpha})`; // Violet
                    case "accent": return `rgba(245, 158, 11, ${alpha})`; // Amber
                }
            }
            return `rgba(16, 185, 129, ${alpha})`;
        };

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            const dark = themeRef.current === "dark";

            // Update positions
            for (const p of particles) {
                // Root-like movement: Downward with sine wave oscillation
                p.y += p.vy;
                // Horizontal oscillation based on depth (y) and random pulse offset
                p.x += Math.sin(p.y * 0.01 + p.pulse) * 0.3;
                p.pulse += p.pulseSpeed;

                // Mouse interaction - slight repulsion/flow around
                const dx = mouseRef.current.x - p.x;
                const dy = mouseRef.current.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_DIST) {
                    const force = (MOUSE_DIST - dist) / MOUSE_DIST;
                    // Push away gently
                    p.x -= (dx / dist) * force * 2;
                    p.y -= (dy / dist) * force * 2;
                }

                // Reset when off screen (bottom)
                if (p.y > H + 20) {
                    p.y = -20;
                    p.x = Math.random() * W;
                }
                if (p.x < -50) p.x = W + 50;
                if (p.x > W + 50) p.x = -50;
            }

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                // Connect to other particles
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * (dark ? 0.15 : 0.12);
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = getParticleColor(particles[i].colorType, dark, alpha);
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }

                // Connect to mouse
                const dx = particles[i].x - mouseRef.current.x;
                const dy = particles[i].y - mouseRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_DIST) {
                    const alpha = (1 - dist / MOUSE_DIST) * (dark ? 0.4 : 0.3);
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
                    ctx.strokeStyle = getParticleColor(particles[i].colorType, dark, alpha);
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Draw particles
            for (const p of particles) {
                const glow = Math.sin(p.pulse) * 0.3 + 0.8;
                const alpha = p.opacity * glow;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius * glow, 0, Math.PI * 2);
                ctx.fillStyle = getParticleColor(p.colorType, dark, alpha * 0.8);
                ctx.fill();

                if (p.radius > 1.8) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius * 3 * glow, 0, Math.PI * 2);
                    ctx.fillStyle = getParticleColor(p.colorType, dark, alpha * 0.1);
                    ctx.fill();
                }
            }

            animId.current = requestAnimationFrame(draw);
        };

        resize();
        draw();
        window.addEventListener("resize", resize);

        return () => {
            cancelAnimationFrame(animId.current);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
                opacity: 0.75,
            }}
        />
    );
}

