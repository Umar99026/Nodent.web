import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { subjectsForUser } from "@/lib/subjects";
import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

type ResourceRow = { id: string; name: string; content: string };

type PromptingContext = {
  subjectId: string;
  promptText: string;
  resources: ResourceRow[];
  updatedAt?: string;
};

function emptyResource(): ResourceRow {
  return { id: crypto.randomUUID(), name: "", content: "" };
}

export function AdminPromptingPanel() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const subjects = subjectsForUser({ isAdmin }).filter((s) => s.id !== "demo");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "methods");
  const [promptText, setPromptText] = useState("");
  const [resources, setResources] = useState<ResourceRow[]>([emptyResource()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadContext = useCallback(async (sid: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ contexts?: PromptingContext[] }>("/api/admin/prompting");
      const hit = (data.contexts ?? []).find((c) => c.subjectId === sid);
      setPromptText(hit?.promptText ?? "");
      const rows = (hit?.resources ?? []).map((r) => ({
        id: crypto.randomUUID(),
        name: r.name ?? "",
        content: r.content ?? "",
      }));
      setResources(rows.length ? rows : [emptyResource()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load prompting.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    void loadContext(subjectId);
  }, [subjectId, loadContext]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/prompting/${encodeURIComponent(subjectId)}`, {
        method: "PUT",
        body: JSON.stringify({
          promptText,
          resources: resources
            .filter((r) => r.name.trim() || r.content.trim())
            .map((r) => ({ name: r.name.trim(), content: r.content.trim() })),
        }),
      });
      toast.success("Prompting saved for " + subjectId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Prompting</CardTitle>
        <CardDescription>
          Per-subject instructions and reference text/files content sent to Gemini whenever that
          subject is marked (Methods, English essays, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Marking prompt</Label>
              <Textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={8}
                placeholder="e.g. Mark like a VCAA Methods assessor. Accept equivalent methods. Use study-design terminology…"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Reference resources (text)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResources((prev) => [...prev, emptyResource()])}
                >
                  <Plus className="mr-1 size-3.5" />
                  Add resource
                </Button>
              </div>
              {resources.map((row, idx) => (
                <div key={row.id} className="space-y-2 rounded-lg border border-black/10 p-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Resource name (e.g. Methods exam guide excerpt)"
                      value={row.name}
                      onChange={(e) =>
                        setResources((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx]!, name: e.target.value };
                          return next;
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove resource"
                      onClick={() =>
                        setResources((prev) =>
                          prev.length <= 1 ? [emptyResource()] : prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={row.content}
                    onChange={(e) =>
                      setResources((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx]!, content: e.target.value };
                        return next;
                      })
                    }
                    rows={5}
                    placeholder="Paste exam guide notes, rubric excerpts, or file text here…"
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
            <Button type="button" onClick={() => void save()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save prompting
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
