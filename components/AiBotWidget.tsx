"use client";

import { useRef, useMemo, useState } from "react";
import Image from "next/image";

type ChatMessage = {
  role: "user" | "bot";
  text: string;
};

export default function AiBotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Hi, I am GreenBot. Ask sustainability questions or convert points and price.",
    },
  ]);

  const quickPrompts = useMemo(
    () => [
      "120 points to dollars",
      "$45 to points",
      "How can I earn points faster?",
    ],
    []
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      let reply = "I could not respond right now.";
      if (!res.ok) {
        reply = data?.detail || `AI request failed (${res.status}).`;
      } else if (typeof data?.reply === "string" && data.reply.trim()) {
        reply = data.reply;
      } else if (typeof data?.detail === "string" && data.detail.trim()) {
        reply = data.detail;
      }
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "I could not reach AI right now. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const stopStreamTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (recording || loading) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMessages((prev) => [...prev, { role: "bot", text: "Microphone is not supported in this browser." }]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("file", audioBlob, "speech.webm");
          const res = await fetch("/api/ai/speech-to-text", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.detail || "Speech-to-text failed");
          const text = (data?.text || "").trim();
          if (text) {
            setInput(text);
          } else {
            setMessages((prev) => [...prev, { role: "bot", text: "No speech detected. Try again." }]);
          }
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            { role: "bot", text: err instanceof Error ? err.message : "Speech-to-text failed." },
          ]);
        } finally {
          setRecording(false);
          stopStreamTracks();
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Microphone access denied or unavailable." }]);
      setRecording(false);
      stopStreamTracks();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  return (
    <>
      {open && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div style={{ fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", width: 24, height: 24, borderRadius: "50%", overflow: "hidden" }}>
                <Image
                  src="/brand-logo-cropped.png"
                  alt="Logo"
                  fill
                  style={{ objectFit: "cover", transform: "scale(1.6)" }}
                />
              </div>
              GreenBot
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--ink-muted)",
                fontSize: 20,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto", borderBottom: "1px solid var(--line-subtle)" }}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--surface-subtle)",
                  borderRadius: 999,
                  fontSize: 12,
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: "var(--ink-secondary)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="chat-body">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div className={`chat-bubble ${m.role}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div className="chat-bubble bot" style={{ display: "flex", gap: 4, padding: "12px 16px" }}>
                  <span className="dot-flashing" />
                  <span className="dot-flashing" style={{ animationDelay: "0.2s" }} />
                  <span className="dot-flashing" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="chat-input-area"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="aurora-input"
              style={{ padding: "10px 14px", fontSize: 14 }}
            />
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              title={recording ? "Stop recording" : "Start voice input"}
              style={{
                transition: "all 0.2s ease",
                border: "1px solid var(--line)",
              }}
            >
              {recording ? (
                <span className="animate-pulse">■</span>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                border: "none",
                background: "var(--btn-primary-bg)",
                color: "white",
                borderRadius: 12,
                width: 42,
                height: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
                boxShadow: "var(--btn-primary-shadow)",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="chat-trigger"
        aria-label="Open AI assistant"
        style={{ background: "none", border: "none" }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
          <Image
            src="/brand-logo-cropped.png"
            alt="AI Assistant"
            fill
            style={{ objectFit: "cover", transform: "scale(1.6)" }}
          />
        </div>
        <span className="spinner" style={{ position: "absolute", width: "100%", height: "100%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", opacity: loading ? 1 : 0, transition: "opacity 0.3s", zIndex: 10 }} />
      </button>

      {/* Flashing Dot Animation Styles */}
      <style jsx>{`
        .dot-flashing {
          width: 6px;
          height: 6px;
          border-radius: 5px;
          background-color: var(--ink-muted);
          animation: dot-flashing 1s infinite linear alternate;
        }
        @keyframes dot-flashing {
          0% { opacity: 0.2; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </>
  );
}
