/**
 * Full-screen thread for a question-level discussion post.
 * `q` = questionKey (URL-encoded), `thread` = root comment id.
 */
export function questionForumThreadPath(
  subjectId: string,
  questionKey: string,
  rootCommentId: string,
): string {
  const q = encodeURIComponent(questionKey);
  const thread = encodeURIComponent(rootCommentId);
  return `/quiz/${subjectId}/question-forum?q=${q}&thread=${thread}`;
}
