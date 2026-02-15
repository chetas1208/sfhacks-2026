"use client";
import { AuthProvider } from "./AuthContext";
import { CartProvider } from "./CartContext";
import { ThemeProvider } from "./ThemeContext";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <CartProvider>{children}</CartProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
