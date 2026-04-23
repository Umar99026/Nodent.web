import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PeerWrittenResponses } from "@/components/quiz/PeerWrittenResponses";
import { Images } from "lucide-react";

type Props = {
  subjectId: string;
  questionKey: string;
  currentUserId: number;
  label?: string;
  className?: string;
  requireConfirmBeforeOpen?: boolean;
  onViewedBeforeSubmit?: () => void;
  modelWorking?: {
    text?: string;
    imageUrls?: string[];
  };
};

/**
 * Opens peer uploads in a modal so we never navigate the main window to `/api/written/.../all`
 * (that URL shows raw JSON in the browser).
 */
export function PeerScansDialog({
  subjectId,
  questionKey,
  currentUserId,
  label = "View & rate others' answers",
  className,
  requireConfirmBeforeOpen = false,
  onViewedBeforeSubmit,
  modelWorking,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`w-full gap-2 rounded-full border-black/15 bg-white text-black hover:bg-white/90 sm:w-auto ${className ?? ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (requireConfirmBeforeOpen) {
            const ok = window.confirm(
              "Viewing worked solutions or other responses before submitting means this question will not award marks. Continue?",
            );
            if (!ok) return;
            onViewedBeforeSubmit?.();
          }
          setOpen(true);
        }}
      >
        <Images className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[min(85vh,760px)] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Peer answers & ratings</DialogTitle>
            <DialogDescription>
              Other students&apos; saved text and attached images. Give each answer a score from 1
              to 5; authors see the average of ratings they receive.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <PeerWrittenResponses
              subjectId={subjectId}
              questionKey={questionKey}
              currentUserId={currentUserId}
              modelWorking={modelWorking}
              enabled
              hideIntro
              className="border-0 bg-transparent p-0 shadow-none"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
