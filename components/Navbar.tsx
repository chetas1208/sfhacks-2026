"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-nav h-16 flex items-center justify-between px-6 transition-all duration-300">
            <Link href="/" className="flex items-center gap-2 group">
                <span className="text-2xl transition-transform group-hover:scale-110">🌿</span>
                <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">
                    GreenBank
                </span>
            </Link>

            <div className="flex items-center gap-6">
                {user ? (
                    <>
                        <Link href="/submit" className="text-sm font-medium text-gray-300 hover:text-green-400 transition-colors">
                            Submit Action
                        </Link>
                        <Link href="/marketplace" className="text-sm font-medium text-gray-300 hover:text-green-400 transition-colors">
                            Marketplace
                        </Link>

                        <div className="h-4 w-px bg-white/10 mx-2" />

                        <Link href="/profile" className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-full transition-all group">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-green-900/20">
                                {user.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white">
                                {user.name}
                            </span>
                        </Link>

                        <button
                            onClick={logout}
                            className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all border border-red-500/20 hover:border-red-500/40"
                        >
                            Log Out
                        </button>
                    </>
                ) : (
                    <Link href="/auth" className="btn-primary text-sm shadow-lg shadow-green-900/20">
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
    );
}
