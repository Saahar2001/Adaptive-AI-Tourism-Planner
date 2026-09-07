import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User as UserIcon, LogOut, Flame, Compass, Briefcase, Bookmark } from "lucide-react";
import { AuthService } from "../lib/auth";
import type { UserProfile } from "../lib/types";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(AuthService.getCurrentUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleAuthChange() {
      setUser(AuthService.getCurrentUser());
    }
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  function handleLogout() {
    AuthService.logout();
    setMobileMenuOpen(false);
    navigate("/");
  }

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/plan", label: "Plan Trip" },
    { to: "/trending", label: "Trending" },
    { to: "/my-trips", label: "My Trips" },
    { to: "/profile", label: "Profile" },
  ];

  function isActive(path: string) {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  }

  return (
    <header className="sticky top-0 z-40 bg-sand-100/90 backdrop-blur-md border-b border-ink-900/10 transition-colors">
      <div className="max-w-content mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="text-xl" role="img" aria-label="Saudi Flag">🇸🇦</span>
          <span className="font-display font-medium text-lg text-ink-900 group-hover:text-palm-700 transition-colors">
            Saudi Tourism Planner
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 font-body text-sm">
          {navLinks.map((link) => {
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3.5 py-1.5 rounded-full transition-all font-medium ${
                  active
                    ? "bg-palm-50 text-palm-700 font-semibold shadow-xs"
                    : "text-ink-700/80 hover:text-ink-900 hover:bg-black/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side auth controls */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-ink-900/10 text-ink-900 font-body text-sm hover:border-palm-600 transition"
              >
                <div className="w-6 h-6 rounded-full bg-palm-600 text-sand-50 flex items-center justify-center text-xs font-semibold">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <span className="max-w-[120px] truncate font-medium">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 text-ink-700/60 hover:text-rock-600 rounded-full hover:bg-black/5 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="font-body text-sm font-medium text-ink-700/80 hover:text-ink-900 px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="font-body text-sm font-medium bg-palm-600 hover:bg-palm-700 text-sand-50 px-4 py-1.5 rounded-full transition shadow-xs"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="md:hidden p-2 text-ink-900 hover:bg-black/5 rounded-lg"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-ink-900/10 bg-sand-50 px-6 py-4 space-y-2 shadow-lg">
          {navLinks.map((link) => {
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl font-body text-sm font-medium transition ${
                  active
                    ? "bg-palm-50 text-palm-700 font-semibold"
                    : "text-ink-900 hover:bg-black/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-ink-900/10 flex flex-col gap-2">
            {user ? (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-medium text-ink-900 truncate">
                  Logged in as <strong className="text-palm-700">{user.name}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs font-medium text-rock-600 hover:underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center font-body text-sm font-medium border border-ink-900/15 py-2 rounded-xl text-ink-900"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center font-body text-sm font-medium bg-palm-600 text-sand-50 py-2 rounded-xl"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
