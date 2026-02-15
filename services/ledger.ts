
import { PrismaClient, TransactionType } from '@prisma/client'

const prisma = new PrismaClient()

export class LedgerService {

    /**
     * Helper to get the singleton prisma instance if needed, or use the one passed in.
     * For this pattern, we'll assume global prisma or passed instance.
     */

    /**
     * Record a transaction in the ledger. 
     * Ledger is append-only. Balance is derived.
     */
    static async recordTransaction(data: {
        userId: string
        type: TransactionType
        amount: number
        claimId?: string
        redemptionId?: string
        description?: string
    }) {
        return await prisma.ledgerTransaction.create({
            data: {
                accountUserId: data.userId,
                type: data.type,
                amount: data.amount,
                claimId: data.claimId,
                redemptionId: data.redemptionId,
                memo: data.description,
            },
        })
    }

    /**
     * Calculate current balance by summing all transaction amounts.
     */
    static async getBalance(userId: string): Promise<number> {
        const aggregate = await prisma.ledgerTransaction.aggregate({
            where: { accountUserId: userId },
            _sum: { amount: true },
        })
        return aggregate._sum.amount || 0
    }

    /**
     * Get formatted statement.
     */
    static async getStatement(userId: string) {
        const txs = await prisma.ledgerTransaction.findMany({
            where: { accountUserId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                claim: { include: { actionType: true } },
                redemption: { include: { reward: true } },
            },
        })

        return txs.map(tx => ({
            id: tx.id,
            date: tx.createdAt,
            type: tx.type,
            amount: tx.amount,
            description: tx.memo ||
                (tx.claim ? `Claim: ${tx.claim.actionType.title}` :
                    (tx.redemption ? `Redeemed: ${tx.redemption.reward.title}` : 'Transaction')),
            balanceAfter: 0 // We'd need to compute running balance if we want it on each line, or frontend does it.
        }))
    }
}
