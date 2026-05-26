import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordPolicyError } from "@/lib/passwordPolicy";
import { Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!token) {
      setServerError("Reset link is invalid or expired. Request a new one.");
      return;
    }
    if (!password) {
      setServerError("Password is required.");
      return;
    }
    const pwErr = passwordPolicyError(password);
    if (pwErr) {
      setServerError(pwErr);
      return;
    }
    if (password !== confirmPassword) {
      setServerError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch<{ ok: boolean; message: string }>(API_PATHS.auth.resetPassword, {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout authMode="login">
        <div className="space-y-5 text-center">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Invalid reset link
          </h2>
          <p className="text-sm text-muted-foreground">
            This link is missing or has expired. Request a new reset email.
          </p>
          <Link
            to="/forgot-password"
            className={cn(
              buttonVariants(),
              "inline-flex h-11 w-full bg-brand text-white hover:bg-brand-dark",
            )}
          >
            Request reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout authMode="login">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Set a new password
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        {serverError && (
          <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        {done ? (
          <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-[#0b0f19]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
            Password updated. Redirecting you to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <Input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
