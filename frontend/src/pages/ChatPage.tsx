import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Plus, ArrowLeft } from "lucide-react";

import { baseSubjects } from "@/lib/subjects";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ForumPost {
  id: string;
  subjectId: string;
  userId: string;
  username: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  replyCount?: number;
  lastActivityAt?: string;
}

interface ForumReply {
  id: string;
  postId: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const navigate = useNavigate();
  const { subjectId, postId } = useParams<{ subjectId: string; postId?: string }>();
  const { user } = useAuth();

  const subject = baseSubjects.find((s) => s.id === subjectId);
  const subjectName = subject?.name ?? `Subject ${subjectId}`;

  const isThread = !!postId;

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [threadPost, setThreadPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostBody, setNewPostBody] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!subjectId) return;
    try {
      const data = await apiFetch<{ posts: ForumPost[] }>(API_PATHS.forum.posts(subjectId));
      setPosts(data?.posts ?? []);
      setLoadError("");
    } catch (err) {
      if (err instanceof ApiError) setLoadError(err.message);
      else setLoadError("Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  const fetchThread = useCallback(async () => {
    if (!subjectId || !postId) return;
    try {
      const data = await apiFetch<{ post: ForumPost; replies: ForumReply[] }>(
        API_PATHS.forum.post(subjectId, postId),
      );
      setThreadPost(data?.post ?? null);
      setReplies(data?.replies ?? []);
      setLoadError("");
    } catch (err) {
      if (err instanceof ApiError) setLoadError(err.message);
      else setLoadError("Failed to load thread");
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, postId]);

  useEffect(() => {
    setIsLoading(true);
    setLoadError("");
    if (isThread) fetchThread();
    else fetchPosts();
  }, [isThread, fetchPosts, fetchThread]);

  // Light polling to keep lists/threads fresh
  useEffect(() => {
    const fn = isThread ? fetchThread : fetchPosts;
    const interval = setInterval(fn, 12000);
    return () => clearInterval(interval);
  }, [isThread, fetchPosts, fetchThread]);

  const handleCreatePost = async () => {
    if (!subjectId || isCreatingPost) return;
    const title = newPostTitle.trim();
    const body = newPostBody.trim();
    if (!title || !body) return;

    setIsCreatingPost(true);
    try {
      const data = await apiFetch<{ post: ForumPost }>(API_PATHS.forum.posts(subjectId), {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      setNewPostTitle("");
      setNewPostBody("");
      const created = data?.post;
      await fetchPosts();
      if (created?.id) navigate(`/chat/${subjectId}/post/${created.id}`);
    } catch {
      // show via next refresh; keep UX simple
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleReply = async () => {
    if (!subjectId || !postId || isReplying) return;
    const body = replyBody.trim();
    if (!body) return;

    setIsReplying(true);
    try {
      await apiFetch(API_PATHS.forum.replies(subjectId, postId), {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setReplyBody("");
      await fetchThread();
    } catch {
      // ignore; next poll will refresh
    } finally {
      setIsReplying(false);
    }
  };

  const title = useMemo(() => {
    if (!isThread) return `${subjectName} Forum`;
    return `${subjectName} Forum`;
  }, [isThread, subjectName]);

  /* ------ render ------ */

  return (
    <AppShell title={title}>
      <div className="flex h-[calc(100dvh-8rem)] flex-col">
        {isThread && (
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => navigate(`/chat/${subjectId}`)}
            >
              <ArrowLeft className="mr-2 size-4" />
              Back to posts
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 rounded-xl border border-white/15 bg-white/10">
          <div className="p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-white" />
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-white/90">{loadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isThread ? fetchThread : fetchPosts}
                  className="mt-3 border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  Retry
                </Button>
              </div>
            ) : !subjectId ? (
              <div className="py-16 text-center text-white/80">Missing subject.</div>
            ) : isThread ? (
              threadPost ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-black/10 bg-white p-5 text-[#0b0f19] shadow-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-2xl tracking-tight">
                          {threadPost.title}
                        </h2>
                        <p className="mt-1 text-sm text-black/60">
                          Posted by {threadPost.username} •{" "}
                          {formatMessageTime(threadPost.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-black/90">
                      {threadPost.body}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-5 text-[#0b0f19] shadow-xl">
                    <h3 className="font-display text-lg font-semibold">
                      Replies ({replies.length})
                    </h3>

                    <div className="mt-4 space-y-4">
                      {replies.length === 0 ? (
                        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/60">
                          No replies yet. Be the first to reply.
                        </div>
                      ) : (
                        replies.map((r) => {
                          const isMe = r.userId === String(user?.id);
                          return (
                            <div key={r.id} className="flex items-start gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-brand/10 text-sm font-semibold text-brand">
                                  {getInitials(r.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-black/80">
                                    {r.username}
                                  </span>
                                  {isMe && (
                                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                                      You
                                    </span>
                                  )}
                                  <span className="text-[11px] text-black/50">
                                    {formatMessageTime(r.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-black/80">
                                  {r.body}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      <Input
                        placeholder="Write a reply..."
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReply();
                          }
                        }}
                        disabled={isReplying}
                        className="h-11 flex-1 border-black/10 bg-white text-[#0b0f19]"
                      />
                      <Button
                        onClick={handleReply}
                        disabled={isReplying || !replyBody.trim()}
                        className="h-11 bg-[#0b0f19] px-5 text-white hover:bg-[#0b0f19]/90"
                      >
                        {isReplying ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Posting…
                          </>
                        ) : (
                          "Reply"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-white/80">
                  Post not found.
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                        <MessageSquare className="size-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-semibold">
                          Posts
                        </h2>
                        <p className="text-sm text-white/70">
                          Create a post, then reply inside the thread.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <Input
                      placeholder="Post title"
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      disabled={isCreatingPost}
                      className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/60"
                    />
                    <Input
                      placeholder="Write your post..."
                      value={newPostBody}
                      onChange={(e) => setNewPostBody(e.target.value)}
                      disabled={isCreatingPost}
                      className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/60"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleCreatePost}
                        disabled={
                          isCreatingPost ||
                          !newPostTitle.trim() ||
                          !newPostBody.trim()
                        }
                        className="h-11 bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                      >
                        {isCreatingPost ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Posting…
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 size-4" />
                            New post
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {posts.length === 0 ? (
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-10 text-center text-white">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-white/15">
                      <MessageSquare className="size-7 text-white" />
                    </div>
                    <h3 className="font-display text-lg font-semibold">
                      No posts yet
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      Start the forum for {subjectName} by creating the first post.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {posts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/chat/${subjectId}/post/${p.id}`)}
                        className="text-left"
                      >
                        <div className="rounded-2xl border border-black/10 bg-white p-5 text-[#0b0f19] shadow-xl transition-colors hover:bg-gradient-to-b hover:from-[#f3fbff] hover:to-white">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="font-display text-xl font-semibold tracking-tight">
                                {p.title}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-sm text-black/65">
                                {p.body}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/55">
                                <span>By {p.username}</span>
                                <span>•</span>
                                <span>
                                  {formatMessageTime(p.lastActivityAt || p.updatedAt || p.createdAt)}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-black/70">
                                  {p.replyCount ?? 0} replies
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </AppShell>
  );
}
