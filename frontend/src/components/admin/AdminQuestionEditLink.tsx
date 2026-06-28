import { useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import type { Question } from "@/lib/subjects";
import { AdminInlineQuestionEditDialog } from "@/components/admin/AdminInlineQuestionEditDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminQuestionEditLinkProps = {
  question: Question;
  subjectId?: string;
  className?: string;
  onSaved?: () => void;
};

export function AdminQuestionEditLink({
  question,
  subjectId = "",
  className,
  onSaved,
}: AdminQuestionEditLinkProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAdminUser(user) || !question.id || !subjectId) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-8 gap-1.5 border-black/15 bg-white/90 text-xs", className)}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" aria-hidden />
        Edit
      </Button>
      <AdminInlineQuestionEditDialog
        open={open}
        onOpenChange={setOpen}
        question={question}
        subjectId={subjectId}
        onSaved={onSaved}
      />
    </>
  );
}
