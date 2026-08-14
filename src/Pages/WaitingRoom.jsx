// src/pages/WaitingRoom.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInactivityLogout } from "../hooks/useInactivityLogout";

export default function WaitingRoom() {
  const [waitingTime, setWaitingTime] = useState(0);
  const [lastChecked, setLastChecked] = useState("Waiting...");
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  // ✅ Auto-logout after 30 minutes of inactivity
  useInactivityLogout(30);

  const intervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const isNavigatingRef = useRef(false);

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

      fetch(`https://operator-api-production-de23.up.railway.app/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: operator.id,
          device_id: localStorage.getItem("operator_device_id"),
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

  const checkForNextItem = async () => {
    if (!operator) return;
    if (isNavigatingRef.current) return;
    if (isConnecting) return;

    setLastChecked(new Date().toLocaleTimeString());

    try {
      setIsConnecting(true);

      const endpoint = isStopped
        ? `/stopped/next-conversation?operator_id=${operator.id}`
        : `/operator/current-message?operator_id=${operator.id}&device_id=${localStorage.getItem("operator_device_id")}`;

      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app${endpoint}`,
      );

      if (!res.ok) {
        // ✅ Don't navigate on 404 or 500 errors, just log and wait
        if (res.status === 404 || res.status === 500) {
          console.log(`⚠️ Server error (${res.status}), waiting...`);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.hasConversation || data.hasMessage) {
        console.log("✅ Item found! Navigating to chat...");
        if (intervalRef.current) clearInterval(intervalRef.current);
        isNavigatingRef.current = true;

        navigate("/chat", {
          state: {
            queueId: data.queueId,
            conversationId: data.conversationId,
            message: data.message,
            userProfile: data.userProfile,
            fictionalProfile: data.fictionalProfile,
            expiresAt: data.expiresAt,
            type: operator?.operator_type,
            userCredits: data.userCredits, // ✅ NEW: Pass credits
          },
        });
        return;
      }

      // If no assigned item, try to assign a new one
      const assignEndpoint = isStopped
        ? "stopped/next-conversation"
        : "operator/assign-next";
      const method = isStopped ? "GET" : "POST";

      let assignRes;
      if (isStopped) {
        assignRes = await fetch(
          `https://operator-api-production-de23.up.railway.app/${assignEndpoint}?operator_id=${operator.id}`,
        );
      } else {
        assignRes = await fetch(
          `https://operator-api-production-de23.up.railway.app/${assignEndpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operator_id: operator.id,
              device_id: localStorage.getItem("operator_device_id"),
            }),
          },
        );
      }

      if (!assignRes.ok) {
        console.log(
          `⚠️ Assign request failed (${assignRes.status}), waiting...`,
        );
        return;
      }

      const assignData = await assignRes.json();

      if (assignData.assigned || assignData.hasConversation) {
        console.log("✅ New item assigned! Navigating to chat...");
        if (intervalRef.current) clearInterval(intervalRef.current);
        isNavigatingRef.current = true;

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
      }
    } catch (err) {
      // ✅ Don't navigate on errors, just log and wait
      console.error("Error checking for next item:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="bg-white rounded-2xl p-8 md:p-12 max-w-md w-full shadow-lg">
          {/* Spinner Animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24">
                <div className="absolute inset-0 rounded-full border-[6px] border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-primary border-r-secondary border-b-accent border-l-transparent animate-spin"></div>
                <div className="absolute -inset-1 rounded-full border-2 border-primary/20 animate-ping"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-primary animate-pulse"
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
          </div>

          <h2 className="text-2xl font-bold text-black mb-2">
            Waiting for a new message
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Stay on this page. A message will appear automatically.
          </p>

          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-gray-600 text-sm">Waiting time</p>
            <p className="text-3xl font-mono font-bold text-primary">
              {formatTime(waitingTime)}
            </p>
          </div>

          <div className="bg-gray-100 rounded-xl p-2 mb-6">
            <p className="text-gray-500 text-xs">
              Last checked: {lastChecked}
              {isConnecting && (
                <span className="ml-2 text-primary">• Checking...</span>
              )}
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Back to Dashboard
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Operator: {operator?.username}
          </p>
        </div>
      </div>
    </div>
  );
}
