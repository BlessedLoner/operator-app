// src/pages/ManualOutreach.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ManualOutreach() {
  const navigate = useNavigate();
  const [operator, setOperator] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Fictional profile states
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [suggestedCriteria, setSuggestedCriteria] = useState(null);
  const [selectedFictional, setSelectedFictional] = useState(null);
  const [fictionalSearchQuery, setFictionalSearchQuery] = useState("");
  const [fictionalSearchResults, setFictionalSearchResults] = useState([]);
  const [searchingFictional, setSearchingFictional] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // ✅ Private photos states
  const [privatePhotos, setPrivatePhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null); // ✅ Only one photo
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // Message states
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [remainingDaily, setRemainingDaily] = useState(20);

  // History states
  const [outreachHistory, setOutreachHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);

  // Refs
  const searchInputRef = useRef(null);

  // Load operator data
  useEffect(() => {
    const operatorData = localStorage.getItem("operator");
    if (!operatorData) {
      navigate("/login");
      return;
    }

    const operatorObj = JSON.parse(operatorData);

    if (operatorObj.operator_type !== "outreach") {
      alert("This feature is only available for Outreach operators.");
      navigate("/dashboard");
      return;
    }

    setOperator(operatorObj);
    setLoading(false);
    fetchOutreachHistory(operatorObj.id);
  }, [navigate]);

  // ✅ Fetch private photos when fictional profile is selected
  useEffect(() => {
    if (selectedFictional?.id) {
      fetchPrivatePhotos(selectedFictional.id);
    } else {
      setPrivatePhotos([]);
      setSelectedPhoto(null);
      setShowPhotoPicker(false);
    }
  }, [selectedFictional]);

  // Auto-search when query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ Handle logout
  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem("operator");
      localStorage.removeItem("operator_device_id");

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Navigate to login
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      // Force navigate even if supabase signout fails
      navigate("/login");
    }
  };

  // ✅ Fetch private photos for fictional profile
  const fetchPrivatePhotos = async (fictionalId) => {
    if (!fictionalId) {
      setPrivatePhotos([]);
      setSelectedPhoto(null);
      return;
    }

    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from("fictional_private_photos")
        .select("*")
        .eq("fictional_profile_id", fictionalId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPrivatePhotos(data || []);
      setSelectedPhoto(null); // ✅ Reset selected photo when profile changes
      setShowPhotoPicker(false);
    } catch (err) {
      console.error("Error fetching private photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // ✅ Select/deselect photo (only one at a time)
  const handleSelectPhoto = (photo) => {
    if (selectedPhoto?.id === photo.id) {
      // Deselect
      setSelectedPhoto(null);
    } else {
      // Select this photo (replaces any previous selection)
      setSelectedPhoto(photo);
    }
  };

  // Search users
  const searchUsers = async () => {
    if (!operator || searchQuery.length < 2) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/search-users?query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-operator-id": operator.id,
          },
        },
      );

      if (!res.ok) {
        if (res.status === 403) {
          alert("Not authorized as outreach operator");
          navigate("/dashboard");
          return;
        }
        throw new Error("Failed to search users");
      }

      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (err) {
      console.error("Search error:", err);
      showToast("Failed to search users", "error");
    } finally {
      setSearching(false);
    }
  };

  // Select a user
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery("");
    setSelectedFictional(null);
    setMessage("");
    setSelectedPhoto(null);
    setShowHistory(false);

    // Fetch suggested fictional profiles
    setLoadingProfiles(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/suggested-fictionals?user_id=${user.id}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-operator-id": operator.id,
          },
        },
      );

      if (!res.ok) throw new Error("Failed to fetch suggestions");

      const data = await res.json();
      setSuggestedProfiles(data.suggested_profiles || []);
      setSuggestedCriteria(data.matched_criteria || null);

      if (data.suggested_profiles && data.suggested_profiles.length > 0) {
        setSelectedFictional(data.suggested_profiles[0]);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      showToast("Failed to load suggested profiles", "error");
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Search fictional profiles
  const searchFictionalProfiles = async () => {
    if (!fictionalSearchQuery || fictionalSearchQuery.length < 2) return;

    setSearchingFictional(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/search-fictionals?query=${encodeURIComponent(fictionalSearchQuery)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-operator-id": operator.id,
          },
        },
      );

      if (!res.ok) throw new Error("Failed to search fictional profiles");

      const data = await res.json();
      setFictionalSearchResults(data.profiles || []);
    } catch (err) {
      console.error("Error searching fictionals:", err);
      showToast("Failed to search fictional profiles", "error");
    } finally {
      setSearchingFictional(false);
    }
  };

  // Select a fictional profile
  const handleSelectFictional = (profile) => {
    setSelectedFictional(profile);
    setFictionalSearchResults([]);
    setFictionalSearchQuery("");
    setSelectedPhoto(null); // ✅ Reset selected photo when switching profiles
    setShowPhotoPicker(false);
  };

  // Fetch outreach history
  const fetchOutreachHistory = async (operatorId) => {
    if (!operatorId) return;

    setLoadingHistory(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/outreach-history`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-operator-id": operatorId,
          },
        },
      );

      if (!res.ok) throw new Error("Failed to fetch history");

      const data = await res.json();
      setOutreachHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Send manual flirt
  const handleSendFlirt = async () => {
    if (!selectedUser || !selectedFictional) {
      showToast("Please select a user and a fictional profile", "error");
      return;
    }

    if (!message.trim() && !selectedPhoto) {
      showToast("Please write a message or select a photo", "error");
      return;
    }

    if (message.trim() && message.length < 20) {
      showToast("Message must be at least 20 characters", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSend = async () => {
    setSending(true);

    try {
      // First, send the flirt message
      let conversationId = null;

      if (message.trim()) {
        const res = await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/send-manual-flirt",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-operator-id": operator.id,
            },
            body: JSON.stringify({
              user_id: selectedUser.id,
              fictional_profile_id: selectedFictional.id,
              content: message,
              operator_id: operator.id,
              send_email: sendEmail,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 429) {
            showToast(data.error || "Daily limit reached", "error");
            setSending(false);
            setShowConfirmModal(false);
            return;
          }
          throw new Error(data.error || "Failed to send");
        }

        conversationId = data.conversationId;
        setRemainingDaily(data.remaining_daily || 0);
      }

      // ✅ Send selected photo AFTER the message (only one photo)
      if (selectedPhoto) {
        const photoRes = await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/send-photo",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-operator-id": operator.id,
            },
            body: JSON.stringify({
              photo_id: selectedPhoto.id,
              conversation_id: conversationId,
              fictional_profile_id: selectedFictional.id,
              operator_id: operator.id,
            }),
          },
        );

        if (!photoRes.ok) {
          console.error("Failed to send photo:", selectedPhoto.id);
        }
      }

      // Close modal and show success
      setShowConfirmModal(false);
      showToast(`✅ Flirt message sent successfully!`, "success");

      // Reset form
      setMessage("");
      setSendEmail(false);
      setSelectedPhoto(null);

      // Refresh history
      fetchOutreachHistory(operator.id);
    } catch (err) {
      console.error("Send error:", err);
      setShowConfirmModal(false);
      showToast("Failed to send: " + err.message, "error");
    } finally {
      setSending(false);
    }
  };

  // Show toast notification
  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Format user interests for display
  const formatInterests = (interests) => {
    if (!interests || interests.length === 0) return "No interests listed";
    return interests.slice(0, 5).join(" • ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-500 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🎯</span> Manual Outreach
              </h1>
              <p className="text-white/80 text-sm">
                Proactively start conversations with users
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">
                {operator?.username}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div
            className={`px-6 py-3 rounded-xl shadow-lg border ${
              toast.type === "error"
                ? "bg-red-500 border-red-400 text-white"
                : toast.type === "success"
                  ? "bg-green-500 border-green-400 text-white"
                  : "bg-primary border-white/20 text-white"
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Search & Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search User */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>🔎</span> Find User
              </h3>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by Display Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full text-left p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-800">
                          {user.display_name}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <div className="flex gap-2 mt-1 text-xs text-gray-400">
                          <span>{user.age || "?"} years</span>
                          <span>•</span>
                          <span>
                            {user.city || "N/A"}, {user.country || "N/A"}
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 &&
                searchResults.length === 0 &&
                !searching && (
                  <p className="mt-3 text-sm text-gray-500 text-center">
                    No users found
                  </p>
                )}
            </div>

            {/* Selected User Info */}
            {selectedUser && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-primary">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {selectedUser.display_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedUser.email}
                    </p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Age</p>
                    <p className="font-medium">{selectedUser.age || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Gender</p>
                    <p className="font-medium capitalize">
                      {selectedUser.gender || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">
                      {selectedUser.city || "N/A"},{" "}
                      {selectedUser.state || "N/A"},{" "}
                      {selectedUser.country || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Interests</p>
                    <p className="font-medium text-sm">
                      {formatInterests(selectedUser.interests)}
                    </p>
                  </div>
                  {selectedUser.relationship_goals &&
                    selectedUser.relationship_goals.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-gray-500">Looking for</p>
                        <p className="font-medium text-sm">
                          {selectedUser.relationship_goals.join(", ")}
                        </p>
                      </div>
                    )}
                </div>

                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSuggestedProfiles([]);
                    setSelectedFictional(null);
                    setSelectedPhoto(null);
                  }}
                  className="mt-3 text-xs text-gray-400 hover:text-red-500 transition"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          {/* Middle Column - Fictional Profile Selection & Message */}
          <div className="lg:col-span-2 space-y-6">
            {/* Fictional Profile Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>🎭</span> Select Fictional Profile
              </h3>

              {/* Suggested Profiles */}
              {selectedUser && (
                <>
                  {loadingProfiles ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : suggestedProfiles.length > 0 ? (
                    <div>
                      {suggestedCriteria && (
                        <p className="text-xs text-gray-400 mb-2">
                          Matching:{" "}
                          {suggestedCriteria.state !== "any" &&
                            `📍 ${suggestedCriteria.state}`}
                          {suggestedCriteria.city !== "any" &&
                            ` • ${suggestedCriteria.city}`}
                          {suggestedCriteria.age_range !== "any" &&
                            ` • Age ${suggestedCriteria.age_range}`}
                        </p>
                      )}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
                        {suggestedProfiles.map((profile) => (
                          <button
                            key={profile.id}
                            onClick={() => handleSelectFictional(profile)}
                            className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all ${
                              selectedFictional?.id === profile.id
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <img
                              src={profile.image_url || "/default-avatar.png"}
                              alt={profile.display_name}
                              className="w-16 h-16 rounded-full object-cover mx-auto"
                              onError={(e) => {
                                e.target.src = "/default-avatar.png";
                              }}
                            />
                            <p className="text-xs font-medium text-center mt-1 truncate w-16">
                              {profile.display_name}
                            </p>
                            <p className="text-[10px] text-gray-400 text-center">
                              {profile.age || "?"} • {profile.city || "N/A"}
                            </p>
                            {selectedFictional?.id === profile.id && (
                              <div className="flex justify-center mt-1">
                                <svg
                                  className="w-4 h-4 text-primary"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No matching profiles found
                    </p>
                  )}
                </>
              )}

              {/* Search Fictional Profiles */}
              {selectedUser && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search fictional profile by name..."
                      value={fictionalSearchQuery}
                      onChange={(e) => {
                        setFictionalSearchQuery(e.target.value);
                        if (e.target.value.length >= 2) {
                          searchFictionalProfiles();
                        } else {
                          setFictionalSearchResults([]);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    {searchingFictional && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      </div>
                    )}
                  </div>

                  {fictionalSearchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {fictionalSearchResults.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => handleSelectFictional(profile)}
                          className={`w-full text-left p-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-3 ${
                            selectedFictional?.id === profile.id
                              ? "bg-primary/5"
                              : ""
                          }`}
                        >
                          <img
                            src={profile.image_url || "/default-avatar.png"}
                            alt={profile.display_name}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              e.target.src = "/default-avatar.png";
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {profile.display_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {profile.age || "?"} • {profile.city || "N/A"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!selectedUser && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Search and select a user first to see suggestions
                </p>
              )}
            </div>

            {/* Selected Fictional Profile Preview */}
            {selectedFictional && (
              <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedFictional.image_url || "/default-avatar.png"}
                    alt={selectedFictional.display_name}
                    className="w-14 h-14 rounded-full object-cover"
                    onError={(e) => {
                      e.target.src = "/default-avatar.png";
                    }}
                  />
                  <div>
                    <p className="font-semibold text-gray-800">
                      Messaging as: {selectedFictional.display_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedFictional.age || "?"} years •{" "}
                      {selectedFictional.city || "N/A"},{" "}
                      {selectedFictional.state || "N/A"}
                    </p>
                    {selectedFictional.bio && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {selectedFictional.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ✅ Private Photos Section - Single selection only */}
            {selectedFictional && privatePhotos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <button
                  onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium mb-2 transition"
                >
                  <svg
                    className="w-5 h-5"
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
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {privatePhotos.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => handleSelectPhoto(photo)}
                            className={`relative rounded-lg overflow-hidden aspect-square transition-all ${
                              selectedPhoto?.id === photo.id
                                ? "ring-4 ring-primary ring-offset-2"
                                : "hover:ring-2 hover:ring-primary/30"
                            }`}
                          >
                            <img
                              src={photo.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {selectedPhoto?.id === photo.id && (
                              <div className="absolute top-1 right-1 bg-primary rounded-full p-1">
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

            {/* ✅ Selected Photo Preview - Single */}
            {selectedPhoto && (
              <div className="bg-white rounded-2xl shadow-lg p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary">
                    Photo to send:
                  </span>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2">
                  <img
                    src={selectedPhoto.image_url}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    alt=""
                  />
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>💬</span> Write Your Message
              </h3>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder="Craft an engaging first message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none min-h-[100px]"
                disabled={!selectedFictional}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">
                  {message.length}/500 characters
                </span>
                <span className="text-xs text-gray-400">
                  Min 20 characters recommended
                </span>
              </div>

              {/* Email Checkbox */}
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="sendEmail" className="text-sm text-gray-600">
                  📧 Send email notification to user
                </label>
              </div>

              {/* Daily Limit Info */}
              <div className="mt-3 text-xs text-gray-400">
                Remaining today:{" "}
                <span className="font-medium">{remainingDaily}</span> of 20
                messages
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendFlirt}
                disabled={
                  !selectedUser ||
                  !selectedFictional ||
                  (!message.trim() && !selectedPhoto) ||
                  (message.trim() && message.length < 20) ||
                  sending
                }
                className="mt-4 w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Send Flirt Message
                  </>
                )}
              </button>

              {selectedUser && !selectedFictional && (
                <p className="mt-2 text-xs text-red-500 text-center">
                  Please select a fictional profile
                </p>
              )}
              {selectedFictional &&
                message.length > 0 &&
                message.length < 20 && (
                  <p className="mt-2 text-xs text-red-500 text-center">
                    Please add at least {20 - message.length} more characters
                  </p>
                )}
              {selectedFictional && !message.trim() && !selectedPhoto && (
                <p className="mt-2 text-xs text-red-500 text-center">
                  Please write a message or select a photo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Outreach History - Collapsible Section */}
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full bg-white rounded-2xl shadow-lg p-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <span className="font-semibold text-gray-700">
                Outreach History
              </span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                {outreachHistory.length} records
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showHistory && (
            <div className="mt-2 bg-white rounded-2xl shadow-lg p-4">
              {loadingHistory ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : outreachHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">
                  No outreach history yet
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-500">
                          User
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500">
                          Fictional
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500">
                          Sent
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachHistory.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="p-3">
                            <p className="font-medium text-gray-800">
                              {item.user_profiles?.display_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {item.user_profiles?.city || "N/A"}
                            </p>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={
                                  item.fictional_profiles?.image_url ||
                                  "/default-avatar.png"
                                }
                                alt={item.fictional_profiles?.display_name}
                                className="w-6 h-6 rounded-full object-cover"
                                onError={(e) => {
                                  e.target.src = "/default-avatar.png";
                                }}
                              />
                              <span className="text-sm">
                                {item.fictional_profiles?.display_name ||
                                  "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {new Date(item.sent_at).toLocaleDateString()}
                            <br />
                            <span className="text-gray-400">
                              {new Date(item.sent_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${
                                  item.is_old
                                    ? "bg-gray-100 text-gray-400"
                                    : "bg-green-100 text-green-600"
                                }`}
                              >
                                {item.is_old ? "Expired" : "Active"}
                              </span>
                              {item.email_sent && (
                                <span className="text-xs text-blue-500">
                                  📧 Sent
                                </span>
                              )}
                              {item.days_ago !== undefined && (
                                <span className="text-[10px] text-gray-400">
                                  {item.days_ago === 0
                                    ? "Today"
                                    : `${item.days_ago}d ago`}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Shows last 50 records • Records auto-clear after 5 days
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Confirmation Modal with Loading State */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                {sending ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                ) : (
                  <span className="text-3xl">✋</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {sending ? "Sending..." : "Confirm Send"}
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                {sending
                  ? "Please wait, this may take a moment..."
                  : "Carefully check your message before sending"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1">To:</p>
              <p className="font-medium text-gray-800">
                {selectedUser?.display_name}
              </p>
              <p className="text-xs text-gray-500 mt-2 mb-1">
                From (as fictional):
              </p>
              <p className="font-medium text-gray-800">
                {selectedFictional?.display_name}
              </p>
              <p className="text-xs text-gray-500 mt-2 mb-1">Message:</p>
              <p className="text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-200">
                {message || "📷 Photo message only"}
              </p>
              {selectedPhoto && (
                <>
                  <p className="text-xs text-gray-500 mt-2 mb-1">Photo:</p>
                  <div className="flex gap-2">
                    <img
                      src={selectedPhoto.image_url}
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                      alt=""
                    />
                  </div>
                </>
              )}
              {sendEmail && (
                <p className="text-xs text-blue-500 mt-2">
                  📧 Email notification will be sent
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={sending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  "Confirm Send"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
