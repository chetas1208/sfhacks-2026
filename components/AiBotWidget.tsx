"use client";

import { useMemo, useState } from "react";
import { useRef } from "react";

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
      const data = await res.json();
      const reply = data?.reply || "I could not respond right now.";
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
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 88,
            width: 330,
            maxWidth: "calc(100vw - 24px)",
            height: 430,
            background: "linear-gradient(155deg, rgba(255,255,255,0.96), rgba(237,251,245,0.92))",
            border: "1px solid rgba(9,76,64,0.16)",
            borderRadius: 18,
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid rgba(9,76,64,0.12)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(130deg, rgba(15,157,139,0.14), rgba(90,184,255,0.12))",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
            }}
          >
            <div style={{ fontWeight: 700, color: "#065f46" }}>GreenBot</div>
            <button
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#4b5563",
                fontSize: 16,
              }}
            >
              x
            </button>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #f3f4f6" }}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                style={{
                  border: "1px solid rgba(9,76,64,0.14)",
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: 999,
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                  color: "#0f5f4e",
                  fontWeight: 700,
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 8px" }}>
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "8px 10px",
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.35,
                    background: m.role === "user" ? "linear-gradient(135deg, #059669, #0f9d8b)" : "#f1f5f9",
                    color: m.role === "user" ? "#fff" : "#1f3a33",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #e5e7eb" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask GreenBot..."
              style={{
                flex: 1,
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "9px 10px",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              title={recording ? "Stop recording" : "Start voice input"}
              style={{
                border: "none",
                background: recording ? "#dc2626" : "#0d9488",
                color: "#fff",
                borderRadius: 10,
                padding: "0 12px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {recording ? "■" : "🎤"}
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                border: "none",
                background: loading ? "#9ca3af" : "#059669",
                color: "#fff",
                borderRadius: 10,
                padding: "0 12px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI assistant"
        title="Open GreenBot"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: 62,
          height: 62,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.8)",
          background: "radial-gradient(circle at 30% 25%, #34d399 0%, #059669 55%, #065f46 100%)",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 10px 26px rgba(5,150,105,0.5), 0 0 0 6px rgba(16,185,129,0.15), inset 0 0 0 1px rgba(255,255,255,0.25)",
          zIndex: 1001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ position: "relative", lineHeight: 1 }}>
          <span style={{ fontSize: 24 }}>🌿</span>
          <span style={{ position: "absolute", top: -8, right: -10, fontSize: 12 }}>✨</span>
        </span>
      </button>
    </>
  );
}
