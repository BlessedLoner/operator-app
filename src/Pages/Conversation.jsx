import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Conversation() {
  const { id: conversationId } = useParams();
  const location = useLocation();
  const state = location.state;

  const bottomRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  /* -------------------------------
     Load existing messages
  ------------------------------- */
  useEffect(() => {
    fetch(
      `http://localhost:4000/operator/conversations/${conversationId}/messages`,
    )
      .then((res) => res.json())
      .then(setMessages);
  }, [conversationId]);

  /* -------------------------------
     REALTIME subscription
  ------------------------------- */
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`operator-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("Realtime message:", payload.new);

          setMessages((prev) => [...prev, payload.new]);
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  /* -------------------------------
     Auto scroll
  ------------------------------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* -------------------------------
     Send reply (via API)
  ------------------------------- */
  async function sendReply(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const res = await fetch("http://localhost:4000/operator/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: input,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Reply failed:", text);
      return;
    }

    setInput("");
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>
        {state?.fictional_profiles?.display_name ?? "Fictional"} ↔{" "}
        {state?.user_profiles?.display_name ?? "User"}
      </h3>

      <div style={{ marginTop: 20 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              textAlign: m.direction === "fictional_to_user" ? "right" : "left",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: 10,
                borderRadius: 6,
                background:
                  m.direction === "fictional_to_user" ? "#cce5ff" : "#eee",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendReply}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply as fictional profile..."
          style={{ width: "100%", padding: 10 }}
        />
      </form>
    </div>
  );
}
