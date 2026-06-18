import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInactivityLogout } from "../hooks/useInactivityLogout";

export default function WaitingRoom() {
  const [waitingTime, setWaitingTime] = useState(0);
  const [lastChecked, setLastChecked] = useState("Waiting...");
  const navigate = useNavigate();

  // ✅ Auto-logout after 30 minutes of inactivity
  useInactivityLogout(30);

  const intervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // const operator = JSON.parse(localStorage.getItem("operator") || "{}");
  // const isStopped = operator?.operator_type === "stopped";

  const operatorRef = useRef(
    JSON.parse(localStorage.getItem("operator") || "{}"),
  );

  const operator = operatorRef.current;
  const isStopped = operator?.operator_type === "stopped";

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Initial check
    checkForNextItem();

    // Check queue every 5 seconds
    intervalRef.current = setInterval(() => {
      checkForNextItem();
    }, 5000);

    // Update timer every second
    const timerInterval = setInterval(() => {
      setWaitingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      const endpoint = isStopped ? "stopped/heartbeat" : "operator/heartbeat";

      fetch(`http://localhost:4000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: operator.id,
        }),
      }).catch((err) => {
        console.error("Heartbeat failed:", err);
      });
    }, 30000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(timerInterval);
      clearInterval(heartbeatInterval);
    };
  }, []);

  useEffect(() => {
    console.log("WaitingRoom mounted");
  }, []);

  const checkForNextItem = async () => {
    if (!operator) return;

    setLastChecked(new Date().toLocaleTimeString());
    console.log("🔍 Checking for next item...");

    try {
      // Use different endpoint based on operator type
      const endpoint = isStopped
        ? `/stopped/next-conversation?operator_id=${operator.id}`
        : `/operator/current-message?operator_id=${operator.id}`;

      const res = await fetch(`http://localhost:4000${endpoint}`);
      const data = await res.json();
      console.log("📨 Response:", data);

      if (data.hasConversation || data.hasMessage) {
        console.log("✅ Item found! Navigating to chat...");
        if (intervalRef.current) clearInterval(intervalRef.current);
        navigate("/chat", {
          state: {
            queueId: data.queueId,
            conversationId: data.conversationId,
            message: data.message,
            userProfile: data.userProfile,
            fictionalProfile: data.fictionalProfile,
            expiresAt: data.expiresAt,
            type: operator?.operator_type,
          },
        });
        return;
      }

      // If no assigned item, try to assign a new one
      console.log("🔄 No assigned item. Trying to assign a new one...");
      const assignEndpoint = isStopped
        ? "stopped/next-conversation"
        : "operator/assign-next";
      const method = isStopped ? "GET" : "POST";

      let assignRes;
      if (isStopped) {
        assignRes = await fetch(
          `http://localhost:4000/${assignEndpoint}?operator_id=${operator.id}`,
        );
      } else {
        assignRes = await fetch(`http://localhost:4000/${assignEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_id: operator.id }),
        });
      }

      const assignData = await assignRes.json();
      console.log("📦 Assign response:", assignData);

      if (assignData.assigned || assignData.hasConversation) {
        console.log("✅ New item assigned! Navigating to chat...");
        if (intervalRef.current) clearInterval(intervalRef.current);
        navigate("/chat", {
          state: {
            queueId: assignData.queueId,
            conversationId: assignData.conversationId,
            message: assignData.message,
            userProfile: assignData.userProfile,
            fictionalProfile: assignData.fictionalProfile,
            expiresAt: assignData.expiresAt,
            type: operator?.operator_type,
          },
        });
      } else {
        console.log("⏳ No items available. Waiting...");
      }
    } catch (err) {
      console.error("Error checking for next item:", err);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 md:p-12 max-w-md w-full">
          {/* Spinner Animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-gray-600 rounded-full animate-spin border-t-primary"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Waiting for a new message
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Stay on this page. A message will appear automatically.
          </p>

          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-gray-300 text-sm">Waiting time</p>
            <p className="text-3xl font-mono font-bold text-primary">
              {formatTime(waitingTime)}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-2 mb-6">
            <p className="text-gray-400 text-xs">Last checked: {lastChecked}</p>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Back to Dashboard
          </button>

          <p className="text-xs text-gray-500 mt-4">
            Operator: {operator.username}
          </p>
        </div>
      </div>
    </div>
  );
}
