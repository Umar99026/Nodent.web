import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, MessageSquare } from "lucide-react";

import { baseSubjects } from "@/lib/subjects";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  time: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(username: string): string {
  return username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Returns true if two timestamps are more than 5 minutes apart. */
function shouldShowTimestamp(a: string, b: string): boolean {
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diff > 5 * 60 * 1000;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { user } = useAuth();

  const subject = baseSubjects.find((s) => s.id === subjectId);
  const subjectName = subject?.name ?? `Subject ${subjectId}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  /* ------ auto scroll ------ */

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  /* ------ fetch messages ------ */

  const fetchMessages = useCallback(async () => {
    if (!subjectId) return;
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>(API_PATHS.chat(subjectId));
      setMessages(data?.messages ?? []);
      setLoadError("");
    } catch (err) {
      if (err instanceof ApiError) setLoadError(err.message);
      else setLoadError("Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll every 8 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  /* ------ send message ------ */

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !subjectId || isSending) return;

    setIsSending(true);
    try {
      await apiFetch(API_PATHS.chat(subjectId), {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setInputText("");
      await fetchMessages();
    } catch {
      // Message may have been sent; next poll will pick it up
    } finally {
      setIsSending(false);
    }
  };

  /* ------ render ------ */

  return (
    <AppShell title={`${subjectName} Chat`}>
      <div className="flex h-[calc(100dvh-8rem)] flex-col">
        {/* Messages area */}
        <ScrollArea className="flex-1 rounded-t-xl border border-b-0 border-border/50 bg-card/40">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-danger">{loadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchMessages}
                  className="mt-3"
                >
                  Retry
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/10">
                  <MessageSquare className="size-7 text-brand" />
                </div>
                <h3 className="font-display text-lg font-semibold">
                  No messages yet
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Start the conversation! Ask a question or share your thoughts
                  about {subjectName}.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => {
                  const isMe = msg.userId === String(user?.id);
                  const prev = messages[idx - 1];
                  const showTime =
                    !prev ||
                    shouldShowTimestamp(prev.time, msg.time);
                  const showAvatar =
                    !prev || prev.userId !== msg.userId || showTime;

                  return (
                    <div key={msg.id}>
                      {/* Time divider */}
                      {showTime && (
                        <div className="flex justify-center py-3">
                          <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">
                            {formatMessageTime(msg.time)}
                          </span>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`flex items-end gap-2 ${
                          isMe ? "flex-row-reverse" : ""
                        } ${showAvatar ? "mt-3" : "mt-0.5"}`}
                      >
                        {/* Avatar */}
                        <div className="w-7 shrink-0">
                          {showAvatar && !isMe && (
                            <Avatar size="sm">
                              <AvatarFallback className="bg-gold/15 text-[10px] font-semibold text-gold-dark">
                                {getInitials(msg.username)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>

                        <div
                          className={`max-w-[70%] ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Username */}
                          {showAvatar && !isMe && (
                            <p className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                              {msg.username}
                            </p>
                          )}

                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                              isMe
                                ? "rounded-br-md bg-brand/15 text-foreground"
                                : "rounded-bl-md bg-white text-foreground shadow-sm ring-1 ring-border/50"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="flex items-center gap-2 rounded-b-xl border border-border/50 bg-card px-4 py-3">
          <Input
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isSending}
            className="h-10 flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !inputText.trim()}
            size="icon"
            className="size-10 shrink-0 bg-brand text-white hover:bg-brand-dark"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
