import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, ChevronRight, Paperclip, X } from "lucide-react";
import {
  buildCommentTree,
  countDescendants,
  type ThreadComment,
} from "@/lib/commentTree";
import { questionForumThreadPath } from "@/lib/questionForum";

interface CommentThreadProps {
  subjectId: string;
  questionKey: string;
}

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

export function CommentThread({ subjectId, questionKey }: CommentThreadProps) {
  const navigate = useNavigate();
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newImages, setNewImages] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiFetch<{
        comments: (ThreadComment & { time?: string })[];
      }>(`/api/comments/${subjectId}/${questionKey}`);
      const raw = data.comments ?? [];
      setComments(
        raw.map((c) => ({
          id: String(c.id),
          username: c.username,
          text: c.text,
          imageUrls: Array.isArray((c as any).imageUrls) ? (c as any).imageUrls.map(String) : [],
          createdAt: c.createdAt || c.time || "",
          userId: c.userId != null ? Number(c.userId) : undefined,
          parentCommentId: c.parentCommentId,
        })),
      );
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, questionKey]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if ((!newComment.trim() && newImages.length === 0) || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/comments/${subjectId}/${questionKey}`, {
        method: "POST",
        body: JSON.stringify({
          text: newComment.trim(),
          imageUrls: newImages,
          parentCommentId: null,
        }),
      });
      setNewComment("");
      setNewImages([]);
      toast.success("Posted.");
      await fetchComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post comment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || attaching || submitting) return;
    setAttaching(true);
    try {
      const next = [...newImages];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const url = await compressImageFileToDataUrl(f);
        next.push(url);
      }
      setNewImages(next);
    } catch {
      toast.error("Could not attach one or more images.");
    } finally {
      setAttaching(false);
      e.target.value = "";
    }
  };

  const tree = buildCommentTree(comments);
  const totalCount = comments.length;

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      {/* Posts list — click opens full-screen thread */}
      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="practice-card-header">
          <p className="practice-card-header-title">Discussion</p>
          {totalCount > 0 ? (
            <p className="practice-card-header-meta">
              {totalCount} {totalCount === 1 ? "post" : "posts"}
            </p>
          ) : null}
        </div>
        <div className="px-6 py-5 sm:px-7 sm:py-6">
          {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-brand" />
          </div>
        ) : tree.length === 0 ? (
          <p className="py-6 text-center text-sm leading-relaxed text-muted-foreground">
            No posts yet. Add one below.
          </p>
        ) : (
          <ul className="max-h-[min(220px,36vh)] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {tree.map((c) => {
              const n = countDescendants(c);
              return (
                <li key={c.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        questionForumThreadPath(subjectId, questionKey, c.id),
                      )
                    }
                    className="flex w-full min-w-0 max-w-full items-start gap-2 rounded-lg border border-black/8 bg-black/[0.02] p-2.5 text-left transition-colors hover:border-brand/30 hover:bg-brand/[0.04]"
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="bg-brand/10 text-[10px] font-semibold text-brand">
                        {getInitials(c.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-black/85">
                          {c.username}
                        </span>
                        <span className="shrink-0 text-[10px] text-black/40">
                          {formatMessageTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-black/70 [overflow-wrap:anywhere]">
                        {c.text}
                      </p>
                      {Array.isArray(c.imageUrls) && c.imageUrls.length > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <img src={c.imageUrls[0]} alt="" className="h-8 w-8 rounded object-cover" />
                          <span className="text-[10px] text-black/55">
                            {c.imageUrls.length} image{c.imageUrls.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      )}
                      {n > 0 && (
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-brand">
                          {n} {n === 1 ? "reply" : "replies"}
                          <ChevronRight className="size-3" />
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          )}
        </div>
      </div>

      {/* New post only */}
      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="practice-card-header">
          <p className="practice-card-header-title">New post</p>
        </div>
        <div className="px-6 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Chat…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              disabled={submitting}
              className="h-10 min-w-0 flex-1 border-black/10 bg-white text-sm text-[#0b0f19]"
            />
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-black/15 px-3 text-xs font-medium text-[#0b0f19] hover:bg-black/[0.03]">
              {attaching ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
              Attach
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={attaching || submitting}
                onChange={onPickImages}
              />
            </label>
            <Button
              type="button"
              variant="accent"
              onClick={() => void handleSubmit()}
              disabled={(!newComment.trim() && newImages.length === 0) || submitting}
              className="h-10 shrink-0 px-4"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Post"
              )}
            </Button>
          </div>
          {newImages.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {newImages.map((url, i) => (
                <li key={`${i}-${url.slice(0, 20)}`} className="relative overflow-hidden rounded border border-black/10">
                  <img src={url} alt="" className="h-16 w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-white/90 p-0.5"
                    onClick={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove attachment"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
