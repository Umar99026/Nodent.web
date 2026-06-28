import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { getApiBase } from "@/lib/api";
import { Camera, Loader2 } from "lucide-react";

export default function UploadWrittenImagesPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const tokenParam = token || searchParams.get("token") || "";

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

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
      const res = await fetch(`${getApiBase()}${uploadUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: urls }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error || "Upload failed.");

      setUploadedCount((n) => n + urls.length);
      toast.success("Uploaded! Check your computer — the image should appear shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5f0] px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-[#0b0f19]">Upload photos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Take a photo with your camera and send it to your computer.
          </p>
        </div>

        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">Camera or gallery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => void handlePick(e.target.files)}
              className="sr-only"
              disabled={busy || !tokenParam}
            />
            <Button
              type="button"
              className="h-12 w-full gap-2 text-base"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !tokenParam}
            >
              {busy ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera className="size-5" />
                  Take photo or choose image
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This page is only accessible via your QR code. Link expires in about 20 minutes.
            </p>
            {uploadedCount > 0 ? (
              <p className="text-center text-sm font-medium text-emerald-700">
                {uploadedCount} photo{uploadedCount === 1 ? "" : "s"} sent successfully.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

