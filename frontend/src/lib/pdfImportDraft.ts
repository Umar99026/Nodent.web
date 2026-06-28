import { STORAGE_KEYS } from "@/lib/constants";

export type PdfImportDraftSnapshot = {
  subjectId: string;
  defaultTopic: string;
  imagePrimary: boolean;
  rows: unknown[];
  savedAt: string;
};

/** Drop full-page source renders — keeps draft smaller; re-upload PDF to re-crop if needed. */
function slimRowForStorage(row: Record<string, unknown>): Record<string, unknown> {
  const { sourceImageDataUrl, sourceImageDataUrls, cropping, croppingPageIndex, ...rest } =
    row;
  void sourceImageDataUrl;
  void sourceImageDataUrls;
  void cropping;
  void croppingPageIndex;
  return rest;
}

function slimSnapshot(
  snapshot: Omit<PdfImportDraftSnapshot, "savedAt">,
): PdfImportDraftSnapshot {
  return {
    ...snapshot,
    rows: snapshot.rows.map((r) => slimRowForStorage(r as Record<string, unknown>)),
    savedAt: new Date().toISOString(),
  };
}

/** @deprecated Use savePdfImportDraftSync — autosave must not re-compress images. */
export async function buildPdfImportDraftSnapshot(
  snapshot: Omit<PdfImportDraftSnapshot, "savedAt">,
): Promise<PdfImportDraftSnapshot> {
  return slimSnapshot(snapshot);
}

const MAX_DRAFT_BYTES = 4_500_000;

export function loadPdfImportDraft(): PdfImportDraftSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pdfImportDraft);
    if (!raw) return null;
    if (raw.length > MAX_DRAFT_BYTES) {
      localStorage.removeItem(STORAGE_KEYS.pdfImportDraft);
      return null;
    }
    const parsed = JSON.parse(raw) as PdfImportDraftSnapshot;
    if (!Array.isArray(parsed.rows) || !parsed.rows.length) return null;
    return parsed;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.pdfImportDraft);
    } catch {
      // ignore
    }
    return null;
  }
}

export function savePdfImportDraft(snapshot: PdfImportDraftSnapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.pdfImportDraft, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearPdfImportDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.pdfImportDraft);
  } catch {
    // ignore
  }
}

/** Fast autosave — no image re-encoding (compression only runs on DB import). */
export function savePdfImportDraftSync(
  snapshot: Omit<PdfImportDraftSnapshot, "savedAt">,
): boolean {
  try {
    const payload = JSON.stringify(slimSnapshot(snapshot));
    if (payload.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(STORAGE_KEYS.pdfImportDraft, payload);
    return true;
  } catch {
    return false;
  }
}
