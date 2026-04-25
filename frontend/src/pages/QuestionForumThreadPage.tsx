import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Reply, Paperclip, X } from "lucide-react";
import {
  buildCommentTree,
  findCommentInTree,
  type ThreadComment,
} from "@/lib/commentTree";

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
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

function ThreadBranch({
  comment,
  depth,
  currentUserId,
  replyParentId,
  setReplyParentId,
}: {
  comment: ThreadComment;
  depth: number;
  currentUserId?: number;
  replyParentId: string | null;
  setReplyParentId: (id: string | null) => void;
}) {
  const isMe =
    currentUserId != null &&
    comment.userId != null &&
    Number(comment.userId) === Number(currentUserId);

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-lg border border-black/10 bg-white/90 p-4 text-[#0b0f19]",
        depth > 0 && "ml-2 border-l-2 border-brand/25 pl-4 sm:ml-4",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="bg-brand/10 text-xs font-semibold text-brand">
            {getInitials(comment.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-black/85">
              {comment.username}
            </span>
            {isMe && (
              <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0 text-[10px] font-semibold text-brand">
                You
              </span>
            )}
            <span className="text-[11px] text-black/45">
              {formatMessageTime(comment.createdAt)}
            </span>
          </div>
          <p className="mt-2 break-words text-[15px] leading-relaxed text-black/85 [overflow-wrap:anywhere]">
            {comment.text}
          </p>
          {Array.isArray(comment.imageUrls) && comment.imageUrls.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {comment.imageUrls.map((url, idx) => (
                <li key={`${comment.id}-img-${idx}`} className="overflow-hidden rounded border border-black/10">
                  <img src={url} alt="" className="h-28 w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() =>
              setReplyParentId(
                replyParentId === String(comment.id)
                  ? null
                  : String(comment.id),
              )
            }
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
          >
            <Reply className="size-3.5" />
            {replyParentId === String(comment.id) ? "Cancel reply" : "Reply"}
          </button>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-3">
          {comment.replies.map((child) => (
            <ThreadBranch
              key={child.id}
              comment={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              replyParentId={replyParentId}
              setReplyParentId={setReplyParentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestionForumThreadPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const qRaw = searchParams.get("q");
  const threadRaw = searchParams.get("thread");
  const questionKey = qRaw ? decodeURIComponent(qRaw) : "";
  const threadId = threadRaw ? decodeURIComponent(threadRaw) : "";

  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newImages, setNewImages] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!subjectId || !questionKey) return;
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
    setLoading(true);
    void fetchComments();
  }, [fetchComments]);

  const tree = buildCommentTree(comments);
  const threadRoot = threadId ? findCommentInTree(tree, threadId) : null;

  const handlePost = async () => {
    if ((!newText.trim() && newImages.length === 0) || !subjectId || !questionKey || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/comments/${subjectId}/${questionKey}`, {
        method: "POST",
        body: JSON.stringify({
          text: newText.trim(),
          imageUrls: newImages,
          parentCommentId:
            replyParentId != null
              ? Number(replyParentId)
              : Number(threadId),
        }),
      });
      setNewText("");
      setNewImages([]);
      setReplyParentId(null);
      toast.success("Posted.");
      await fetchComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not post.",
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

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else if (subjectId) navigate(`/quiz/${subjectId}`);
    else navigate("/dashboard");
  };

  if (!subjectId || !questionKey || !threadId) {
    return (
      <AppShell title="Discussion">
        <div className="mx-auto max-w-lg rounded-xl border border-white/15 bg-white/10 p-6 text-center text-white/90">
          <p className="text-sm">Invalid link. Open a thread from the practice page.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Discussion"
      subtitle="Question thread"
      headerRight={
        <Button
          variant="outline"
          size="sm"
          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
          onClick={back}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      }
    >
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl flex-col gap-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-brand" />
          </div>
        ) : !threadRoot ? (
          <p className="rounded-xl border border-white/15 bg-white/10 p-6 text-center text-sm text-white/85">
            This post was removed or the link is out of date.
          </p>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
              <ThreadBranch
                comment={threadRoot}
                depth={0}
                currentUserId={user?.id}
                replyParentId={replyParentId}
                setReplyParentId={setReplyParentId}
              />
            </div>

            <div className="sticky bottom-0 shrink-0 rounded-xl border border-black/10 bg-white p-4 text-[#0b0f19] shadow-lg">
              <p className="mb-2 text-xs font-medium text-black/55">
                {replyParentId
                  ? "Reply to selected comment"
                  : "Reply under this post"}
              </p>
              {replyParentId && (
                <button
                  type="button"
                  onClick={() => setReplyParentId(null)}
                  className="mb-2 text-xs text-brand hover:underline"
                >
                  Clear — reply under post only
                </button>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Write a message…"
                  disabled={submitting}
                  className="min-h-11 flex-1 border-black/15 bg-white text-[#0b0f19]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handlePost();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void handlePost()}
                  disabled={(!newText.trim() && newImages.length === 0) || submitting}
                  className="h-11 shrink-0 bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Post"
                  )}
                </Button>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-black/15 px-3 text-xs font-medium text-[#0b0f19] hover:bg-black/[0.03]">
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
              </div>
              {newImages.length > 0 && (
                <ul className="mt-3 grid grid-cols-4 gap-2">
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
          </>
        )}
      </div>
    </AppShell>
  );
}
