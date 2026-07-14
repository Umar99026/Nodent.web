/**
 * Add multipart network question with an AI-generated figure (OpenAI Images API).
 *
 *   node scripts/add-demo-multipart-ai-image-question.mjs
 *   node scripts/add-demo-multipart-ai-image-question.mjs --apply
 *   node scripts/add-demo-multipart-ai-image-question.mjs --apply --skip-image
 *   node scripts/add-demo-multipart-ai-image-question.mjs --apply --skip-image --subjects general-maths
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { neon } from "@neondatabase/serverless";
import { assertLiveOpenAiScript, openAiScriptFetch } from "./lib/openai-script-safety.mjs";

const APPLY = process.argv.includes("--apply");
const SKIP_IMAGE = process.argv.includes("--skip-image");
const IMAGE_NAME = "ai-network-multipart-test.png";

function parseSubjects() {
  const idx = process.argv.indexOf("--subjects");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["demo"];
}

const SUBJECTS = parseSubjects();

function loadEnv() {
  const out = {};
  if (process.env.DATABASE_URL) out.DATABASE_URL = process.env.DATABASE_URL.trim();
  if (process.env.OPENAI_API_KEY) out.OPENAI_API_KEY = process.env.OPENAI_API_KEY.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (existsSync(devVars)) {
    for (const line of readFileSync(devVars, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function buildQuestion(subjectId) {
  const imagePath = `/questions/${subjectId}/${IMAGE_NAME}`;
  return {
    subjectId,
    type: "long_answer",
    topic: "Networks and decision mathematics",
    question:
      "The figure shows a weighted undirected network with vertices $A$, $B$, $C$, $D$, and $E$.",
    imageUrls: [imagePath],
    acceptedAnswers: ["19", "8"],
    marks: 4,
    guidance:
      "MST edges: $D$–$E$ (2), $A$–$B$ (3), $C$–$X$ (3), $C$–$D$ (5), $E$–$A$ (6), total 19. Shortest $A$ to $D$: $A$–$E$–$D$ = 6 + 2 = 8.",
    answerParts: [
      {
        key: "mst",
        label: "Find the total weight of a minimum spanning tree.",
        marks: 2,
        acceptedAnswer: "19",
        placeholder: "Type your answer…",
      },
      {
        key: "shortest",
        label: "Find the length of the shortest path from $A$ to $D$.",
        marks: 2,
        acceptedAnswer: "8",
        placeholder: "Type your answer…",
      },
    ],
  };
}

const IMAGE_PROMPT = `Educational textbook diagram of an undirected weighted network graph.
Five circular nodes clearly labeled with capital letters A, B, C, D, E.
Layout: A at top, B upper-right, C lower-right, D lower-left, E upper-left (pentagon shape).
Draw straight edges with numeric weight labels placed on each edge:
A-B weight 4, B-C weight 3, C-D weight 5, D-E weight 2, E-A weight 6, A-C weight 7, B-D weight 8.
White background, black lines, large readable sans-serif labels, no title, no watermark, no 3D effects.`;

async function generateImage(apiKey) {
  const attempts = [
    { model: "dall-e-3", size: "1024x1024", response_format: "b64_json" },
    { model: "dall-e-2", size: "1024x1024", response_format: "b64_json" },
    { model: "gpt-image-1", size: "1024x1024" },
  ];

  let lastErr = "";
  for (const attempt of attempts) {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const body = {
        model: attempt.model,
        prompt: IMAGE_PROMPT,
        n: 1,
        size: attempt.size,
      };
      if (attempt.response_format) body.response_format = attempt.response_format;

      const res = await openAiScriptFetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }, { feature: "generate_demo_question_image", maxAttempts: 1 });

      if (!res.ok) {
        lastErr = `OpenAI images ${attempt.model} (${res.status}): ${(await res.text()).slice(0, 300)}`;
        if ([429, 500, 502, 503, 520].includes(res.status) && tryNo === 0) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** tryNo));
          continue;
        }
        break;
      }

      const data = await res.json();
      const item = data?.data?.[0];
      if (item?.b64_json) {
        console.log(`  Image model: ${attempt.model}`);
        return Buffer.from(item.b64_json, "base64");
      }
      if (item?.url) {
        console.log(`  Image model: ${attempt.model} (url)`);
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
        return Buffer.from(await imgRes.arrayBuffer());
      }
      lastErr = `OpenAI ${attempt.model} returned no image data.`;
      break;
    }
  }
  throw new Error(lastErr || "Image generation failed.");
}

function saveImage(buffer, subjects) {
  for (const subjectId of subjects) {
    for (const root of ["frontend/public/questions", "questions"]) {
      const filePath = resolve(process.cwd(), root, subjectId, IMAGE_NAME);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, buffer);
      console.log(`Saved: ${filePath}`);
    }
  }
}

function ensureImageForSubjects(subjects) {
  const source = resolve(process.cwd(), "frontend/public/questions/demo", IMAGE_NAME);
  if (!existsSync(source)) return;
  for (const subjectId of subjects) {
    if (subjectId === "demo") continue;
    for (const root of ["frontend/public/questions", "questions"]) {
      const dest = resolve(process.cwd(), root, subjectId, IMAGE_NAME);
      if (!existsSync(dest)) {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(source, dest);
        console.log(`Copied image: ${dest}`);
      }
    }
  }
}

async function insertQuestion(sql, question) {
  const subjectId = question.subjectId;
  const existing = await sql`
    SELECT id FROM custom_questions
    WHERE LOWER(TRIM(subject_id)) = ${subjectId}
      AND LOWER(TRIM(question)) = LOWER(TRIM(${question.question}))
    LIMIT 1
  `;
  if (existing.length) {
    console.log(`[${subjectId}] already exists (id ${existing[0].id}) — updating.`);
    await sql`
      UPDATE custom_questions
      SET
        type = ${question.type},
        topic = ${question.topic},
        image_urls = ${JSON.stringify(question.imageUrls)},
        accepted_answers = ${JSON.stringify(question.acceptedAnswers)},
        answer_parts_json = ${JSON.stringify(question.answerParts)},
        guidance = ${question.guidance},
        marks = ${question.marks},
        ai_marking_enabled = 0
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  const inserted = await sql`
    INSERT INTO custom_questions (
      subject_id, type, topic, question, image_urls, accepted_answers,
      answer_parts_json, guidance, marks, ai_marking_enabled, created_at
    ) VALUES (
      ${question.subjectId},
      ${question.type},
      ${question.topic},
      ${question.question},
      ${JSON.stringify(question.imageUrls)},
      ${JSON.stringify(question.acceptedAnswers)},
      ${JSON.stringify(question.answerParts)},
      ${question.guidance},
      ${question.marks},
      0,
      ${new Date().toISOString()}
    )
    RETURNING id
  `;
  return inserted[0]?.id;
}

const env = loadEnv();
const preview = buildQuestion(SUBJECTS[0]);
if (!APPLY) {
  console.log("Question preview:");
  console.log(`  Subjects: ${SUBJECTS.join(", ")}`);
  console.log(`  Stem: ${preview.question}`);
  console.log("\nDry run only — no OpenAI request was made. Re-run with --apply to generate and insert.");
  process.exit(0);
}
if (!SKIP_IMAGE && !env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .dev.vars or env.");
  process.exit(1);
}

const sourceImage = resolve(process.cwd(), "frontend/public/questions/demo", IMAGE_NAME);
if (SKIP_IMAGE && !existsSync(sourceImage)) {
  console.error(`Missing image: ${sourceImage}`);
  process.exit(1);
}

console.log(
  SKIP_IMAGE ? "Skipping image generation (using existing file)…" : "Generating network diagram with OpenAI…",
);
if (!SKIP_IMAGE) assertLiveOpenAiScript("generate_demo_question_image");
const buffer = SKIP_IMAGE ? readFileSync(sourceImage) : await generateImage(env.OPENAI_API_KEY);
if (!SKIP_IMAGE) saveImage(buffer, SUBJECTS);
else ensureImageForSubjects(SUBJECTS);

const sample = buildQuestion(SUBJECTS[0]);
console.log("\nQuestion preview:");
console.log(`  Subjects: ${SUBJECTS.join(", ")}`);
console.log(`  Stem: ${sample.question}`);
console.log(`  Image: ${sample.imageUrls[0]}`);
console.log(`  a) ${sample.answerParts[0].label} → ${sample.answerParts[0].acceptedAnswer}`);
console.log(`  b) ${sample.answerParts[1].label} → ${sample.answerParts[1].acceptedAnswer}`);

if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL for --apply.");
  process.exit(1);
}

const sql = neon(env.DATABASE_URL);
for (const subjectId of SUBJECTS) {
  const question = buildQuestion(subjectId);
  const id = await insertQuestion(sql, question);
  console.log(`\n${subjectId} question ready (id ${id}).`);
}
