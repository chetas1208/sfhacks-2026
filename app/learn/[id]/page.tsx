"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
// I'll stick to simple text rendering or standard HTML details for now to avoid extra deps if possible,
// OR I'll just render it as raw text/simple paragraphs. The seed was simple markdown.
// Actually, I can just split by \n and render paragraphs.

export default function LessonDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [lesson, setLesson] = useState<any>(null);
    const [answers, setAnswers] = useState<number[]>([]);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetch(`/api/lessons/${id}`)
            .then(res => res.json())
            .then(data => {
                setLesson(data);
                // Init answers
                if (data.quizzes && data.quizzes.length > 0) {
                    const quiz = data.quizzes[0];
                    const qs = JSON.parse(quiz.questionsJson);
                    setAnswers(new Array(qs.length).fill(-1));
                }
            });
    }, [id]);

    if (!lesson) return <div className="p-8">Loading...</div>;

    const quiz = lesson.quizzes && lesson.quizzes[0];
    const questions = quiz ? JSON.parse(quiz.questionsJson) : [];

    const handleAnswer = (qIdx: number, optIdx: number) => {
        const newAnswers = [...answers];
        newAnswers[qIdx] = optIdx;
        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {
        if (answers.includes(-1)) {
            alert("Please answer all questions");
            return;
        }

        const res = await fetch(`/api/quiz/${quiz.id}/attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
        });

        const data = await res.json();
        setResult(data);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <button onClick={() => router.back()} className="text-gray-500 mb-4">&larr; Back to Lessons</button>

            <article className="prose lg:prose-xl bg-white p-8 rounded shadow mb-8">
                <h1 className="text-3xl font-bold mb-4">{lesson.title}</h1>
                <div className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                    {lesson.contentMd}
                </div>
            </article>

            <div className="bg-blue-50 p-8 rounded shadow border border-blue-100">
                <h2 className="text-2xl font-bold mb-6 text-blue-900">Quiz Time!</h2>

                {result ? (
                    <div className={`p-6 rounded text-center ${result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        <h3 className="text-xl font-bold mb-2">
                            {result.passed ? "🎉 Passed!" : "❌ Try Again"}
                        </h3>
                        <p className="mb-4">You scored {result.score} / {result.total}</p>
                        {result.passed && (
                            <p><strong>Multiplier Active!</strong> You will earn 1.2x credits on your next claim.</p>
                        )}
                        <button
                            onClick={() => router.push("/learn")}
                            className="mt-4 underline"
                        >
                            Return to Lessons
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {questions.map((q: any, idx: number) => (
                            <div key={idx} className="bg-white p-4 rounded shadow-sm">
                                <p className="font-semibold mb-3">{idx + 1}. {q.question}</p>
                                <div className="space-y-2">
                                    {q.options.map((opt: string, optIdx: number) => (
                                        <label key={optIdx} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`q-${idx}`}
                                                onChange={() => handleAnswer(idx, optIdx)}
                                                checked={answers[idx] === optIdx}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleSubmit}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 text-lg"
                        >
                            Submit Answers
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
