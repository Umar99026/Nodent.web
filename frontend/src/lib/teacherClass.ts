import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";

export type TeacherClassInfo = {
  classId: number;
  className: string;
  joinCode: string;
  memberCount: number;
  createdAt: string;
};

export type ClassMember = {
  userId: number;
  username: string;
  email: string;
  joinedAt: string;
  marksCorrect: number;
  marksAttempted: number;
  percent: number;
  questionCount: number;
};

export type TopicStatRow = {
  topic: string;
  subjectId: string;
  marksCorrect: number;
  marksAttempted: number;
  percent: number;
  studentsAttempted?: number;
};

export type ClassStats = {
  classId: number;
  className: string;
  memberCount: number;
  activeStudents: number;
  questionCount: number;
  marksCorrect: number;
  marksAttempted: number;
  avgPercent: number | null;
  topicStats: TopicStatRow[];
  weakTopics: Array<{
    topic: string;
    subjectId: string;
    percent: number;
    marksAttempted: number;
  }>;
};

export type StudentClassStats = {
  userId: number;
  username: string;
  email: string;
  marksCorrect: number;
  marksAttempted: number;
  percent: number;
  questionCount: number;
  topicStats: TopicStatRow[];
  weakTopics: TopicStatRow[];
  subjects: Array<{
    subjectId: string;
    marksCorrect: number;
    marksAttempted: number;
    percent: number;
  }>;
};

export function teacherJoinUrl(joinCode: string): string {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.nodentlearning.com";
  return `${base}/join-class?code=${encodeURIComponent(joinCode)}`;
}

export async function fetchTeacherClass(): Promise<TeacherClassInfo> {
  return apiFetch<TeacherClassInfo>("/api/teacher/class");
}

export async function updateTeacherClassName(className: string): Promise<void> {
  await apiFetch("/api/teacher/class", {
    method: "PATCH",
    body: JSON.stringify({ className }),
  });
}

export async function fetchClassMembers(subjectId?: string): Promise<ClassMember[]> {
  const q = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  const data = await apiFetch<{ members: ClassMember[] }>(
    `/api/teacher/class/members${q}`,
  );
  return data.members ?? [];
}

export async function fetchClassStats(subjectId?: string): Promise<ClassStats> {
  const q = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  return apiFetch<ClassStats>(`/api/teacher/class/stats${q}`);
}

export async function fetchStudentClassStats(
  studentId: number,
  subjectId?: string,
): Promise<StudentClassStats> {
  const q = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
  return apiFetch<StudentClassStats>(
    `/api/teacher/class/students/${studentId}/stats${q}`,
  );
}

export async function fetchClassMembership() {
  return apiFetch<{
    enrolled: boolean;
    classId?: number;
    className?: string;
    teacherName?: string;
    joinCode?: string;
    joinedAt?: string;
  }>(API_PATHS.teacher.membership);
}

export type ClassPreview = {
  className: string;
  teacherName: string;
  joinCode: string;
  memberCount: number;
};

export async function previewClass(joinCode: string): Promise<ClassPreview | null> {
  const normalized = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4) return null;
  try {
    return await apiFetch<ClassPreview>(API_PATHS.teacher.preview(normalized));
  } catch {
    return null;
  }
}

export async function joinClass(joinCode: string) {
  return apiFetch<{
    ok: boolean;
    alreadyMember?: boolean;
    className: string;
    teacherName: string;
    joinCode: string;
  }>(API_PATHS.teacher.join, {
    method: "POST",
    body: JSON.stringify({ joinCode }),
  });
}
