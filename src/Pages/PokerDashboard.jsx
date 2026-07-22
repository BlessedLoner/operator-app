// src/pages/PokerDashboard.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function PokerDashboard() {
  const [operator, setOperator] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [suggestedFictional, setSuggestedFictional] = useState(null);
  const [queueId, setQueueId] = useState(null);
  const [flirtMessage, setFlirtMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [waitingTime, setWaitingTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    flirtsToday: 0,
    currentMonth: 0,
    lastMonth: 0,
    responseRate: 0,
    last12Days: [],
  });
  const [privatePhotos, setPrivatePhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  // Fetch poker statistics
  const fetchPokerStats = async (operatorId) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(1, 0, 0, 0);

      const { data: flirtMessages, error: flirtError } = await supabase
        .from("messages")
        .select("id, created_at, is_flirt, operator_id")
        .eq("operator_id", operatorId)
        .eq("is_flirt", true);

      if (flirtError) throw flirtError;

      const now = new Date();
      const todayFlirts =
        flirtMessages?.filter((m) => new Date(m.created_at) >= todayStart)
          .length || 0;

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthFlirts =
        flirtMessages?.filter(
          (m) => new Date(m.created_at) >= currentMonthStart,
        ).length || 0;

      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthFlirts =
        flirtMessages?.filter((m) => {
          const date = new Date(m.created_at);
          return date >= lastMonthStart && date <= lastMonthEnd;
        }).length || 0;

      // Last 12 days activity
      const last12Days = [];
      for (let i = 11; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(now.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayCount =
          flirtMessages?.filter((m) => {
            const date = new Date(m.created_at);
            return date >= dayStart && date <= dayEnd;
          }).length || 0;

        last12Days.push({
          date: dayStart.toISOString().split("T")[0],
          count: dayCount,
        });
      }

      setStats({
        flirtsToday: todayFlirts,
        currentMonth: currentMonthFlirts,
        lastMonth: lastMonthFlirts,
        responseRate: 0,
        last12Days,
      });
    } catch (err) {
      console.error("Error fetching poker stats:", err);
    }
  };

  // Fetch private photos for fictional profile
  const fetchPrivatePhotos = async (fictionalId) => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from("fictional_private_photos")
        .select("*")
        .eq("fictional_profile_id", fictionalId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPrivatePhotos(data || []);
    } catch (err) {
      console.error("Error fetching private photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Select/deselect photo
  const handleSelectPhoto = (photo) => {
    setSelectedPhotos((prev) => {
      if (prev.some((p) => p.id === photo.id)) {
        return prev.filter((p) => p.id !== photo.id);
      } else {
        return [photo];
      }
    });
  };

  useEffect(() => {
    const operatorData = localStorage.getItem("operator");
    console.log("🔵 PokerDashboard mounted, operatorData:", operatorData);

    if (!operatorData) {
      console.log("❌ No operator data found, redirecting to login");
      navigate("/login");
      return;
    }

    const operatorObj = JSON.parse(operatorData);
    console.log("✅ Operator loaded:", operatorObj);
    setOperator(operatorObj);
    fetchPokerStats(operatorObj.id);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (!operator) {
      console.log("⏳ Waiting for operator to load...");
      return;
    }

    console.log("🚀 Starting poker queue check for operator:", operator.id);
    checkForNextUser();

    intervalRef.current = setInterval(() => {
      console.log("🔄 Checking for next user...");
      checkForNextUser();
      setWaitingTime((prev) => prev + 5);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [operator]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queueId) {
        const blob = new Blob(
          [JSON.stringify({ queue_id: queueId, operator_id: operator?.id })],
          { type: "application/json" },
        );
        navigator.sendBeacon(
          "https://operator-api-production-de23.up.railway.app/poker/release-user",
          blob,
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [queueId, operator]);

  const checkForNextUser = async () => {
    if (!operator) {
      console.log("⚠️ Cannot check: operator is null");
      return;
    }

    console.log(
      "📡 Fetching next user from /poker/next-user for operator:",
      operator.id,
    );

    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/poker/next-user?operator_id=${operator.id}`,
      );
      console.log("📡 Response status:", res.status);

      const data = await res.json();
      console.log("📦 Response data:", data);

      if (data.hasUser) {
        console.log("✅ User assigned:", data.user?.display_name);
        setWaiting(false);
        setAssignedUser(data.user);
        setSuggestedFictional(data.suggestedFictional);
        setQueueId(data.queueId);
        setError(null);

        if (data.suggestedFictional?.id) {
          fetchPrivatePhotos(data.suggestedFictional.id);
        }

        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        console.log("⏳ No user available, waiting...");
        setWaiting(true);
        setError(null);
      }
    } catch (err) {
      console.error("❌ Error checking for user:", err);
      setError(err.message);
      setWaiting(true);
    }
  };

  // In PokerDashboard.jsx - Updated handleSendFlirt

  const handleSendFlirt = async () => {
    if (!flirtMessage.trim() && selectedPhotos.length === 0) {
      alert("Please enter a message or select a photo");
      return;
    }

    console.log("📤 Sending flirt message to:", assignedUser?.display_name);
    setIsSending(true);

    try {
      // First, send the flirt message and get the conversation ID
      let conversationId = null;

      if (flirtMessage.trim()) {
        const res = await fetch(
          "https://operator-api-production-de23.up.railway.app/poker/send-flirt",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queue_id: queueId,
              user_profile_id: assignedUser.id,
              fictional_profile_id: suggestedFictional.id,
              content: flirtMessage,
              operator_id: operator.id,
            }),
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to send");
        }

        const data = await res.json();
        conversationId = data.conversationId;
        console.log("✅ Flirt sent, conversation ID:", conversationId);
      }

      // Send selected photos AFTER the message (with the correct conversation ID)
      for (const photo of selectedPhotos) {
        const photoRes = await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/send-photo",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photo_id: photo.id,
              conversation_id: conversationId, // ✅ Use the actual conversation ID
              fictional_profile_id: suggestedFictional.id,
              operator_id: operator.id,
            }),
          },
        );

        if (!photoRes.ok) {
          console.error("Failed to send photo:", photo.id);
        }
      }

      alert("Flirt message sent successfully!");
      setFlirtMessage("");
      setSelectedPhotos([]);
      setAssignedUser(null);
      setWaiting(true);
      fetchPokerStats(operator.id);

      // Reset interval and start checking for next user
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        checkForNextUser();
        setWaitingTime((prev) => prev + 5);
      }, 5000);
      checkForNextUser();
    } catch (err) {
      console.error("❌ Send flirt error:", err);
      alert(err.message || "Network error");
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    if (queueId) {
      try {
        console.log("🔄 Releasing assigned user back to queue...");
        await fetch(
          "https://operator-api-production-de23.up.railway.app/poker/release-user",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queue_id: queueId,
              operator_id: operator.id,
            }),
          },
        );
        console.log("✅ User released successfully");
      } catch (err) {
        console.error("Error releasing user:", err);
      }
    }

    localStorage.removeItem("operator");
    navigate("/login");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, "0")} ${date.toLocaleString("default", { month: "short" })}`;
  };

  const maxFlirtCount = Math.max(...stats.last12Days.map((d) => d.count), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading operator data...</p>
        </div>
      </div>
    );
  }

  if (error && waiting && !assignedUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg"
          >
            Retry
          </button>
          <button
            onClick={handleLogout}
            className="ml-3 px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (waiting && !assignedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white/70">
            Waiting for new users...
          </h2>
          <p className="text-gray-400 mt-2">
            Time waiting: {Math.floor(waitingTime / 60)}:
            {(waitingTime % 60).toString().padStart(2, "0")}
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Make sure there are new users in the poke_queue table
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
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
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Poker Dashboard</h1>
              <p className="text-white/80 text-sm">
                Send flirty first messages to new users
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">
                {operator?.username}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Today's Flirts Card */}
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl shadow-lg p-6 text-center text-white">
              <p className="text-sm uppercase tracking-wide opacity-90">
                Flirts Today
              </p>
              <p className="text-6xl font-bold mt-2">{stats.flirtsToday}</p>
              <p className="text-xs mt-2 opacity-75">Resets daily at 1am</p>
            </div>

            {/* Monthly Stats */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Monthly Flirts
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Current Month</span>
                  <span className="text-2xl font-bold text-pink-600">
                    {stats.currentMonth}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Last Month</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {stats.lastMonth}
                  </span>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-pink-50 rounded-2xl shadow-lg p-6 border border-pink-100">
              <h3 className="text-sm font-semibold text-pink-600 mb-3">
                💡 Pro Tips
              </h3>
              <ul className="text-xs text-gray-600 space-y-2">
                <li>• Personalize messages with user's interests</li>
                <li>• Mention their location for better response</li>
                <li>• Use photos to increase engagement</li>
                <li>• Keep messages friendly and engaging</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Send Flirt */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Info Card */}
            {assignedUser && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">
                    Send Flirt Message
                  </h2>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">
                        {assignedUser.display_name}
                      </h3>
                      <p className="text-gray-500">
                        {assignedUser.age} years old • {assignedUser.city},{" "}
                        {assignedUser.country}
                      </p>
                      {assignedUser.interests?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {assignedUser.interests
                            .slice(0, 5)
                            .map((interest, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-100 px-2 py-1 rounded-full"
                              >
                                {interest}
                              </span>
                            ))}
                        </div>
                      )}
                      {assignedUser.liked_fictional_names?.length > 0 && (
                        <div className="mt-2 text-sm text-pink-600">
                          ❤️ Liked:{" "}
                          {assignedUser.liked_fictional_names.join(", ")}
                        </div>
                      )}
                    </div>
                    {suggestedFictional && (
                      <div className="text-right">
                        <div className="bg-pink-100 rounded-lg p-3">
                          <p className="text-xs text-pink-600 mb-1">
                            Messaging as:
                          </p>
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                suggestedFictional.image_url ||
                                "/default-avatar.png"
                              }
                              className="w-8 h-8 rounded-full object-cover"
                              alt=""
                              onError={(e) => {
                                e.target.src = "/default-avatar.png";
                              }}
                            />
                            <span className="font-semibold text-pink-700">
                              {suggestedFictional.display_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Flirt Message
                    </label>
                    <textarea
                      value={flirtMessage}
                      onChange={(e) =>
                        setFlirtMessage(e.target.value.slice(0, 500))
                      }
                      placeholder="Craft an engaging first message..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-400">
                        {flirtMessage.length}/500 characters
                      </span>
                      <span className="text-xs text-gray-400">
                        Min 20 characters recommended
                      </span>
                    </div>
                  </div>

                  {/* Private Photos Section */}
                  {privatePhotos.length > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                        className="flex items-center gap-2 text-pink-600 hover:text-pink-700 text-sm font-medium mb-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            x="2"
                            y="4"
                            width="20"
                            height="18"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx="8.5"
                            cy="9.5"
                            r="2.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M21 15l-5-4-3 3-4-4-5 5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {showPhotoPicker
                          ? "Hide Private Photos"
                          : "Show Private Photos"}
                        <span className="text-xs text-gray-400">
                          ({privatePhotos.length} available)
                        </span>
                      </button>

                      {showPhotoPicker && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          {loadingPhotos ? (
                            <div className="flex justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {privatePhotos.map((photo) => (
                                <button
                                  key={photo.id}
                                  onClick={() => handleSelectPhoto(photo)}
                                  className={`relative rounded-lg overflow-hidden aspect-square transition-all ${
                                    selectedPhotos.some(
                                      (p) => p.id === photo.id,
                                    )
                                      ? "ring-4 ring-pink-500 ring-offset-2"
                                      : "hover:ring-2 hover:ring-pink-300"
                                  }`}
                                >
                                  <img
                                    src={photo.image_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                  {selectedPhotos.some(
                                    (p) => p.id === photo.id,
                                  ) && (
                                    <div className="absolute top-1 right-1 bg-pink-500 rounded-full p-1">
                                      <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Photo Preview */}
                  {selectedPhotos.length > 0 && (
                    <div className="mb-4 p-2 bg-pink-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-pink-600">
                          Photo to send:
                        </span>
                        <button
                          onClick={() => setSelectedPhotos([])}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {selectedPhotos.map((photo) => (
                          <img
                            key={photo.id}
                            src={photo.image_url}
                            className="w-12 h-12 rounded-lg object-cover"
                            alt=""
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send Button */}
                  <button
                    onClick={handleSendFlirt}
                    disabled={
                      (flirtMessage.length < 20 &&
                        selectedPhotos.length === 0) ||
                      isSending
                    }
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSending ? "Sending..." : "Send Flirt Message"}
                  </button>
                </div>
              </div>
            )}

            {/* Flirt Activity Chart */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Flirt Activity
                </h3>
                <p className="text-xs text-gray-400">Last 12 days</p>
              </div>
              <div className="space-y-3">
                {stats.last12Days.map((day, index) => {
                  const barWidthPercent = Math.min(
                    (day.count / maxFlirtCount) * 100,
                    100,
                  );
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-gray-500">
                        {formatDate(day.date)}
                      </div>
                      <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500 flex items-center justify-end px-2"
                          style={{ width: `${barWidthPercent}%` }}
                        >
                          {day.count > 0 && (
                            <span className="text-xs text-white font-medium">
                              {day.count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
