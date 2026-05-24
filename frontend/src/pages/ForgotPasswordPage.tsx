import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!email.trim()) {
      setServerError("Email is required.");
      return;
    }
    if (!validateEmail(email.trim())) {
      setServerError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch<{ ok: boolean; message: string }>(API_PATHS.auth.forgotPassword, {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout authMode="login">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Forgot password
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the email on your account and we&apos;ll send reset instructions.
          </p>
        </div>

        {serverError && (
          <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        {sent ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-[#0b0f19]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
              <p>
                If an account exists for that email, we&apos;ve sent password reset
                instructions. Check your inbox and spam folder. The link expires in 1
                hour.
              </p>
            </div>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to="/login">
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full bg-brand text-white hover:bg-brand-dark"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>

            <Button asChild variant="ghost" className="h-11 w-full">
              <Link to="/login">
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
