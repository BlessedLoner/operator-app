// src/hooks/useInactivityLogout.js
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export function useInactivityLogout(INACTIVITY_MINUTES = 30) {
  const navigate = useNavigate();
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_TIMEOUT = INACTIVITY_MINUTES * 60 * 1000;

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

      if (error) throw error;

      if (!data?.is_active) {
        alert("Your account has been deactivated. Please contact support.");
        localStorage.removeItem("operator");
        navigate("/");
      }
    } catch (err) {
      console.error("Error checking account status:", err);

      // ✅ Retry after 5 seconds if failed (max 3 retries)
      if (retryCount < 3) {
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
      alert(
        `You have been logged out due to ${INACTIVITY_MINUTES} minutes of inactivity.`,
      );
      localStorage.removeItem("operator");
      navigate("/");
    }, INACTIVITY_TIMEOUT);
  };

  // Track user activity
  const handleUserActivity = () => {
    resetInactivityTimer();
  };

  useEffect(() => {
    const operatorData = localStorage.getItem("operator");
    if (!operatorData) return;

    // Start inactivity timer
    resetInactivityTimer();

    // Check account status every 30 seconds
    const statusCheckInterval = setInterval(() => {
      checkIfActive();
    }, 30000);

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

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      clearInterval(statusCheckInterval);
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, []);
}
