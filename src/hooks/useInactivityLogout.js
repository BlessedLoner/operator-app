// src/hooks/useInactivityLogout.js
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export function useInactivityLogout(INACTIVITY_MINUTES = 30) {
  const navigate = useNavigate();
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_TIMEOUT = INACTIVITY_MINUTES * 60 * 1000;
  const isLoggingOut = useRef(false);

  const LAST_ACTIVITY_KEY = "operator_last_activity";

  // Check if operator account is still active
  const checkIfActive = async (retryCount = 0) => {
    const operatorData = localStorage.getItem("operator");
    if (!operatorData) return;

    const operator = JSON.parse(operatorData);

    try {
      const { data, error } = await supabase
        .from("operator_accounts")
        .select("is_active")
        .eq("id", operator.id)
        .single();

      if (error) {
        // ✅ If it's a network error, don't log out - just retry
        if (error.code === "PGRST301" || error.message?.includes("network")) {
          console.warn("⚠️ Network error checking account status, will retry");
          if (retryCount < 3) {
            setTimeout(() => checkIfActive(retryCount + 1), 5000);
          }
          return;
        }
        throw error;
      }

      if (data?.is_active === false) {
        console.log("🔴 Account deactivated, logging out...");
        if (isLoggingOut.current) return;
        isLoggingOut.current = true;

        logout("Your account has been deactivated. Please contact support.");
      }
    } catch (err) {
      console.error("Error checking account status:", err);

      // ✅ Only retry on network errors, not on actual errors
      if (retryCount < 3 && err.code !== "PGRST116") {
        console.log(`Retrying... (${retryCount + 1}/3)`);
        setTimeout(() => checkIfActive(retryCount + 1), 5000);
      }
    }
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      console.log("⏰ Inactivity timeout - logging out");

      logout(
        `You have been logged out due to ${INACTIVITY_MINUTES} minutes of inactivity.`,
      );
    }, INACTIVITY_TIMEOUT);
  };

  // Track user activity
  const handleUserActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    resetInactivityTimer();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;

    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));

    if (!lastActivity) return;

    const elapsed = Date.now() - lastActivity;

    if (elapsed >= INACTIVITY_TIMEOUT) {
      logout(`You were inactive for more than ${INACTIVITY_MINUTES} minutes.`);
    }
  };

  const logout = (message) => {
    if (isLoggingOut.current) return;

    isLoggingOut.current = true;

    alert(message);

    localStorage.removeItem("operator");
    localStorage.removeItem(LAST_ACTIVITY_KEY);

    navigate("/", { replace: true });
  };

  useEffect(() => {
    const operatorData = localStorage.getItem("operator");
    if (!operatorData) return;

    isLoggingOut.current = false;

    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));

    if (!lastActivity) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } else {
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_TIMEOUT) {
        logout(
          `You were inactive for more than ${INACTIVITY_MINUTES} minutes.`,
        );
        return;
      }
    }

    // Start inactivity timer
    resetInactivityTimer();

    // Check account status every 60 seconds (instead of 30)
    const statusCheckInterval = setInterval(() => {
      checkIfActive();
    }, 60000);

    // Track user activity events
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "mousemove",
    ];
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      clearInterval(statusCheckInterval);
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
