import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import DefaultAvatar from "../assets/default-avatar-male.svg";
import { useInactivityLogout } from "../hooks/useInactivityLogout";
import { supabase } from "../lib/supabaseClient";

export default function ChatInterface() {
  const [reply, setReply] = useState("");
  const [remainingTime, setRemainingTime] = useState(300);
  const [isSending, setIsSending] = useState(false);
  const [userLocalTime, setUserLocalTime] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [privatePhotos, setPrivatePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [userLogbook, setUserLogbook] = useState({});
  const [fictionalLogbook, setFictionalLogbook] = useState({});
  const [showUserNoteModal, setShowUserNoteModal] = useState(false);
  const [showFictionalNoteModal, setShowFictionalNoteModal] = useState(false);
  const [noteCategory, setNoteCategory] = useState("");
  const [noteValue, setNoteValue] = useState("");
  const [activeImage, setActiveImage] = useState(null);

  const [selectedPhotos, setSelectedPhotos] = useState([]); // Array of selected photo objects
  const [noteType, setNoteType] = useState("user"); // 'user' or 'fictional'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFullUserBio, setShowFullUserBio] = useState(false);
  const [showFullFictionalBio, setShowFullFictionalBio] = useState(false);
  const emojiPickerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);

  // Add this after the operator declaration
  const operator = JSON.parse(localStorage.getItem("operator") || "{}");
  const isStopped = operator?.operator_type === "stopped";

  // ✅ Add this line - enables auto-logout after 30 minutes of inactivity
  useInactivityLogout(30);

  const chatData = location.state;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!chatData) {
      navigate("/dashboard");
      return;
    }

    fetchMessages();
    fetchPrivatePhotos();
    fetchUserLogbook();
    fetchFictionalLogbook();

    const expiresAt = new Date(chatData.expiresAt);
    const updateRemainingTime = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingTime(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        alert("Message timeout. Returning to dashboard...");
        navigate("/dashboard");
      }
    };

    updateRemainingTime();
    timerRef.current = setInterval(updateRemainingTime, 1000);

    updateUserLocalTime();
    const timeInterval = setInterval(updateUserLocalTime, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(timeInterval);
    };
  }, [chatData, navigate]);

  useEffect(() => {
    if (!chatData?.conversationId) return;

    const channel = supabase
      .channel(`messages:${chatData.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chatData.conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new;

          // Only add messages from users (not the operator's own replies)
          if (newMessage.sender_type === "real_user") {
            console.log("📨 New message received:", newMessage);
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
            scrollToBottom();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatData?.conversationId]);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/conversations/${chatData.conversationId}/messages`,
      );
      const data = await res.json();
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchPrivatePhotos = async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/private-photos/${chatData.fictionalProfile.id}?conversation_id=${chatData.conversationId}`,
      );
      const data = await res.json();
      setPrivatePhotos(data || []);
    } catch (err) {
      console.error("Failed to fetch private photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchUserLogbook = async () => {
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/user-logbook/${chatData.userProfile.id}`,
      );
      const data = await res.json();
      setUserLogbook(data || {});
    } catch (err) {
      console.error("Failed to fetch user logbook:", err);
    }
  };

  const fetchFictionalLogbook = async () => {
    try {
      const res = await fetch(
        `https://operator-api-production-de23.up.railway.app/operator/fictional-logbook/${chatData.fictionalProfile.id}`,
      );
      const data = await res.json();
      setFictionalLogbook(data || {});
    } catch (err) {
      console.error("Failed to fetch fictional logbook:", err);
    }
  };

  const updateUserLocalTime = () => {
    const userCountry = chatData?.userProfile?.country;
    if (userCountry) {
      try {
        const time = new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        setUserLocalTime(time);
      } catch (err) {
        setUserLocalTime(new Date().toLocaleTimeString());
      }
    } else {
      setUserLocalTime(new Date().toLocaleTimeString());
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Replace the handleSendReply function to include photos:
  const handleSendReply = async () => {
    if (reply.length < 20 && selectedPhotos.length === 0) {
      alert(
        "Please enter a message (at least 20 characters) or select a photo",
      );
      return;
    }

    if (isSending) return;

    setIsSending(true);
    try {
      // First, send text message if any
      if (reply.length >= 20) {
        console.log("SEND REPLY PAYLOAD", {
          queue_id: chatData.queueId,
          conversation_id: chatData.conversationId,
          fictional_profile_id: chatData.fictionalProfile?.id,
          content: reply,
          operator_id: operator?.id,
          image_url:
            selectedPhotos.length > 0 ? selectedPhotos[0].image_url : null,
        });

        const sendEndpoint = isStopped
          ? "https://operator-api-production-de23.up.railway.app/stopped/send-message"
          : "https://operator-api-production-de23.up.railway.app/operator/send-reply";

        const textRes = await fetch(sendEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queue_id: chatData.queueId,
            conversation_id: chatData.conversationId,
            fictional_profile_id: chatData.fictionalProfile.id,
            content: reply,
            operator_id: operator.id,
            image_url:
              selectedPhotos.length > 0 ? selectedPhotos[0].image_url : null, // ✅ Send image URL
            device_id: localStorage.getItem("operator_device_id"),
          }),
        });

        if (!textRes.ok) {
          const errorData = await textRes.json();

          // Duplicate device protection
          if (textRes.status === 409) {
            alert(
              "This conversation is already being handled on another device/tab for this operator account.",
            );

            // Immediately leave chat
            navigate("/dashboard");

            return;
          }

          throw new Error(errorData.error || "Failed to send message");
        }
      }

      // Then, send each selected photo
      for (const photo of selectedPhotos) {
        const photoRes = await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/send-photo",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photo_id: photo.id,
              conversation_id: chatData.conversationId,
              fictional_profile_id: chatData.fictionalProfile.id,
              operator_id: operator.id,
            }),
          },
        );

        if (!photoRes.ok) {
          const errorData = await photoRes.json();
          console.error("Failed to send photo:", errorData);
        }
      }

      // Refresh messages to show new content
      await fetchMessages();
      await fetchPrivatePhotos(); // Refresh photo sent status

      setReply("");
      setSelectedPhotos([]);
      scrollToBottom();

      // Small delay before navigating back
      setTimeout(() => {
        navigate("/waiting-room");
      }, 1500);
    } catch (err) {
      console.error("Send error:", err);
      alert(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Replace the handleSelectPhoto function
  const handleSelectPhoto = (photo) => {
    if (photo.is_sent_to_conversation) {
      alert("This photo has already been sent in this conversation");
      return;
    }

    // Single selection - if clicking same photo, deselect it; otherwise select new one
    if (selectedPhotos.some((p) => p.id === photo.id)) {
      setSelectedPhotos([]); // Deselect all
    } else {
      setSelectedPhotos([photo]); // Select only this photo (replace any existing)
    }
  };

  const handleSaveUserNote = async () => {
    if (!noteCategory) return;

    try {
      const res = await fetch(
        "https://operator-api-production-de23.up.railway.app/operator/user-logbook",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_profile_id: chatData.userProfile.id,
            category: noteCategory,
            value: noteValue,
            operator_id: operator.id,
          }),
        },
      );

      if (res.ok) {
        fetchUserLogbook();
        setShowUserNoteModal(false);
        setNoteCategory("");
        setNoteValue("");
        alert("Note saved successfully!");
      } else {
        alert("Failed to save note");
      }
    } catch (err) {
      console.error("Save user note error:", err);
      alert("Network error");
    }
  };

  const handleSaveFictionalNote = async () => {
    if (!noteCategory) return;

    try {
      const res = await fetch(
        "https://operator-api-production-de23.up.railway.app/operator/fictional-logbook",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fictional_profile_id: chatData.fictionalProfile.id,
            category: noteCategory,
            value: noteValue,
            operator_id: operator.id,
          }),
        },
      );

      if (res.ok) {
        fetchFictionalLogbook();
        setShowFictionalNoteModal(false);
        setNoteCategory("");
        setNoteValue("");
        alert("Note saved successfully!");
      } else {
        alert("Failed to save note");
      }
    } catch (err) {
      console.error("Save fictional note error:", err);
      alert("Network error");
    }
  };

  const handleStopChatting = async () => {
    if (
      window.confirm(
        "Are you sure you want to stop chatting? This message will be returned to the queue for another operator to handle.",
      )
    ) {
      try {
        // Release the current message back to the queue
        await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/release-message",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queue_id: chatData.queueId,
              operator_id: operator.id,
            }),
          },
        );
        navigate("/dashboard");
      } catch (err) {
        console.error("Stop chatting error:", err);
        navigate("/dashboard");
      }
    }
  };

  const handleLogout = async () => {
    if (chatData?.queueId) {
      // Release the message back to queue before logging out
      try {
        await fetch(
          "https://operator-api-production-de23.up.railway.app/operator/release-message",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queue_id: chatData.queueId,
              operator_id: operator.id,
            }),
          },
        );
      } catch (err) {
        console.error("Release message on logout error:", err);
      }
    }

    localStorage.removeItem("operator");
    navigate("/");
  };

  const user = chatData?.userProfile;
  const fictional = chatData?.fictionalProfile;

  const countryColors = () => {
    const country = user?.country;
    switch (country) {
      case "GB":
        return "from-blue-600 to-blue-700";
      case "US":
        return "from-red-700 to-blue-700";
      case "CA":
        return "from-red-600 to-red-700";
      case "AU":
        return "from-blue-600 to-red-600";
      case "ZA":
        return "from-green-700 to-yellow-700";
      default:
        return "from-gray-700 to-gray-800";
    }
  };

  // Categories for logbook
  const userNoteCategories = [
    { value: "name", label: "Name" },
    { value: "contact", label: "Contact Information" },
    { value: "city", label: "City" },
    { value: "age", label: "Age" },
    { value: "job", label: "Job" },
    { value: "notes", label: "General Notes" },
    { value: "sexual_preference", label: "Sexual Preference" },
    { value: "personal_information", label: "Personal Information" },
  ];

  const fictionalNoteCategories = [
    { value: "name_given", label: "Name Given" },
    { value: "backstory", label: "Backstory" },
    { value: "personality", label: "Personality" },
    { value: "preferences", label: "Preferences" },
    { value: "notes", label: "General Notes" },
  ];

  const parseInterests = (interests) => {
    if (!interests) return [];
    if (Array.isArray(interests)) return interests;
    if (typeof interests === "string") {
      try {
        const cleaned = interests.replace(/[{}]/g, "");
        return cleaned
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i);
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const fictionalInterests = parseInterests(fictional?.interests);
  const userInterests = parseInterests(user?.interests);

  // Add emoji click handler
  const handleEmojiSelect = (emoji) => {
    setReply((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded-lg">
              {operator.username}
            </span>
            <span className="text-sm text-gray-500">
              Replying as: {fictional?.display_name}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleStopChatting}
              className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
            >
              Stop chatting
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* LEFT COLUMN - Fictional Profile Details */}
            <div className="lg:col-span-3 overflow-y-auto h-full space-y-4">
              {/* Fictional Profile Info */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-linear-to-r from-primary to-secondary bg-gray-200 px-4 py-3">
                  <div className="flex items-center gap-4">
                    <img
                      src={
                        fictional?.image_url || "https://via.placeholder.com/64"
                      }
                      alt={fictional?.display_name}
                      onClick={() => setActiveImage(fictional?.image_url)}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-white/30"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/64?text=No+Image";
                      }}
                    />
                    <div>
                      <h2 className="text-lg font-bold text-black">
                        {fictional?.display_name}, ({fictional?.name || "N/A"})
                      </h2>
                      <p className="text-black text-xs">
                        {fictional?.city || "Unknown"}, {fictional?.state || ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-600 mb-5">
                      About profile
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {showFullFictionalBio
                        ? fictional?.about ||
                          fictional?.bio ||
                          "No bio provided"
                        : truncateText(
                            fictional?.about ||
                              fictional?.bio ||
                              "No bio provided",
                            100,
                          )}
                    </p>

                    {(fictional?.about?.length > 100 ||
                      fictional?.bio?.length > 100 ||
                      fictional?.about?.split(/\s+/).length > 20 ||
                      fictional?.bio?.split(/\s+/).length > 20) && (
                      <button
                        onClick={() =>
                          setShowFullFictionalBio(!showFullFictionalBio)
                        }
                        className="text-xs text-primary mt-1 hover:underline focus:outline-none"
                      >
                        {showFullFictionalBio ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  {/* Fictional Profile Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">
                        Relationship:
                      </span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.relationship || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Age:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.age || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Body Type:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.body_type || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Height:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.height
                          ? `${fictional.height} cm`
                          : "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Eye Color:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.eye_color || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-xs text-gray-500">Hair Color:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {fictional?.hair_color || "Not specified"}
                      </span>
                    </div>
                  </div>

                  {/* Fictional Preferences */}
                  {fictionalInterests.length > 0 && (
                    <div className="mt-4 mb-4">
                      <h4 className="text-xs font-semibold text-gray-600 mb-3">
                        Preferences
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {fictionalInterests.slice(0, 8).map((interest, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-700"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Private Photos Gallery */}
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Private Photos
                      </h3>
                      {selectedPhotos.length > 0 && (
                        <p className="text-xs text-primary mt-1">
                          {selectedPhotos.length} photo(s) selected
                        </p>
                      )}
                    </div>
                    <div className="p-3">
                      {loadingPhotos ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      ) : privatePhotos.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-4">
                          No private photos
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {privatePhotos.map((photo) => {
                            const isSelected = selectedPhotos.some(
                              (p) => p.id === photo.id,
                            );
                            const isSent = photo.is_sent_to_conversation;

                            return (
                              <button
                                key={photo.id}
                                onClick={() =>
                                  !isSent && handleSelectPhoto(photo)
                                }
                                disabled={isSent}
                                className={`relative rounded-lg overflow-hidden aspect-square transition-all ${
                                  isSent
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer hover:ring-2 hover:ring-primary"
                                } ${isSelected ? "ring-4 ring-green-500 ring-offset-2" : ""}`}
                              >
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption || "Private photo"}
                                  className="w-full h-full object-cover"
                                />
                                {isSent && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <svg
                                      className="w-6 h-6 text-white"
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
                                {isSelected && !isSent && (
                                  <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
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
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fictional Logbook Button */}
                  <button
                    onClick={() => {
                      setNoteType("fictional");
                      setShowFictionalNoteModal(true);
                    }}
                    className="w-full mt-4 px-3 py-2 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                  >
                    📝 Personal information
                  </button>

                  {/* Fictional Logbook Display */}
                  {Object.keys(fictionalLogbook).length > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">
                        New profile note
                      </p>
                      {fictionalLogbook.name_given && (
                        <p className="text-xs text-gray-700">
                          <strong>Name:</strong> {fictionalLogbook.name_given}
                        </p>
                      )}
                      {fictionalLogbook.backstory && (
                        <p className="text-xs text-gray-700">
                          <strong>Backstory:</strong>{" "}
                          {fictionalLogbook.backstory}
                        </p>
                      )}
                      {fictionalLogbook.notes && (
                        <p className="text-xs text-gray-700">
                          <strong>Notes:</strong> {fictionalLogbook.notes}
                        </p>
                      )}
                      {!fictionalLogbook.name_given &&
                        !fictionalLogbook.backstory &&
                        !fictionalLogbook.notes && (
                          <p className="text-xs text-gray-400">No notes</p>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER COLUMN - Conversation */}
            <div className="lg:col-span-6 h-full">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col h-140">
                {/* Chat Header */}
                <div
                  className={`bg-gradient-to-r ${countryColors()} px-4 py-2 flex justify-between items-center flex-shrink-0`}
                >
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      Conversation
                    </h3>
                    <p className="text-xs text-white/70">
                      {user?.display_name} ↔ {fictional?.display_name}
                    </p>
                  </div>
                  {/* Country indicator with flag and local time */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      {/* Flag */}
                      <ReactCountryFlag
                        countryCode={
                          user?.country === "GB"
                            ? "GB"
                            : user?.country === "US"
                              ? "US"
                              : user?.country === "CA"
                                ? "CA"
                                : user?.country === "AU"
                                  ? "AU"
                                  : user?.country === "ZA"
                                    ? "ZA"
                                    : "GB"
                        }
                        svg
                        style={{
                          width: "1.5em",
                          height: "1.5em",
                        }}
                      />
                      {/* Country code */}
                      <span className="font-semibold text-white text-sm">
                        {user?.country === "GB"
                          ? "UK"
                          : user?.country === "US"
                            ? "USA"
                            : user?.country === "CA"
                              ? "CA"
                              : user?.country === "AU"
                                ? "AU"
                                : user?.country === "ZA"
                                  ? "ZA"
                                  : "INT"}
                      </span>

                      {/* Separator */}
                      <span className="text-white/40 text-xs">•</span>
                    </div>

                    <p className="text-xs font-mono text-white">
                      {userLocalTime}
                    </p>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-130 text-center">
                      <svg
                        className="w-12 h-12 mb-3 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <p className="text-gray-500 text-sm">No messages yet</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => {
                        const isUser = msg.sender_type === "real_user";
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-xs rounded-2xl shadow-sm overflow-hidden ${
                                isUser
                                  ? "bg-blue-500 text-white rounded-br-sm"
                                  : "bg-gray-200 text-gray-800 rounded-bl-sm"
                              }`}
                            >
                              {/* Image on top if exists */}
                              {msg.image_url && (
                                <img
                                  src={msg.image_url}
                                  onClick={() => setActiveImage(msg.image_url)}
                                  className="w-full rounded-t-2xl cursor-pointer"
                                  alt="attachment"
                                />
                              )}
                              {/* Text below image */}
                              {msg.content && (
                                <div className="px-4 py-2">
                                  <p className="text-sm break-words">
                                    {msg.content}
                                  </p>
                                  <p
                                    className={`text-xs mt-1 ${isUser ? "text-black" : "text-gray-500"}`}
                                  >
                                    {formatMessageTime(msg.created_at)}
                                  </p>
                                </div>
                              )}
                              {/* If only image, no text - still show timestamp */}
                              {msg.image_url && !msg.content && (
                                <div className="px-4 py-1">
                                  <p
                                    className={`text-xs ${isUser ? "text-white/70" : "text-gray-500"}`}
                                  >
                                    {formatMessageTime(msg.created_at)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Selected Photos Preview */}
                {selectedPhotos.length > 0 && (
                  <div className="mb-2 p-2 bg-gray-100 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        Photos to send ({selectedPhotos.length})
                      </span>
                      <button
                        onClick={() => setSelectedPhotos([])}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        clear
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {selectedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-primary"
                        >
                          <img
                            src={photo.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() =>
                              setSelectedPhotos((prev) =>
                                prev.filter((p) => p.id !== photo.id),
                              )
                            }
                            className="absolute top-0 right-0 bg-red-500 rounded-full p-0.5"
                          >
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Input - Send button beside textarea */}
                <div className="flex-shrink-0 border-t p-3 bg-gray-50">
                  {/* Character counter */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Characters</span>
                    <span
                      className={`text-xs font-mono ${reply.length < 20 ? "text-red-500" : "text-green-500"}`}
                    >
                      {reply.length}/800{" "}
                      {reply.length < 20 &&
                        `(${20 - reply.length} more required)`}
                    </span>
                  </div>

                  {/* Textarea, Emoji Button, and Send Button - Side by side */}
                  <div className="flex gap-2 items-end">
                    {/* Emoji Button with Picker */}
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-3 rounded-full bg-gray-300 hover:bg-gray-200 transition-colors duration-200"
                        type="button"
                      >
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </button>

                      {/* Emoji Picker Dropdown */}
                      {showEmojiPicker && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-64 z-50">
                          <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                            {[
                              "😀",
                              "😂",
                              "😍",
                              "🤣",
                              "😊",
                              "😉",
                              "😎",
                              "😢",
                              "😡",
                              "👍",
                              "❤️",
                              "🔥",
                              "🎉",
                              "✨",
                              "💀",
                              "👋",
                              "🙏",
                              "💯",
                              "🔞",
                              "🍆",
                              "💦",
                              "👅",
                              "💋",
                              "🌹",
                              "💔",
                              "😘",
                              "🥰",
                              "😈",
                            ].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleEmojiSelect(emoji)}
                                className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Textarea */}
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value.slice(0, 800))}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                      rows={2}
                    />

                    {/* Send Button */}
                    <button
                      onClick={handleSendReply}
                      disabled={reply.length < 20 || isSending}
                      className={`p-3 rounded-full transition-all duration-300 ${
                        reply.length >= 20 && !isSending
                          ? "bg-blue-500 text-white hover:shadow-lg hover:scale-105"
                          : "bg-gray-300 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isSending ? (
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M4 12a8 8 0 018-8"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 transform rotate-45"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Timer - moved below */}
                  <div className="flex items-center gap-1 mt-2">
                    <svg
                      className="w-3.5 h-3.5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 6v6l4 2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-xs text-gray-500">
                      Remaining time:
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${remainingTime < 60 ? "text-red-500" : "text-primary"}`}
                    >
                      {formatTime(remainingTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - User Details */}
            <div className="lg:col-span-3 overflow-y-auto h-full space-y-4">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className={`bg-linear-to-r ${countryColors()} px-6 py-4`}>
                  <div className="flex items-center gap-4">
                    <img
                      src={user?.profile_img || DefaultAvatar}
                      alt={user?.display_name}
                      onClick={() => setActiveImage(user?.profile_img)}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-white/30"
                      onError={(e) => {
                        e.currentTarget.onerror = null; // prevent infinite loop
                        e.currentTarget.src = DefaultAvatar;
                      }}
                    />
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-white">
                        {user?.display_name || "User"}
                      </h2>
                      <p className="text-white/80 text-xs">
                        {user?.city || "Unknown"}, {user?.state || ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-5">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-xs font-semibold text-gray-600">
                        About user
                      </h3>
                      <div className="bg-gray-400 px-2 py-1 rounded">
                        <button className="text-xs text-red-500 hover:text-red-600">
                          Report
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-700 text-sm leading-relaxed">
                      {showFullUserBio
                        ? user?.bio || "No bio provided"
                        : truncateText(user?.bio || "No bio provided", 100)}
                    </p>

                    {(user?.bio?.length > 100 ||
                      user?.bio?.split(/\s+/).length > 20) && (
                      <button
                        onClick={() => setShowFullUserBio(!showFullUserBio)}
                        className="text-xs text-primary mt-1 hover:underline focus:outline-none"
                      >
                        {showFullUserBio ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Gender:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.gender || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">
                        Relationship:
                      </span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.marital_status || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Age:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.age || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Body Type:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.body_type || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Height:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.height ? `${user.height} cm` : "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-xs text-gray-500">Eye Color:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.eye_color || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-xs text-gray-500">Hair Color:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.hair_color || "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-xs text-gray-500">Smoker:</span>
                      <span className="text-xs font-medium text-gray-700">
                        {user?.smoker === "Yes"
                          ? "Yes"
                          : user?.smoker === "No"
                            ? "No"
                            : "Not specified"}
                      </span>
                    </div>
                  </div>

                  {/* User Preferences */}
                  {user?.interests?.length > 0 && (
                    <div className="mb-4 mt-3">
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">
                        Preferences
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {user.interests.slice(0, 6).map((interest, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Sent Photos - Display photos user has sent in this conversation */}
                  {(() => {
                    // Filter messages where user sent photos
                    const userPhotos = messages.filter(
                      (msg) => msg.sender_type === "real_user" && msg.image_url,
                    );

                    if (userPhotos.length === 0) return null;

                    return (
                      <div className="mt-4 mb-4">
                        <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                          <svg
                            className="w-3.5 h-3.5"
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
                          User Photos ({userPhotos.length})
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {userPhotos.slice(0, 6).map((msg, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveImage(msg.image_url)}
                              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary transition-all"
                            >
                              <img
                                src={msg.image_url}
                                alt={`User photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                                {new Date(msg.created_at).toLocaleDateString()}
                              </div>
                            </button>
                          ))}
                        </div>
                        {userPhotos.length > 6 && (
                          <button
                            onClick={() => {
                              // Optionally open a modal with all photos
                              alert(
                                `Total ${userPhotos.length} photos shared in this conversation`,
                              );
                            }}
                            className="text-xs text-primary mt-2 hover:underline"
                          >
                            +{userPhotos.length - 6} more
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* User Logbook Button */}
                  <button
                    onClick={() => {
                      setNoteType("user");
                      setShowUserNoteModal(true);
                    }}
                    className="w-full px-3 py-2 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                  >
                    📝 Personal information
                  </button>

                  {/* User Logbook Display */}
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">
                      New member note
                    </p>
                    {Object.keys(userLogbook).length > 0 ? (
                      <>
                        {userLogbook.name && (
                          <p className="text-xs text-gray-700">
                            <strong>Name:</strong> {userLogbook.name}
                          </p>
                        )}
                        {userLogbook.contact && (
                          <p className="text-xs text-gray-700">
                            <strong>Contact:</strong> {userLogbook.contact}
                          </p>
                        )}
                        {userLogbook.city && (
                          <p className="text-xs text-gray-700">
                            <strong>City:</strong> {userLogbook.city}
                          </p>
                        )}
                        {userLogbook.notes && (
                          <p className="text-xs text-gray-700">
                            <strong>Notes:</strong> {userLogbook.notes}
                          </p>
                        )}
                        {!userLogbook.name &&
                          !userLogbook.contact &&
                          !userLogbook.city &&
                          !userLogbook.notes && (
                            <p className="text-xs text-gray-400">No notes</p>
                          )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">No notes</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Note Modal */}
      {showUserNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5">
            <h3 className="text-lg font-semibold mb-4">Add User Information</h3>
            <div className="space-y-3">
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select category</option>
                {userNoteCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Enter information..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUserNoteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUserNote}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fictional Note Modal */}
      {showFictionalNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5">
            <h3 className="text-lg font-semibold mb-4">
              Add Fictional Profile Information
            </h3>
            <div className="space-y-3">
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="w-100 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select category</option>
                {fictionalNoteCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Enter information..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFictionalNoteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFictionalNote}
                  className="flex-1 px-4 py-2 bg-gray-500 text-black rounded-lg hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setActiveImage(null)}
        >
          <img
            src={activeImage}
            alt="preview"
            className="max-w-[90vw] max-h-[90vh] border border-white rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
