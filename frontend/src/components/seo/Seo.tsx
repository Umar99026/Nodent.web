import { useEffect } from "react";

const SITE_URL = "https://nodent.pages.dev";

type StructuredData = Record<string, unknown> | Record<string, unknown>[];

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  structuredData?: StructuredData;
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function Seo({
  title,
  description,
  path = "/",
  robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  structuredData,
}: SeoProps) {
  useEffect(() => {
    const url = new URL(path, SITE_URL).toString();
    document.title = title;

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="robots"]', "name", "robots", robots);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    const oldScript = document.getElementById("nodent-page-structured-data");
    oldScript?.remove();
    if (structuredData) {
      const script = document.createElement("script");
      script.id = "nodent-page-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, path, robots, structuredData, title]);

  return null;
}

