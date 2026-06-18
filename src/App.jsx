import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import PokerDashboard from "./Pages/PokerDashboard";
import StoppedDashboard from "./Pages/StoppedDashboard";
import Conversation from "./Pages/Conversation";
import WaitingRoom from "./Pages/WaitingRoom";
import ChatInterface from "./Pages/ChatInterface";
import { supabase } from "./lib/supabaseClient";

// Wrapper component to route to correct dashboard based on operator type
function DashboardRouter() {
  const [operatorType, setOperatorType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOperatorType = async () => {
      try {
        const operatorData = localStorage.getItem("operator");
        if (!operatorData) {
          setLoading(false);
          return;
        }

        const operator = JSON.parse(operatorData);

        const { data, error } = await supabase
          .from("operator_accounts")
          .select("operator_type")
          .eq("id", operator.id)
          .single();

        if (error) {
          console.error("Error fetching operator type:", error);
          setOperatorType("regular");
        } else {
          setOperatorType(data?.operator_type || "regular");
        }
      } catch (err) {
        console.error("Dashboard router error:", err);
        setOperatorType("regular");
      } finally {
        setLoading(false);
      }
    };

    checkOperatorType();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Route to appropriate dashboard based on operator_type
  if (operatorType === "poke") {
    return <PokerDashboard />;
  }

  // if (operatorType === "stopped") {
  //   return <StoppedDashboard />;
  // }

  // Default: regular operator
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login page */}
        <Route path="/login" element={<Login />} />

        {/* Dashboard - automatically routes to correct dashboard based on operator type */}
        <Route path="/dashboard" element={<DashboardRouter />} />

        {/* Waiting Room and Chat */}
        <Route path="/waiting-room" element={<WaitingRoom />} />
        <Route path="/chat" element={<ChatInterface />} />

        {/* Conversation route (commented but available) */}
        {/* <Route path="/conversation/:id" element={<Conversation />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
