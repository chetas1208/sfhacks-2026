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
      <body className="bg-[#0a0a0a] min-h-screen">
        <Providers>
          <Navbar />
          <main className="pt-20 px-4 max-w-7xl mx-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
