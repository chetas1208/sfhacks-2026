import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import AiBotWidget from "@/components/AiBotWidget";

export const metadata: Metadata = {
  title: "Green Energy Credit Bank",
  description: "Earn green credits for sustainable actions — powered by Actian VectorAI DB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
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
