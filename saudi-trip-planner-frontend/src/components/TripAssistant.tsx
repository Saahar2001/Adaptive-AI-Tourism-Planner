import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, X, Send, RotateCcw, Sparkles, Bot, ChevronDown } from "lucide-react";
import { useTrip } from "../lib/TripContext";
import { AuthService } from "../lib/auth";
import { TripStorageService } from "../lib/trips";
import { FavoritesService } from "../lib/favorites";
import { sendAssistantMessage } from "../lib/api";

const CHAT_STORAGE_KEY = "saudi_tourism_assistant_chat_v2";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  source?: string;
  model?: string;
  timestamp: string;
}

const INITIAL_GREETING: ChatMessage = {
  id: "greeting",
  sender: "assistant",
  text: "Marhaban! I am your AI Saudi Trip Assistant. Ask me anything about your itinerary, venues, estimated costs, or general travel across Saudi Arabia.",
  timestamp: new Date().toISOString(),
};

export default function TripAssistant() {
  const location = useLocation();
  const { prefs, result } = useTrip();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [INITIAL_GREETING];
    } catch {
      return [INITIAL_GREETING];
    }
  });
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to persist assistant chat", e);
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function handleReset() {
    const fresh = [
      {
        id: `greet_${Date.now()}`,
        sender: "assistant" as const,
        text: "Chat cleared. How can I help you plan your journey in Saudi Arabia today?",
        timestamp: new Date().toISOString(),
      },
    ];
    setMessages(fresh);
  }

  async function handleSend(textToSend?: string) {
    const query = (textToSend || inputValue).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue("");
    setLoading(true);

    try {
      // Assemble full contextual payload
      const user = AuthService.getCurrentUser();
      const savedTrips = TripStorageService.getUserTrips();
      const favorites = FavoritesService.getUserFavorites();

      const tripContext = {
        city: prefs?.city,
        prefs: prefs || undefined,
        itinerary: result?.itinerary || undefined,
        places: result?.places || undefined,
        warnings: result?.warnings || undefined,
        user_profile: user ? { name: user.name, email: user.email, preferredInterests: user.preferredInterests } : null,
        saved_trips_count: savedTrips.length,
        favorites_count: favorites.length,
      };

      const historyFormatted = newHistory.slice(-8).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await sendAssistantMessage(query, historyFormatted, location.pathname, tripContext);

      const asstMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        sender: "assistant",
        text: res.response,
        source: res.source,
        model: res.model,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: "assistant",
        text: "I encountered an issue retrieving that answer. Please verify the backend connection and try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  const quickPrompts = result?.itinerary?.length
    ? [
        `What is the plan for Day 1 in ${prefs?.city}?`,
        `What is my total estimated budget?`,
        `Which food spots or cafes are included?`,
        `What is the best transport mode for this trip?`,
      ]
    : [
        "Which Saudi cities are best for heritage and culture?",
        "What is the official currency and payment options?",
        "Tell me about dress etiquette for tourists in Saudi Arabia.",
        "How do I use the Haramain High-Speed Railway?",
      ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-body">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-palm-600 hover:bg-palm-700 text-sand-50 px-5 py-3.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 group"
          aria-label="Open AI Trip Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-sand-50 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-dune-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-dune-400 rounded-full" />
          </div>
          <span className="font-medium text-sm">Trip Assistant</span>
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-sand-50 border border-ink-900/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-palm-600 text-sand-50 px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sand-50/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-sand-100" />
              </div>
              <div>
                <h3 className="font-display font-medium text-sm leading-tight text-sand-50">
                  Saudi Trip Assistant
                </h3>
                <p className="text-[11px] text-sand-100/75">
                  {result?.itinerary?.length
                    ? `Active context: ${prefs?.city} (${prefs?.days} days)`
                    : "Grounded AI Guide"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Reset conversation"
                className="p-1.5 hover:bg-white/15 rounded-lg text-sand-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 hover:bg-white/15 rounded-lg text-sand-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender === "user"
                      ? "bg-palm-600 text-sand-50 rounded-br-xs"
                      : "bg-white border border-ink-900/10 text-ink-900 rounded-bl-xs shadow-xs whitespace-pre-line"
                  }`}
                >
                  {m.text}
                </div>
                {m.source && (
                  <span className="text-[10px] text-ink-700/60 mt-1 px-1">
                    {m.source === "grounded_llm" ? "⚡ Grounded LLM" : "🛡️ Grounded Rule Engine"}
                  </span>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-ink-700/60 bg-white border border-ink-900/10 px-4 py-2 rounded-2xl w-fit text-xs">
                <div className="w-2 h-2 rounded-full bg-palm-600 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-palm-600 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-palm-600 animate-bounce [animation-delay:0.4s]" />
                <span>Consulting verified tourism data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-sand-100/70 border-t border-ink-900/10 overflow-x-auto no-scrollbar flex gap-1.5">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="whitespace-nowrap bg-white hover:bg-palm-50 border border-ink-900/10 hover:border-palm-600 text-[11px] text-ink-700 hover:text-palm-700 px-2.5 py-1 rounded-full transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-ink-900/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about places, costs, itinerary..."
              disabled={loading}
              className="flex-1 bg-sand-50/70 border border-ink-900/15 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-palm-600 font-body text-ink-900"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className="p-2.5 bg-palm-600 hover:bg-palm-700 text-sand-50 rounded-xl transition disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
