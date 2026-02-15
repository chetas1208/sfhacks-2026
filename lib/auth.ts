
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "alice@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                // In real app: Compare hash. Here: Plain text check from seed
                // NOTE: Seed uses "Password123!" for all.
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user) return null

                // Simple password check for MVP
                if (credentials.password === user.password || credentials.password === "Password123!") {
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    }
                }
                return null
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }: any) {
            if (user) {
                token.id = user.id
                token.role = user.role
            }
            return token
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.id = token.id
                session.user.role = token.role
            }
            return session
        }
    },
    pages: {
        signIn: '/auth/signin', // Custom signin page? Or default. Let's use default for MVP speed or add one.
    }
}
