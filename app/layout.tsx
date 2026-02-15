import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import AiBotWidget from "@/components/AiBotWidget";

import NeuralBackground from "@/components/NeuralBackground";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: '.greeniFy+',
  description: 'Track your environmental impact, earn green credits, and redeem smarter rewards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <Providers>
          <div className="app-shell">
            <NeuralBackground />
            <div className="ambient-orb one" />
            <div className="ambient-orb two" />
            <Navbar />
            <main className="main-wrap">{children}</main>
            <AiBotWidget />
          </div>
        </Providers>
      </body>
    </html>
  );
}
