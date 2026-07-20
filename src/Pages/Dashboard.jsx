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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();

  // ✅ Auto-logout after 30 minutes of inactivity
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

  // Check operator account status
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
      const isStopped = operator?.operator_type === "stopped";
      const endpoint = isStopped ? "stopped" : "operator";

      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/${endpoint}/stats?operator_id=${operatorId}&operator_name=${operatorName}`,
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

  // Proceed to chat after accepting terms
  const proceedToChat = async () => {
    try {
      const operator = JSON.parse(localStorage.getItem("operator"));

      const isStopped = operator?.operator_type === "stopped";
      const endpoint = isStopped
        ? "stopped/next-conversation"
        : "operator/assign-next";

      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operator_id: operator.id }),
        },
      );
      const data = await res.json();

      if (data.assigned) {
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
        navigate("/waiting-room");
      }
    } catch (err) {
      console.error("Error assigning message:", err);
      navigate("/waiting-room");
    }
  };

  // Show terms modal when clicking Start Chatting
  const handleStartChatting = () => {
    setShowTermsModal(true);
  };

  // Handle accept terms
  const handleAcceptTerms = () => {
    setShowTermsModal(false);
    proceedToChat();
  };

  // Handle decline terms
  const handleDeclineTerms = () => {
    setShowTermsModal(false);
    // Optionally: show a message or just close modal
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
      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  📋 Terms & Conditions
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Please read and accept our platform guidelines before starting
                </p>
              </div>
              <button
                onClick={handleDeclineTerms}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="text-sm text-blue-700">
                  <strong>📌 Important:</strong> By accepting these terms, you
                  agree to maintain the highest standards of professionalism and
                  ethics while using our platform.
                </p>
              </div>

              {/* Section 1: Platform Overview */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-primary">1.</span> Platform Overview
                </h3>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  We are a premium fantasy sexting platform connecting members
                  with professional chat moderators worldwide. Our service
                  provides a safe, anonymous environment for adult entertainment
                  and fantasy exploration. As a moderator, you represent our
                  brand and must uphold the highest standards of professionalism
                  at all times.
                </p>
              </div>

              {/* Section 2: Core Rules */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-primary">2.</span> Core Rules for
                  Moderators
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>No Real-Life Meetings:</strong> Never imply or
                      suggest that an actual real-time meeting will occur with
                      the fictional profile. This is strictly a fantasy
                      platform.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>Forbidden Content:</strong> Do not engage in
                      fantasies involving: minors (underaged), bestiality,
                      racism, religious discrimination, violence, suicide, drug
                      use, or incest.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>No Personal Contact:</strong> Never exchange
                      personal contact details with clients or request their
                      personal information.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>No Financial Requests:</strong> Do not ask clients
                      for money, gifts, or any form of payment outside the
                      platform.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>Positive Engagement:</strong> Always respond
                      positively to photos shared by clients. Maintain an
                      encouraging and supportive tone.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <span>
                      <strong>Professional Communication:</strong> Avoid
                      excessive punctuation, emoticons, and repetitive content.
                      Keep responses thoughtful and engaging.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Section 3: Suicide Prevention */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <span>🆘</span> Suicide Prevention Protocol
                </h4>
                <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                  If a client indicates suicidal thoughts, immediately refer
                  them to the appropriate helpline for their region:
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="bg-white rounded-lg p-2.5 border border-amber-100">
                    <span className="font-semibold">🇺🇸 USA:</span> 9-8-8
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-amber-100">
                    <span className="font-semibold">🇨🇦 Canada:</span> 9-8-8
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-amber-100">
                    <span className="font-semibold">🇬🇧 UK:</span> 116-123
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-amber-100">
                    <span className="font-semibold">🇦🇺 Australia:</span> 13 11
                    14
                  </div>
                </div>
              </div>

              {/* Section 4: Expectations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-primary">3.</span> Expectations from
                  Moderators
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>
                      <strong>Respectful Conduct:</strong> Treat all members
                      with kindness, respect, and professionalism at all times.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>
                      <strong>Engage Actively:</strong> Answer all questions and
                      actively participate in discussions about clients'
                      fantasies and interests.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>
                      <strong>Follow Guidelines:</strong> Strictly adhere to all
                      platform rules and guidelines at all times.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>
                      <strong>Report Violations:</strong> Immediately report any
                      suspicious, illegal, or inappropriate activity. We will
                      investigate and take appropriate action.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Section 5: Consequences */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <span>⚠️</span> Violation Consequences
                </h4>
                <p className="text-xs text-red-700 mt-2 leading-relaxed">
                  Failure to comply with these terms may result in immediate
                  account suspension, permanent ban, and potential legal action.
                  We take violations seriously to maintain a safe environment
                  for all users.
                </p>
              </div>

              {/* Section 6: Acknowledgment */}
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">
                  By clicking <strong>"Accept & Continue"</strong>, you
                  acknowledge that you have read, understood, and agree to abide
                  by all terms and conditions outlined above.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-end bg-gray-50 rounded-b-2xl">
              <button
                onClick={handleDeclineTerms}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptTerms}
                className="px-8 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              >
                <span>✅</span>
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* Left Column - Messages Today & Actions */}
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

          {/* Right Column - Statistics */}
          <div className="w-full lg:w-2/3 space-y-6">
            {/* Monthly Stats Row */}
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

            {/* Message Activity Chart */}
            <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                  Message Activity
                </h3>
                <p className="text-xs text-gray-400">Last 12 days</p>
              </div>

              {/* CSS Bar Chart */}
              <div className="space-y-3">
                {stats.last12Days.map((day, index) => {
                  const barWidthPercent = Math.min(day.count, 100);

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
