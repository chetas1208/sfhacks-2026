"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, X, Volume2 } from "lucide-react";

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string, audioUrl?: string }[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessages(prev => [...prev, {
                role: 'bot',
                text: data.reply,
                audioUrl: data.audioUrl // Optional TTS
            }]);

            // Auto-play audio if available
            if (data.audioUrl) {
                new Audio(data.audioUrl).play().catch(e => console.log("Audio play failed (interaction needed)", e));
            }

        } catch (err: any) {
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error. " + err.message }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition transform hover:scale-105"
                >
                    <MessageCircle size={24} />
                </button>
            )}

            {isOpen && (
                <div className="bg-white rounded-lg shadow-xl w-80 sm:w-96 flex flex-col border border-gray-200" style={{ height: '500px' }}>
                    {/* Header */}
                    <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                        <h3 className="font-bold">Green Guide AI</h3>
                        <button onClick={() => setIsOpen(false)} className="hover:text-gray-200">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <p className="text-center text-gray-500 text-sm mt-10">
                                Hi! I'm your sustainability assistant. Ask me anything about green energy or recycling!
                            </p>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                    }`}>
                                    <p>{msg.text}</p>
                                    {msg.audioUrl && (
                                        <button
                                            onClick={() => new Audio(msg.audioUrl).play()}
                                            className="mt-2 flex items-center text-xs text-blue-500 hover:underline"
                                        >
                                            <Volume2 size={12} className="mr-1" /> Play Audio
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-200 p-2 rounded-lg text-xs text-gray-500">Thinking...</div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t bg-white rounded-b-lg">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                placeholder="Type your question..."
                                className="flex-grow border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-500"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={loading || !input.trim()}
                                className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
