import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MessageSquare,
  Reply,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Comment {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  parentCommentId?: string | null;
  replies?: Comment[];
}

interface CommentThreadProps {
  subjectId: string;
  questionKey: string;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildTree(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentCommentId && map.has(c.parentCommentId)) {
      map.get(c.parentCommentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function CommentNode({
  comment,
  depth,
  onReply,
}: {
  comment: Comment;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  return (
    <div className={cn("space-y-2", depth > 0 && "ml-6 border-l-2 border-brand/15 pl-4")}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-brand-dark">
            {comment.username}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
          {comment.text}
        </p>
        <button
          onClick={() => onReply(comment.id)}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand-dark"
        >
          <Reply className="size-3" />
          Reply
        </button>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3 pt-1">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentThread({ subjectId, questionKey }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiFetch<{ comments: Comment[] }>(
        `/api/comments/${subjectId}/${questionKey}`
      );
      setComments(data.comments ?? []);
    } catch {
      // Silently fail — comments are non-critical
    } finally {
      setLoading(false);
    }
  }, [subjectId, questionKey]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await apiFetch(`/api/comments/${subjectId}/${questionKey}`, {
        method: "POST",
        body: JSON.stringify({
          text: newComment.trim(),
          parentCommentId: replyTo,
        }),
      });
      setNewComment("");
      setReplyTo(null);
      toast.success("Comment posted.");
      await fetchComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post comment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
  };

  const tree = buildTree(comments);

  return (
    <div className="space-y-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-brand-dark" />
          <h4 className="font-display text-base font-medium text-foreground">
            Discussion
          </h4>
          {comments.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand-dark">
              {comments.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <>
          <Separator />

          {/* Comments */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-brand" />
            </div>
          ) : tree.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No comments yet. Start the discussion!
            </p>
          ) : (
            <div className="space-y-4">
              {tree.map((comment) => (
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  onReply={handleReply}
                />
              ))}
            </div>
          )}

          <Separator />

          {/* Add comment form */}
          <div className="space-y-2">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Reply className="size-3" />
                <span>
                  Replying to a comment{" "}
                  <button
                    onClick={() => setReplyTo(null)}
                    className="font-medium text-brand-dark underline"
                  >
                    Cancel
                  </button>
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  replyTo ? "Write a reply..." : "Add a comment..."
                }
                rows={2}
                className="flex-1 bg-white/60 text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
                size="icon"
                className="shrink-0 bg-brand hover:bg-brand-dark self-end"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Cmd+Enter to send
            </p>
          </div>
        </>
      )}
    </div>
  );
}
