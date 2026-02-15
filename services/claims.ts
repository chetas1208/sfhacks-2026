
import { PrismaClient, Claim } from '@prisma/client'
import crypto from 'crypto'
import { getStorageService } from './storage'
import { AiService } from './ai'
import { getVectorStore } from './vectorAdapter'

const prisma = new PrismaClient()

export class ClaimService {

    static async submitClaim(data: {
        userId: string
        actionCode: string
        description: string
        occurredAt: Date
        amount?: number
        fileBuffer?: Buffer
        fileName?: string
        fileMime?: string
    }) {
        // 1. Resolve Action Type
        const actionType = await prisma.actionType.findUnique({
            where: { code: data.actionCode }
        });
        if (!actionType) throw new Error("Invalid action type");

        // 2. Compute Evidence Hash & Check Double Submission
        let evidenceHash = '';
        let evidenceUrl = '';

        // Normalize time bucket (YYYY-MM-DD-HH)
        const timeBucket = data.occurredAt.toISOString().slice(0, 13);

        // Hash components: Action + RoundedHour + NormalizedDesc + FileSize/Name
        const hashInput = `${data.actionCode}|${timeBucket}|${data.description.trim().toLowerCase()}|${data.fileBuffer?.length || 0}|${data.fileName || ''}`;
        evidenceHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        // Check existing
        const existing = await prisma.claim.findFirst({
            where: {
                userId: data.userId,
                timeBucket,
                evidenceHash
            }
        });

        if (existing) {
            throw new Error(`Duplicate claim detected. You have already submitted a similar claim for this hour.`);
        }

        // 3. Upload File if present
        if (data.fileBuffer && data.fileName && data.fileMime) {
            evidenceUrl = await getStorageService().uploadFile(data.fileBuffer, data.fileName, data.fileMime);
        }

        // 4. Generate AI Hints
        const aiHints = await AiService.analyzeClaim(data.actionCode, data.description, data.occurredAt);

        // Calculate Initial Credits (Formula: Base + (Amount * 10))
        // Note: Final credits are minted upon approval, but we store the potential/base here or handle it in review.
        // Actually, let's store the 'amount' in metadata or description?
        // The schema doesn't have an 'amount' field on Claim. 
        // I should stick to 'creditsAwarded' being null until approval, but maybe store the receipt amount in description or aiHint?
        // Let's prepend it to description for MVP simplicity vs migration.

        let finalDescription = data.description;
        if (data.amount) {
            finalDescription = `[Receipt: $${data.amount}] ${data.description}`;
        }

        // 5. Save to DB
        const claim = await prisma.claim.create({
            data: {
                userId: data.userId,
                actionTypeId: actionType.id,
                description: finalDescription,
                occurredAt: data.occurredAt,
                evidenceUrl,
                evidenceHash,
                timeBucket,
                status: 'PENDING',
                verificationTier: 'T1',
                aiHintJson: JSON.stringify({ ...aiHints, receiptAmount: data.amount }),
            },
            include: {
                actionType: true,
                user: true
            }
        });

        // 6. Vector Store (Async/Background ideally, but awaiting for MVP simplicity)
        const vectorStore = getVectorStore(prisma);
        const vectorText = `${actionType.title} ${data.description}`;
        await vectorStore.storeVector(claim.id, vectorText, {
            occurredAt: data.occurredAt,
            userId: data.userId
        });

        return claim;
    }

    static async getClaimsByUser(userId: string) {
        return prisma.claim.findMany({
            where: { userId },
            orderBy: { submittedAt: 'desc' },
            include: { actionType: true }
        });
    }

    static async getClaimsForReview() {
        return prisma.claim.findMany({
            where: { status: 'PENDING' },
            orderBy: { submittedAt: 'asc' },
            include: { actionType: true, user: true }
        });
    }

    static async getClaimById(id: string) {
        return prisma.claim.findUnique({
            where: { id },
            include: {
                actionType: true,
                user: true,
                votes: {
                    include: { reviewer: true }
                }
            }
        });
    }
}
