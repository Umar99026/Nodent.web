import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  unique,
  index,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull().default(""),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    hashAlgorithm: text("hash_algorithm").notNull().default("pbkdf2"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    unique("users_username_unique").on(table.username),
    index("users_email_lower_idx").on(table.email),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").notNull(),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    percent: integer("percent").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("quiz_attempts_user_subject_idx").on(table.userId, table.subjectId),
  ]
);

export const writtenResponses = pgTable(
  "written_responses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").notNull(),
    questionKey: text("question_key").notNull(),
    responseText: text("response_text").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    unique("written_responses_unique").on(
      table.userId,
      table.subjectId,
      table.questionKey
    ),
    index("written_responses_subject_question_idx").on(
      table.subjectId,
      table.questionKey
    ),
  ]
);

export const quizComments = pgTable(
  "quiz_comments",
  {
    id: serial("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    questionKey: text("question_key").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: integer("parent_comment_id"),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("quiz_comments_subject_question_idx").on(
      table.subjectId,
      table.questionKey
    ),
  ]
);

export const customQuestions = pgTable(
  "custom_questions",
  {
    id: serial("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    type: text("type").notNull(),
    topic: text("topic").notNull().default("General"),
    question: text("question").notNull(),
    imageUrls: text("image_urls"),
    options: text("options"),
    answer: text("answer"),
    acceptedAnswers: text("accepted_answers"),
    guidance: text("guidance"),
    passage: text("passage"),
    marks: integer("marks").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("custom_questions_subject_idx").on(table.subjectId)]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("chat_messages_subject_created_idx").on(
      table.subjectId,
      table.createdAt
    ),
  ]
);

export const questionAttempts = pgTable(
  "question_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").notNull(),
    questionKey: text("question_key").notNull(),
    topic: text("topic").notNull().default("General"),
    marks: integer("marks").notNull().default(1),
    isCorrect: integer("is_correct").notNull(),
    answeredAt: text("answered_at").notNull(),
  },
  (table) => [
    unique("question_attempts_unique").on(
      table.userId,
      table.subjectId,
      table.questionKey
    ),
    index("question_attempts_subject_user_idx").on(
      table.subjectId,
      table.userId
    ),
  ]
);

// ---- Friends ----
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending|accepted|rejected
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("friend_requests_from_to_idx").on(table.fromUserId, table.toUserId),
    index("friend_requests_to_status_idx").on(table.toUserId, table.status),
  ]
);

export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    userLow: integer("user_low")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHigh: integer("user_high")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    unique("friendships_user_low_user_high_unique").on(
      table.userLow,
      table.userHigh
    ),
    index("friendships_user_low_idx").on(table.userLow),
    index("friendships_user_high_idx").on(table.userHigh),
  ]
);

export const friendAssignments = pgTable(
  "friend_assignments",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").notNull(),
    questionKey: text("question_key").notNull(),
    questionJson: text("question_json").notNull(),
    marks: integer("marks").notNull().default(1),
    answerJson: text("answer_json"),
    isCorrect: integer("is_correct"),
    createdAt: text("created_at").notNull(),
    answeredAt: text("answered_at"),
  },
  (table) => [
    index("friend_assignments_pair_idx").on(table.fromUserId, table.toUserId),
    index("friend_assignments_to_answered_idx").on(
      table.toUserId,
      table.answeredAt
    ),
  ]
);
