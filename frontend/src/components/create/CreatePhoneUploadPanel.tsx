import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Copy, Check, Smartphone } from "lucide-react";

type Props = {
  onImagesReceived: (urls: string[]) => void;
};

export function CreatePhoneUploadPanel({ onImagesReceived }: Props) {
  const resultRef = useRef<HTMLDivElement>(null);
  const [uploadToken, setUploadToken] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareUrl) return;
    const id = requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [shareUrl]);

  useEffect(() => {
    if (!uploadToken) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await apiFetch<{ imageUrls?: string[] }>(
          `/api/written/upload-session/${encodeURIComponent(uploadToken)}`,
        );
        const urls = Array.isArray(data?.imageUrls)
          ? data.imageUrls.filter((u) => typeof u === "string" && u.trim())
          : [];
        if (!cancelled && urls.length) {
          onImagesReceived(urls);
          toast.success(
            urls.length === 1
              ? "Photo received from your phone."
              : `${urls.length} photos received from your phone.`,
          );
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void poll();
    const intervalId = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [uploadToken, onImagesReceived]);

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Upload link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link manually.");
    }
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Smartphone className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Upload from phone (QR)</div>
            <div className="text-xs text-muted-foreground">
              Scan with your phone to take photos and send them here. Link expires in about 20
              minutes.
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={qrBusy}
          onClick={async () => {
            setQrBusy(true);
            setShareUrl("");
            setUploadToken("");

            const base =
              typeof window !== "undefined" && window.location?.origin
                ? window.location.origin
                : "";
            if (!base) {
              toast.error("Could not detect this page URL. Refresh and try again.");
              setQrBusy(false);
              return;
            }

            try {
              const r = await apiFetch<{ token?: string }>("/api/written/upload-token", {
                method: "POST",
                body: JSON.stringify({ purpose: "create" }),
              });
              const token = typeof r?.token === "string" ? r.token.trim() : "";
              if (!token) {
                toast.error("Server did not return an upload token.");
                return;
              }

              const url = `${base}/upload/${encodeURIComponent(token)}`;
              setUploadToken(token);
              setShareUrl(url);
              toast.success("Scan the QR below with your phone.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not create upload link.");
            } finally {
              setQrBusy(false);
            }
          }}
        >
          {qrBusy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate QR"
          )}
        </Button>
      </div>

      <div ref={resultRef} className="min-h-0">
        {shareUrl ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-3 py-2">
              <code className="min-w-0 flex-1 break-all text-[11px] text-foreground/90">
                {shareUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-lg border border-black/10 bg-white p-4">
              <QRCodeSVG
                value={shareUrl}
                size={240}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0b0f19"
                title="Upload link QR code"
              />
              <p className="text-center text-xs text-muted-foreground">
                Waiting for uploads… photos will appear below automatically.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
