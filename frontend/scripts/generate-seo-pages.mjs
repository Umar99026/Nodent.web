import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const templatePath = path.join(dist, "index.html");

const pages = [
  {
    route: "vce-resources",
    title: "Free VCE Resources & Study Tools | Nodent",
    description: "Free VCE resources and exam-style practice for Mathematical Methods, General Mathematics, Specialist Mathematics and English, with instant feedback from Nodent.",
    type: "CollectionPage",
    about: ["VCE study", "VCE revision", "VCE practice questions", "Victorian Certificate of Education"],
  },
  {
    route: "free-vce-practice-exams",
    title: "Free VCE Practice Exams & Exam-Style Questions | Nodent",
    description: "Prepare for VCE exams with free exam-style questions, timed practice and feedback for Methods, General Maths, Specialist Maths and English on Nodent.",
    type: "WebPage",
    about: ["free VCE practice exams", "VCE exam questions", "VCE exam preparation"],
  },
];

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function replaceMeta(html, selector, value) {
  const escaped = escapeAttribute(value);
  const pattern = new RegExp(`(<meta\\s+(?:name|property)=["']${selector}["']\\s+content=["'])[^"']*(["']\\s*\\/?>)`, "i");
  if (!pattern.test(html)) throw new Error(`Missing meta tag: ${selector}`);
  return html.replace(pattern, `$1${escaped}$2`);
}

const template = fs.readFileSync(templatePath, "utf8");

for (const page of pages) {
  const url = `https://nodent.pages.dev/${page.route}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": page.type,
    name: page.title.replace(" | Nodent", ""),
    url,
    description: page.description,
    inLanguage: "en-AU",
    isPartOf: { "@type": "WebSite", name: "Nodent", url: "https://nodent.pages.dev/" },
    about: page.about,
  };

  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);
  html = replaceMeta(html, "description", page.description);
  html = replaceMeta(html, "og:url", url);
  html = replaceMeta(html, "og:title", page.title);
  html = replaceMeta(html, "og:description", page.description);
  html = replaceMeta(html, "twitter:title", page.title);
  html = replaceMeta(html, "twitter:description", page.description);
  html = html.replace(
    /<script id="nodent-page-structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script id="nodent-page-structured-data" type="application/ld+json">${JSON.stringify(schema)}</script>`,
  );

  const outputDir = path.join(dist, page.route);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "index.html"), html);
}

console.log(`Generated ${pages.length} indexable SEO route pages.`);

