import type { UserProfile, TransportMode } from "./types";

const SESSION_KEY = "saudi_tourism_user_session";
const USERS_DB_KEY = "saudi_tourism_users_db";

interface StoredUser extends UserProfile {
  passwordHash: string; // Demo simulation only
}

function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Failed to persist users to localStorage", e);
  }
}

// Simple deterministic hash for demo purposes (never claims production crypto)
function demoHash(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `demo_h_${Math.abs(hash).toString(16)}`;
}

export const AuthService = {
  getCurrentUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  signUp(params: {
    name: string;
    email: string;
    password: string;
    preferredInterests?: string[];
    preferredTransport?: TransportMode;
    requireAccessibility?: boolean;
  }): UserProfile {
    const email = params.email.trim().toLowerCase();
    if (!email || !params.password) {
      throw new Error("Email and password are required.");
    }
    const users = getStoredUsers();
    if (users.some((u) => u.email === email)) {
      throw new Error("An account with this email already exists.");
    }

    const newUser: StoredUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name.trim() || email.split("@")[0],
      email,
      passwordHash: demoHash(params.password),
      preferredInterests: params.preferredInterests || ["Culture & Heritage", "Food"],
      preferredTransport: params.preferredTransport || "driving",
      requireAccessibility: params.requireAccessibility ?? false,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveStoredUsers(users);

    const { passwordHash: _, ...profile } = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("auth-changed"));
    return profile;
  },

  login(emailInput: string, passwordInput: string): UserProfile {
    const email = emailInput.trim().toLowerCase();
    const users = getStoredUsers();
    const user = users.find((u) => u.email === email);
    if (!user || user.passwordHash !== demoHash(passwordInput)) {
      throw new Error("Invalid email or password.");
    }

    const { passwordHash: _, ...profile } = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("auth-changed"));
    return profile;
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event("auth-changed"));
  },

  updateProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getCurrentUser();
    if (!current) throw new Error("No active session.");

    const updated: UserProfile = { ...current, ...updates, id: current.id, email: current.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));

    const users = getStoredUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updated };
      saveStoredUsers(users);
    }

    window.dispatchEvent(new Event("auth-changed"));
    return updated;
  },
};
