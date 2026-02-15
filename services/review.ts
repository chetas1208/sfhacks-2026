
import { PrismaClient, TransactionType } from '@prisma/client'
import { LedgerService } from './ledger'
import { EducationService } from './education'

const prisma = new PrismaClient()

export class ReviewService {

    static async submitVote(userId: string, claimId: string, approved: boolean, reason?: string) {
        // 1. Check if user is REVIEWER or ADMIN
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || (user.role !== 'REVIEWER' && user.role !== 'ADMIN')) {
            throw new Error("Unauthorized: Only reviewers can vote.");
        }

        // 2. Check strict voting rule: Can only vote once
        const existingVote = await prisma.claimVote.findUnique({
            where: {
                claimId_reviewerId: {
                    claimId,
                    reviewerId: userId
                }
            }
        });
        if (existingVote) {
            throw new Error("You have already voted on this claim.");
        }

        // 3. Record Vote
        await prisma.claimVote.create({
            data: {
                claimId,
                reviewerId: userId,
                vote: approved,
                reason
            }
        });

        // 4. Check Approval Status
        await this.checkAndFinalizeClaim(claimId);
    }

    private static async checkAndFinalizeClaim(claimId: string) {
        const claim = await prisma.claim.findUnique({
            where: { id: claimId },
            include: { votes: true, actionType: true }
        });

        if (!claim || claim.status !== 'PENDING') return;

        const approveVotes = claim.votes.filter(v => v.vote).length;
        const rejectVotes = claim.votes.filter(v => !v.vote).length;

        // Rules:
        // APPROVED when approveVotes >= 2 and rejectVotes == 0
        // REJECTED when rejectVotes >= 2

        if (rejectVotes >= 2) {
            await prisma.claim.update({
                where: { id: claimId },
                data: { status: 'REJECTED' }
            });
            return;
        }

        // For demo/MVP, maybe we lower threshold if only 1 reviewer? 
        // Requirement says "approveVotes >= 2". I will stick to requirement.
        // If I only have 1 reviewer in seed, I can't finalize. 
        // I seeded "reviewer" and "admin". Both can vote. So we have 2.

        if (approveVotes >= 2 && rejectVotes === 0) {
            // APPROVE!

            // Calculate Credits
            const baseCredits = claim.actionType.baseCredits;

            // Extract Receipt Amount from aiHintJson (stored there for MVP)
            let receiptAmount = 0;
            try {
                if (claim.aiHintJson) {
                    const hints = JSON.parse(claim.aiHintJson);
                    receiptAmount = hints.receiptAmount || 0;
                }
            } catch (e) {
                // ignore json parse error
            }

            // Formula: Base Credits + (Receipt Amount * 10)
            // Example: Bike (10) + Receipt($5 coffee * 10) = 60 credits base.
            const totalBase = baseCredits + Math.round(receiptAmount * 10);

            // T2 Multiplier (Fixed 1.5 for T2 verified)
            const tierMultiplier = 1.5;

            // Education Multiplier
            const eduMultiplier = await EducationService.getUserMultiplier(claim.userId);

            const credits = Math.round(totalBase * tierMultiplier * eduMultiplier);

            // Update Claim
            await prisma.claim.update({
                where: { id: claimId },
                data: {
                    status: 'APPROVED',
                    verificationTier: 'T2',
                    creditsAwarded: credits
                }
            });

            // Mint to Ledger
            await LedgerService.recordTransaction({
                userId: claim.userId,
                type: 'MINT', // Enum issue in some linters, using string if possible or careful import
                amount: credits,
                claimId: claim.id,
                description: `Approved: ${claim.actionType.title} (Base:${baseCredits} + Receipt:$${receiptAmount}) x${tierMultiplier} x${eduMultiplier}`
            });
        }
    }
}
