import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  fetchClassMembership,
  joinClass,
  previewClass,
  type ClassPreview,
} from "@/lib/teacherClass";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Users } from "lucide-react";

export default function JoinClassPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(() => searchParams.get("code")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ClassPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState<{
    className: string;
    teacherName?: string;
  } | null>(null);
  const autoJoinedRef = useRef(false);

  const handleJoin = useCallback(
    async (rawCode?: string) => {
      const joinCode = (rawCode ?? code).trim().toUpperCase();
      if (!joinCode) {
        toast.error("Enter your class code.");
        return;
      }
      setBusy(true);
      try {
        const result = await joinClass(joinCode);
        toast.success(
          result.alreadyMember
            ? `You're already in ${result.className}.`
            : `Joined ${result.className} with ${result.teacherName}.`,
        );
        navigate("/dashboard", { replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not join class.");
      } finally {
        setBusy(false);
      }
    },
    [code, navigate],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchClassMembership()
      .then((data) => {
        if (cancelled) return;
        if (data.enrolled && data.className) {
          setAlreadyEnrolled({
            className: data.className,
            teacherName: data.teacherName,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMembershipLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fromQr = searchParams.get("code")?.trim();
    if (!fromQr || alreadyEnrolled || membershipLoading || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    setCode(fromQr.toUpperCase());
    void handleJoin(fromQr);
  }, [searchParams, alreadyEnrolled, membershipLoading, handleJoin]);

  useEffect(() => {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length < 4) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
      void previewClass(normalized)
        .then((data) => {
          if (!cancelled) setPreview(data);
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code]);

  if (membershipLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (alreadyEnrolled) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
          <Card className="border-black/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <CheckCircle2 className="size-5 text-success" />
                You're in a class
              </CardTitle>
              <CardDescription>
                You're enrolled in{" "}
                <span className="font-medium text-foreground">{alreadyEnrolled.className}</span>
                {alreadyEnrolled.teacherName ? ` with ${alreadyEnrolled.teacherName}` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
        <Card className="border-black/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Users className="size-5 text-brand" />
              Join a class
            </CardTitle>
            <CardDescription>
              Enter the code from your teacher. Once you join, they can see your practice stats
              for that class.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Class code"
              className="h-12 text-center font-mono text-lg tracking-[0.2em]"
              maxLength={12}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />

            {previewLoading ? (
              <p className="text-center text-sm text-muted-foreground">Checking code…</p>
            ) : preview ? (
              <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
                <p className="font-semibold text-[#0b0f19]">{preview.className}</p>
                <p className="mt-1 text-muted-foreground">
                  Teacher: {preview.teacherName}
                  {preview.memberCount > 0
                    ? ` · ${preview.memberCount} student${preview.memberCount === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            ) : code.trim().length >= 4 ? (
              <p className="text-center text-sm text-muted-foreground">No class found for that code.</p>
            ) : null}

            <Button
              className="w-full"
              disabled={busy || !preview}
              onClick={() => void handleJoin()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Joining…
                </>
              ) : (
                "Join class"
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => navigate("/dashboard")}
            >
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
