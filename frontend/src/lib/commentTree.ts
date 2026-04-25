export interface ThreadComment {
  id: string;
  username: string;
  text: string;
  imageUrls?: string[];
  createdAt: string;
  userId?: number;
  parentCommentId?: string | number | null;
  replies?: ThreadComment[];
}

export function buildCommentTree(comments: ThreadComment[]): ThreadComment[] {
  const map = new Map<string, ThreadComment>();
  const roots: ThreadComment[] = [];

  for (const c of comments) {
    map.set(String(c.id), { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(String(c.id))!;
    const parent = c.parentCommentId;
    if (parent != null && map.has(String(parent))) {
      map.get(String(parent))!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Total nested replies under this comment (not counting the comment itself). */
export function countDescendants(comment: ThreadComment): number {
  const ch = comment.replies ?? [];
  return ch.reduce(
    (acc, r) => acc + 1 + countDescendants(r),
    0,
  );
}

export function findCommentInTree(
  roots: ThreadComment[],
  id: string,
): ThreadComment | null {
  for (const r of roots) {
    if (r.id === id) return r;
    if (r.replies?.length) {
      const found = findCommentInTree(r.replies, id);
      if (found) return found;
    }
  }
  return null;
}
