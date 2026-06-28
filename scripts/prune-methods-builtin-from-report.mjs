import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function stem(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\\+/g, "")
    .replace(/\s+/g, " ");
}

const report = JSON.parse(readFileSync(resolve("scripts/prune-easy-methods-30-report.json"), "utf8"));
const removeStems = new Set((report.removed ?? []).map((r) => stem(r.question)));

const path = resolve("frontend/src/lib/methodsBuiltinQuestions.ts");
const src = readFileSync(path, "utf8");
const lines = src.split(/\r?\n/);
const out = [];
let removed = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim().startsWith("short(")) {
    out.push(line);
    continue;
  }
  const block = [line];
  let j = i;
  while (j + 1 < lines.length && !lines[j].trim().endsWith("),")) {
    j++;
    block.push(lines[j]);
  }
  const blockText = block.join("\n");
  const m = blockText.match(/short\([^,]+,\s*"((?:\\.|[^"\\])*)"/s);
  const question = m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : "";
  if (question && removeStems.has(stem(question))) {
    removed++;
    i = j;
    continue;
  }
  out.push(...block);
  i = j;
}

const result = out.join("\n").replace(
  /Tricky short-answer practice bank \(\d+ questions\)/,
  `Tricky short-answer practice bank (${159 - removed} questions)`,
);
writeFileSync(path, result);
console.log(`Removed ${removed} builtin entries`);
