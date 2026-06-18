import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInactivityLogout } from "../hooks/useInactivityLogout";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const [stats, setStats] = useState({
    messagesToday: 0,
    currentMonth: 0,
    lastMonth: 0,
    last12Days: [],
    processed: 0,
    pending: 0,
    operatorName: "",
  });
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // ✅ Add this line - enables auto-logout after 30 minutes of inactivity
  useInactivityLogout(30);

  useEffect(() => {
    // Get logged in operator from localStorage
    const operatorData = localStorage.getItem("operator");
    if (!operatorData) {
      navigate("/");
      return;
    }
    const operatorObj = JSON.parse(operatorData);
    setOperator(operatorObj);

    fetchStats(operatorObj.id, operatorObj.username);
  }, [navigate]);

  // In operator Dashboard.jsx
  useEffect(() => {
    const checkIfActive = async () => {
      const operator = JSON.parse(localStorage.getItem("operator"));
      if (!operator) return;

      try {
        const { data, error } = await supabase
          .from("operator_accounts")
          .select("is_active")
          .eq("id", operator.id)
          .single();

        if (error) throw error;

        if (!data?.is_active) {
          alert("Your account has been deactivated. Please contact support.");
          localStorage.removeItem("operator");
          window.location.href = "/";
        }
      } catch (err) {
        console.error("Error checking status:", err);
      }
    };

    checkIfActive();
    const interval = setInterval(checkIfActive, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async (operatorId, operatorName) => {
    setLoading(true);
    try {
      // Use different endpoint for stopped operators
      const isStopped = operator?.operator_type === "stopped";
      const endpoint = isStopped ? "stopped" : "operator";

      const res = await fetch(
        `http://localhost:4000/${endpoint}/stats?operator_id=${operatorId}&operator_name=${operatorName}`,
      );
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        console.error("Stats error:", data.error);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChatting = () => {
    // First assign a message to this operator
    const assignMessage = async () => {
      try {
        const operator = JSON.parse(localStorage.getItem("operator"));

        const isStopped = operator?.operator_type === "stopped";
        const endpoint = isStopped
          ? "stopped/next-conversation"
          : "operator/assign-next";

        const res = await fetch(`http://localhost:4000/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_id: operator.id }),
        });
        const data = await res.json();

        if (data.assigned) {
          // Message assigned immediately, go to chat
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
        } else {
          // No messages available, go to waiting room
          navigate("/waiting-room");
        }
      } catch (err) {
        console.error("Error assigning message:", err);
        navigate("/waiting-room");
      }
    };

    assignMessage();
  };

  const handleLogout = () => {
    localStorage.removeItem("operator");
    navigate("/");
  };

  // Find max value for bar chart scaling
  const maxMessageCount =
    stats.last12Days.length > 0
      ? Math.max(...stats.last12Days.map((d) => d.count), 1)
      : 1;

  // Format date for display (e.g., "03 May")
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, "0")} ${date.toLocaleString("default", { month: "short" })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full text-white h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Mobile Responsive */}
      <div className="bg-primary shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Operator Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Welcome back, {operator?.username}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full sm:w-auto px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mobile Grid: Single column, Desktop: 3 columns */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Messages Today & Actions (Full width on mobile, 1/3 on desktop) */}
          <div className="w-full lg:w-1/3 space-y-6">
            {/* Messages Today Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 sm:p-8 text-center text-white">
              <p className="text-xs sm:text-sm uppercase tracking-wide opacity-90">
                Messages Today
              </p>
              <p className="text-5xl sm:text-7xl font-bold mt-2">
                {stats.messagesToday}
              </p>
              <p className="text-xs mt-2 opacity-75">Resets daily at 1am</p>
            </div>

            {/* Start Chatting Button */}
            <button
              onClick={handleStartChatting}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
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
              Start Chatting
            </button>

            {/* Processed & Pending Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
                Queue Status
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-sm sm:text-base text-gray-600">
                    Processed
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-green-600">
                    {stats.processed}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-sm sm:text-base text-gray-600">
                    Pending
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-orange-600">
                    {stats.pending}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Statistics (Full width on mobile, 2/3 on desktop) */}
          <div className="w-full lg:w-2/3 space-y-6">
            {/* Monthly Stats Row - Stacks on mobile, side by side on tablet+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">
                  Current Month
                </h3>
                <p className="text-3xl sm:text-4xl font-bold text-primary">
                  {stats.currentMonth}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Messages sent this month
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">
                  Last Month
                </h3>
                <p className="text-3xl sm:text-4xl font-bold text-purple-600">
                  {stats.lastMonth}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Messages sent last month
                </p>
              </div>
            </div>

            {/* Message Activity Chart - Responsive for mobile */}
            <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                  Message Activity
                </h3>
                <p className="text-xs text-gray-400">Last 12 days</p>
              </div>

              {/* CSS Bar Chart - Mobile friendly */}
              <div className="space-y-3">
                {stats.last12Days.map((day, index) => {
                  // Calculate bar width percentage (capped at 100%)
                  const barWidthPercent = Math.min(day.count, 100);

                  // Dynamic color based on count
                  let barColor = "from-blue-500 to-blue-600";
                  if (day.count >= 80) barColor = "from-green-600 to-green-700";
                  else if (day.count >= 50)
                    barColor = "from-teal-500 to-teal-600";
                  else if (day.count >= 30)
                    barColor = "from-blue-500 to-blue-600";
                  else if (day.count >= 10)
                    barColor = "from-sky-400 to-sky-500";
                  else if (day.count > 0)
                    barColor = "from-cyan-300 to-cyan-400";

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3"
                    >
                      <div className="w-16 text-xs text-gray-500 font-medium">
                        {formatDate(day.date)}
                      </div>
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-7 sm:h-8 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500 flex items-center justify-end px-2 sm:px-3`}
                              style={{ width: `${barWidthPercent}%` }}
                            >
                              {day.count > 0 && (
                                <span className="text-xs text-white font-medium">
                                  {day.count}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">
                            {day.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stats.last12Days.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No message data available
                </p>
              )}
            </div>

            {/* Operator Info Footer */}
            <div className="bg-gray-50 rounded-2xl shadow-sm p-4 text-center">
              <p className="text-xs sm:text-sm text-gray-500">
                Moderator:{" "}
                <span className="font-medium text-gray-700">
                  {operator?.username}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
