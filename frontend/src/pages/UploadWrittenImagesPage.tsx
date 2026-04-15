import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { getApiBase } from "@/lib/api";

export default function UploadWrittenImagesPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const tokenParam = token || searchParams.get("token") || "";

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [jsonOut, setJsonOut] = useState("");

  const uploadUrl = useMemo(() => {
    return `/api/written/upload/${encodeURIComponent(tokenParam)}`;
  }, [tokenParam]);

  useEffect(() => {
    if (!tokenParam) toast.error("Missing upload token.");
  }, [tokenParam]);

  const handlePick = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast.error("Please select image files.");
      return;
    }
    setBusy(true);
    try {
      const urls = await Promise.all(
        list.slice(0, 8).map(async (file) => {
          return await compressImageFileToDataUrl(file, {
            maxWidth: 1800,
            maxHeight: 1800,
            quality: 0.75,
            outputType: "image/jpeg",
          });
        }),
      );
      const json = JSON.stringify(urls);
      setJsonOut(json);

      const res = await fetch(`${getApiBase()}${uploadUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: urls }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(data?.error || "Upload failed.");

      toast.success("Uploaded. You can close this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShell title="Upload answer images" subtitle="Take a photo of your working/graph">
      <div className="mx-auto max-w-xl space-y-6">
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">Upload photos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => void handlePick(e.target.files)}
              className="w-full"
              disabled={busy || !tokenParam}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !tokenParam}
            >
              {busy ? "Uploading…" : "Choose images"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Tip: use your phone camera, then upload the photo(s). This page is safe to open from a QR code.
            </p>
          </CardContent>
        </Card>

        {jsonOut ? (
          <Card className="paper-texture">
            <CardHeader>
              <CardTitle className="font-display text-base">Debug (generated JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={jsonOut} readOnly rows={5} className="bg-white/70 font-mono text-xs" />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

