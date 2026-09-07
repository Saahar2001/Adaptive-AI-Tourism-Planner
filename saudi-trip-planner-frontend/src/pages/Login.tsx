import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthService } from "../lib/auth";
import { Lock, Mail, AlertCircle, Sparkles } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      AuthService.login(email, password);
      navigate("/profile");
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please verify credentials.");
    }
  }

  function handleDemoLogin() {
    try {
      AuthService.login("traveler@demo.sa", "demo123");
      navigate("/profile");
    } catch {
      // If demo user hasn't been created yet, auto-create it
      AuthService.signUp({
        name: "Saudi Explorer",
        email: "traveler@demo.sa",
        password: "demo123",
        preferredInterests: ["Culture & Heritage", "Food", "Nature"],
        preferredTransport: "driving",
        requireAccessibility: false,
      });
      navigate("/profile");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-sand-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm border border-ink-900/10 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <span className="text-3xl" role="img" aria-label="Palm tree">🌴</span>
          <h1 className="font-display text-2xl font-semibold text-ink-900 mt-2">
            Welcome Back
          </h1>
          <p className="font-body text-xs text-ink-700/70 mt-1">
            Sign in to access your saved trips, favorites, and travel preferences.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rock-600/10 border border-rock-600/20 text-rock-600 text-xs font-body flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-body">
          <div>
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-700/40 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-sand-50/60 border border-ink-900/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:border-palm-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-700/40 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-sand-50/60 border border-ink-900/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:border-palm-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-palm-600 hover:bg-palm-700 text-sand-50 font-medium py-3 rounded-xl transition shadow-xs"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ink-900/10 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-2.5 px-4 rounded-xl border border-palm-600/30 bg-palm-50 text-palm-700 hover:bg-palm-100/70 font-body text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>One-Click Demo Sign In</span>
          </button>

          <p className="text-center text-xs text-ink-700 font-body">
            Don't have an account yet?{" "}
            <Link to="/signup" className="text-palm-700 font-semibold hover:underline">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
