"use client";

import { useSession } from "next-auth/react";

export default function Profile() {
    const { data: session } = useSession();

    if (!session) return null;
    const user = session.user as any;

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
            <h1 className="text-2xl font-bold mb-6">User Profile</h1>

            <div className="space-y-4">
                <div>
                    <label className="block text-gray-500 text-sm">Name</label>
                    <p className="font-medium text-lg">{user.name}</p>
                </div>
                <div>
                    <label className="block text-gray-500 text-sm">Email</label>
                    <p className="font-medium text-lg">{user.email}</p>
                </div>
                <div>
                    <label className="block text-gray-500 text-sm">Role</label>
                    <span className="inline-block bg-gray-200 px-3 py-1 rounded text-sm font-bold mt-1">
                        {user.role}
                    </span>
                </div>
            </div>

            {/* Could fetch multiplier status here too, but simple version for now */}
        </div>
    );
}
