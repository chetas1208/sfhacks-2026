import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Green Energy Credit Bank",
  description: "Earn green credits for sustainable actions — powered by Actian VectorAI DB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: "#f0fdf4", minHeight: "100vh" }}>
        <Providers>
          <Navbar />
          <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
