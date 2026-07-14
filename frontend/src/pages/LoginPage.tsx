import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiUnreachableMessage } from "@/lib/api";
import { loginFormErrorMessage, signupFormErrorMessage } from "@/lib/userFacingErrors";
import { STORAGE_KEYS, type AccountRole } from "@/lib/constants";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { passwordPolicyError } from "@/lib/passwordPolicy";
import { signupEmailError } from "@/lib/emailValidation";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, GraduationCap, BookOpen, Lock } from "lucide-react";

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  accountRole?: string;
}

function validateLogin(identity: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!identity.trim()) errors.email = "Email or username is required";
  if (!password) errors.password = "Password is required";
  return errors;
}

function validateSignup(
  username: string,
  email: string,
  password: string,
  accountRole: AccountRole | "",
): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) errors.username = "Username is required";
  else if (username.trim().length < 2)
    errors.username = "Username must be at least 2 characters";
  const emailError = signupEmailError(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = "Password is required";
  else {
    const pwErr = passwordPolicyError(password);
    if (pwErr) errors.password = pwErr;
  }
  if (accountRole === "teacher") {
    errors.accountRole = "Teacher accounts are not available yet";
  } else if (accountRole !== "student") {
    errors.accountRole = "Please choose student";
  }
  return errors;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [tab, setTab] = useState<string>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [loginIdentity, setLoginIdentity] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true",
  );

  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<AccountRole | "">("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    const errors = validateLogin(loginIdentity, loginPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);
    try {
      localStorage.setItem(
        STORAGE_KEYS.rememberLogin,
        rememberMe ? "true" : "false",
      );
      await login(loginIdentity.trim(), loginPassword);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(loginFormErrorMessage(err, apiUnreachableMessage()));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    const errors = validateSignup(
      signupUsername,
      signupEmail,
      signupPassword,
      signupRole,
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (signupRole !== "student") return;

    setIsSubmitting(true);
    try {
      await signup(
        signupUsername.trim(),
        signupEmail.trim(),
        signupPassword,
        signupRole,
      );
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setServerError(signupFormErrorMessage(err, apiUnreachableMessage()));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout authMode={tab === "signup" ? "signup" : "login"}>
      <div className="space-y-6">
        <Link
          to="/#demo"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to demo page
        </Link>

        <div className="text-center">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue your studies, or create a new account.
          </p>
        </div>

        {serverError && (
          <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(val) => {
            setTab(val as string);
            setFieldErrors({});
            setServerError("");
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Create Account
            </TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="login-identity">Email or Username</Label>
                <Input
                  id="login-identity"
                  type="text"
                  placeholder="you@example.com"
                  autoComplete="username"
                  value={loginIdentity}
                  onChange={(e) => setLoginIdentity(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  className="h-11"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-danger">{fieldErrors.email}</p>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-brand hover:text-brand-dark hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.password}
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
                {fieldErrors.password && (
                  <p className="text-xs text-danger">{fieldErrors.password}</p>
                )}
              </div>

              <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-input accent-brand"
                />
                Remember me
              </label>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full bg-brand text-white hover:bg-brand-dark transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Signup */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="mt-6 space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  type="text"
                  placeholder="Choose a username"
                  autoComplete="username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  aria-invalid={!!fieldErrors.username}
                  className="h-11"
                />
                {fieldErrors.username && (
                  <p className="text-xs text-danger">{fieldErrors.username}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  className="h-11"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-danger">{fieldErrors.email}</p>
                )}
                {!fieldErrors.email ? (
                  <p className="text-xs text-muted-foreground">
                    Use a real school or email-provider domain.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>I am a...</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSignupRole("student")}
                    className={[
                      "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center transition-colors",
                      signupRole === "student"
                        ? "border-brand bg-brand/10 text-foreground"
                        : "border-input bg-background text-muted-foreground hover:border-brand/40 hover:bg-muted/40",
                    ].join(" ")}
                    aria-pressed={signupRole === "student"}
                  >
                    <BookOpen className="size-5" />
                    <span className="text-sm font-semibold">Student</span>
                    <span className="text-xs leading-snug">
                      Practice and track my study
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="relative flex min-h-24 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-input bg-muted/50 px-3 py-4 text-center text-muted-foreground opacity-65"
                    aria-label="Teacher accounts — coming soon"
                  >
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                      <Lock className="size-3" aria-hidden />
                      Coming soon
                    </span>
                    <GraduationCap className="size-5" />
                    <span className="text-sm font-semibold">Teacher</span>
                    <span className="text-xs leading-snug">
                      Teacher sign-up is currently locked
                    </span>
                  </button>
                </div>
                {fieldErrors.accountRole && (
                  <p className="text-xs text-danger">{fieldErrors.accountRole}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.password}
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
                {fieldErrors.password && (
                  <p className="text-xs text-danger">{fieldErrors.password}</p>
                )}
                {!fieldErrors.password ? (
                  <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full bg-brand text-white hover:bg-brand-dark transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
}
