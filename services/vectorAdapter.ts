
import { PrismaClient } from '@prisma/client'

// Interface for Vector Store
export interface VectorStore {
    storeVector(id: string, text: string, metadata: any): Promise<void>;
    searchSimilar(text: string, limit: number, filter?: any): Promise<Array<{ id: string, score: number, metadata: any }>>;
}

// Local Stub Implementation (Mock for MVP)
// ideally we'd use pgvector here but for a pure TS mock we can just store hash
class LocalVectorStub implements VectorStore {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async storeVector(id: string, text: string, metadata: any): Promise<void> {
        // For MVP stub, we might just log this or store a simple hash in the claim if we added a field.
        // The requirement says "store it using the vector adapter".
        // We can simulate storage.
        console.log(`[VectorStub] Storing vector for ${id}: ${text.substring(0, 50)}...`);
        return Promise.resolve();
    }

    async searchSimilar(text: string, limit: number, filter?: any): Promise<Array<{ id: string, score: number, metadata: any }>> {
        // Mock implementation: find recent approved claims and return random "similarity"
        // In a real app with pgvector, we'd do:
        // DELETE FROM items WHERE id != $1 ORDER BY embedding <-> $2 LIMIT $3

        console.log(`[VectorStub] Searching similar to: ${text.substring(0, 50)}...`);

        // Fetch some approved claims to pretend satisfy similarity
        const candidates = await this.prisma.claim.findMany({
            where: {
                status: 'APPROVED',
                NOT: { id: filter?.excludeId }
            },
            take: limit + 2,
            include: { actionType: true }
        });

        return candidates.map(c => ({
            id: c.id,
            score: 0.85 + (Math.random() * 0.1), // Mock high score
            metadata: {
                title: c.actionType.title,
                description: c.description,
                occurredAt: c.occurredAt
            }
        })).slice(0, limit);
    }
}

// Factory
let instance: VectorStore | null = null;

export const getVectorStore = (prisma: PrismaClient): VectorStore => {
    if (!instance) {
        // Check env for real vector DB, else use stub
        if (process.env.VECTOR_DB_URL) {
            // TODO: Implement Actian or other real vector store Adapter
            console.warn("Real vector DB not implemented, falling back to stub");
            instance = new LocalVectorStub(prisma);
        } else {
            instance = new LocalVectorStub(prisma);
        }
    }
    return instance;
}
