// src/pages/StoppedDashboard.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function StoppedDashboard() {
  const [operator, setOperator] = useState(null);
  const [assignedConversation, setAssignedConversation] = useState(null);
  const [queueId, setQueueId] = useState(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [waitingTime, setWaitingTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const operatorData = localStorage.getItem("operator");
    console.log("🔵 StoppedDashboard mounted, operatorData:", operatorData);

    if (!operatorData) {
      navigate("/");
      return;
    }
    const operatorObj = JSON.parse(operatorData);
    console.log("✅ Operator loaded:", operatorObj);
    setOperator(operatorObj);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (!operator) {
      console.log("⏳ Waiting for operator to load...");
      return;
    }

    console.log("🚀 Starting stopped queue check for operator:", operator.id);
    checkForNextConversation();

    intervalRef.current = setInterval(() => {
      console.log("🔄 Checking for next stopped conversation...");
      checkForNextConversation();
      setWaitingTime((prev) => prev + 5);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [operator]);

  const checkForNextConversation = async () => {
    if (!operator) return;

    console.log(
      "📡 Fetching next conversation from /stopped/next-conversation",
    );

    try {
      const res = await fetch(
        `http://localhost:4000/stopped/next-conversation?operator_id=${operator.id}`,
      );
      console.log("📡 Response status:", res.status);

      const data = await res.json();
      console.log("📦 Response data:", data);

      if (data.hasConversation) {
        console.log("✅ Conversation assigned:", data);
        setWaiting(false);
        setAssignedConversation(data);
        setQueueId(data.queueId);
        setError(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        console.log("⏳ No conversation available, waiting...");
        setWaiting(true);
        setError(null);
      }
    } catch (err) {
      console.error("❌ Error checking for conversation:", err);
      setError(err.message);
      setWaiting(true);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    console.log("📤 Sending re-engagement message");
    setIsSending(true);

    try {
      const res = await fetch("http://localhost:4000/stopped/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queue_id: queueId,
          conversation_id: assignedConversation.conversationId,
          fictional_profile_id: assignedConversation.fictional.id,
          content: message,
          operator_id: operator.id,
        }),
      });

      console.log("📡 Send message response status:", res.status);
      const data = await res.json();
      console.log("📦 Send message response:", data);

      if (res.ok) {
        alert("Re-engagement message sent successfully!");
        setMessage("");
        setAssignedConversation(null);
        setWaiting(true);
        intervalRef.current = setInterval(() => {
          checkForNextConversation();
          setWaitingTime((prev) => prev + 5);
        }, 5000);
        checkForNextConversation();
      } else {
        alert(data.error || "Failed to send");
      }
    } catch (err) {
      console.error("❌ Send message error:", err);
      alert("Network error: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("operator");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading operator data...</p>
        </div>
      </div>
    );
  }

  if (error && waiting && !assignedConversation) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Retry
          </button>
          <button
            onClick={handleLogout}
            className="ml-3 px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (waiting && !assignedConversation) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">
            Waiting for stopped conversations...
          </h2>
          <p className="text-gray-500 mt-2">
            Time waiting: {Math.floor(waitingTime / 60)}:
            {(waitingTime % 60).toString().padStart(2, "0")}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Make sure there are inactive conversations in the stopped_queue
            table
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Stopped Operator Dashboard
              </h1>
              <p className="text-white/80 text-sm">Re-engage inactive users</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Conversation Info */}
          <div className="p-6 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {assignedConversation?.user?.display_name || "Unknown User"}
                </h2>
                <p className="text-gray-500">
                  {assignedConversation?.user?.age} years old •{" "}
                  {assignedConversation?.user?.city},{" "}
                  {assignedConversation?.user?.country}
                </p>
              </div>
              <div className="text-right">
                <div className="bg-orange-100 rounded-lg p-3">
                  <p className="text-xs text-orange-600 mb-1">Replying as:</p>
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        assignedConversation?.fictional?.image_url ||
                        "/default-avatar.png"
                      }
                      className="w-8 h-8 rounded-full object-cover"
                      alt=""
                      onError={(e) => {
                        e.target.src = "/default-avatar.png";
                      }}
                    />
                    <span className="font-semibold text-orange-700">
                      {assignedConversation?.fictional?.display_name ||
                        "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Message Input */}
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Re-engagement Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Send a message to bring the user back..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-400">
                {message.length}/500 characters
              </span>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSending}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-orange-50 p-4">
            <p className="text-xs text-orange-600">
              💡 Tip: Be friendly and remind them why they enjoyed the
              conversation!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
