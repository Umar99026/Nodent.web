import { useRef, useState } from "react";
import { Crop, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressImageFileToDataUrl, compressDataUrlIfLarge } from "@/lib/imageCompressor";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";

type AdminQuestionImageEditorProps = {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  label?: string;
  hint?: string;
};

export function AdminQuestionImageEditor({
  imageUrls,
  onChange,
  maxImages = 6,
  label = "Question images / stimulus",
  hint = "Drag on an image to crop what students see. Upload or replace figures below.",
}: AdminQuestionImageEditorProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_CROP);
  const cropSourceRef = useRef<Record<number, string>>({});

  const appendFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = Math.max(0, maxImages - imageUrls.length);
    if (!room) {
      toast.error(`Maximum ${maxImages} images.`);
      return;
    }
    setUploading(true);
    try {
      const added: string[] = [];
      for (const file of list.slice(0, room)) {
        const url = await compressImageFileToDataUrl(file, {
          maxWidth: 900,
          maxHeight: 900,
          quality: 0.62,
          outputType: "image/jpeg",
        });
        added.push(url);
      }
      onChange([...imageUrls, ...added]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not process image.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (index: number) => {
    onChange(imageUrls.filter((_, i) => i !== index));
    delete cropSourceRef.current[index];
    if (croppingIndex === index) setCroppingIndex(null);
  };

  const startCrop = (index: number) => {
    const src = imageUrls[index];
    if (!src) return;
    if (!cropSourceRef.current[index]) {
      cropSourceRef.current[index] = src;
    }
    setCropRect(FULL_CROP);
    setCroppingIndex(index);
  };

  const applyCrop = async (index: number, cropped: string) => {
    try {
      const compressed = await compressDataUrlIfLarge(cropped);
      onChange(imageUrls.map((url, i) => (i === index ? compressed : url)));
      setCroppingIndex(null);
      toast.success("Crop applied.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not compress cropped image.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{label}</Label>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>

      {imageUrls.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {imageUrls.map((url, index) => (
            <div
              key={`${index}-${url.slice(0, 32)}`}
              className="overflow-hidden rounded-xl border border-black/10 bg-white"
            >
              {croppingIndex === index ? (
                <div className="p-2">
                  <PdfPageCropEditor
                    imageDataUrl={cropSourceRef.current[index] ?? url}
                    crop={cropRect}
                    onCropChange={setCropRect}
                    onApply={(cropped) => applyCrop(index, cropped)}
                    onCancel={() => setCroppingIndex(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex max-h-56 items-center justify-center bg-[#f3f4f6] p-2">
                    <img
                      src={url}
                      alt={`Question figure ${index + 1}`}
                      className="max-h-52 w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex gap-2 border-t border-black/10 p-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 gap-1.5"
                      onClick={() => startCrop(index)}
                    >
                      <Crop className="size-3.5" />
                      Crop
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-danger hover:text-danger"
                      onClick={() => removeAt(index)}
                      aria-label="Remove image"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-black/15 bg-white/50 px-3 py-4 text-center text-xs text-muted-foreground">
          No images yet. Upload a figure or table screenshot below.
        </p>
      )}

      {imageUrls.length < maxImages ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) void appendFiles(e.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-white/50 px-4 py-4 text-center transition-colors hover:bg-white/70"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-5 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-[#0b0f19]/80">
            {uploading ? "Processing…" : "Upload image"}
          </span>
          <span className="text-xs text-muted-foreground">Drag & drop or click to browse</span>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void appendFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
