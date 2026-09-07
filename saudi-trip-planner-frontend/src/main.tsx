import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Landing from "./pages/Landing";
import Plan from "./pages/Plan";
import Results from "./pages/Results";
import Trending from "./pages/Trending";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import MyTrips from "./pages/MyTrips";
import Favorites from "./pages/Favorites";
import Header from "./components/Header";
import TripAssistant from "./components/TripAssistant";
import { TripProvider } from "./lib/TripContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TripProvider>
        <div className="min-h-screen flex flex-col bg-sand-100 text-ink-900 font-body">
          <Header />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/results" element={<Results />} />
              <Route path="/trending" element={<Trending />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/my-trips" element={<MyTrips />} />
              <Route path="/favorites" element={<Favorites />} />
            </Routes>
          </div>
          <TripAssistant />
        </div>
      </TripProvider>
    </BrowserRouter>
  </React.StrictMode>
);
