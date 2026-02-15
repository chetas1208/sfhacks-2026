
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class EducationService {

    static async getLessons() {
        return prisma.lesson.findMany({
            include: { quizzes: true } // just ID check if taken?
        });
    }

    static async getLesson(id: string) {
        return prisma.lesson.findUnique({
            where: { id },
            include: { quizzes: true }
        });
    }

    static async submitQuizAttempt(userId: string, quizId: string, answers: number[]) {
        // 1. Get Quiz
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) throw new Error("Quiz not found");

        const questions = JSON.parse(quiz.questionsJson) as Array<{ correctIndex: number }>;

        // 2. Grade
        let correctCount = 0;
        questions.forEach((q, idx) => {
            if (answers[idx] === q.correctIndex) correctCount++;
        });

        // Pass if 100% or maybe > 70%? Requirement: "If a user passes a quiz".
        // Let's say 100% since they are short (3 Qs).
        const passed = correctCount === questions.length;

        // 3. Record Attempt
        const attempt = await prisma.quizAttempt.create({
            data: {
                userId,
                quizId,
                score: correctCount,
                passed
            }
        });

        // 4. Set Multiplier if passed
        // "set multiplier = 1.2 for 24 hours"
        if (passed) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await prisma.userMultiplier.upsert({
                where: { userId },
                create: {
                    userId,
                    multiplier: 1.2,
                    expiresAt
                },
                update: {
                    multiplier: 1.2,
                    expiresAt // Extend/Reset if they take another quiz? "set multiplier...". Yes.
                }
            });
        }

        return { passed, score: correctCount, total: questions.length };
    }

    static async getUserMultiplier(userId: string): Promise<number> {
        const record = await prisma.userMultiplier.findUnique({ where: { userId } });
        if (!record) return 1.0;

        if (record.expiresAt < new Date()) {
            return 1.0;
            // Optionally clean up expired? or just ignore.
        }

        return record.multiplier;
    }
}
