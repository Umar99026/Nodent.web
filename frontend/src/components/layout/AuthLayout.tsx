import { NodentWordmark } from "@/components/branding/NodentWordmark";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Create Account: hero wordmark sits a bit above the tagline; Sign In keeps centred band. */
  authMode?: "login" | "signup";
}

export function AuthLayout({
  children,
  className,
  authMode = "login",
}: AuthLayoutProps) {
  const isSignup = authMode === "signup";
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Left: Brand hero — brand blue */}
      <div className="relative hidden flex-col items-center justify-center overflow-x-hidden px-12 lg:flex">
        <div className="absolute inset-0 bg-brand" />
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        </div>
        {/* Animated background orbs */}
        <div className="orb-float-slow pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="orb-float-medium pointer-events-none absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="orb-float-slow pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

        {/* Grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {isSignup ? (
          /* Signup: logo stays up; wordmark + tagline grouped toward bottom with a small gap */
          <div className="relative z-10 flex min-h-[min(300px,38vh)] w-full max-w-md flex-col items-center text-center">
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="Nodent logo"
                className="h-20 w-20 drop-shadow-2xl"
              />
              <div className="absolute -inset-2 -z-10 rounded-3xl bg-brand/20 blur-xl" />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-end gap-3 pb-0.5">
              <h1 className="m-0 flex flex-col items-center justify-center">
                <NodentWordmark size="lg" variant="onBrand" />
              </h1>
              <p className="m-0 shrink-0 text-lg leading-relaxed text-white/85">
                Know where you stand before results land
              </p>
            </div>
          </div>
        ) : (
          /* Login: wordmark midway between logo and tagline */
          <div className="relative z-10 flex min-h-[min(300px,38vh)] max-w-md flex-col items-center justify-between gap-6 text-center">
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="Nodent logo"
                className="h-20 w-20 drop-shadow-2xl"
              />
              <div className="absolute -inset-2 -z-10 rounded-3xl bg-brand/20 blur-xl" />
            </div>

            <h1 className="m-0 flex shrink-0 flex-col items-center justify-center">
              <NodentWordmark size="lg" variant="onBrand" />
            </h1>

            <p className="m-0 shrink-0 text-lg leading-relaxed text-white/85">
              Know where you stand before results land
            </p>
          </div>
        )}
      </div>

      {/* Right: Form area */}
      <div className="relative flex min-h-dvh items-center justify-center bg-cream px-4 pb-8 pt-20 sm:px-8 sm:py-12">
        {/* Mobile logo */}
        <div className="safe-top absolute left-4 top-4 flex items-center gap-2.5 sm:left-6 sm:top-6 lg:hidden">
          <img src="/logo.png" alt="Nodent logo" className="h-8 w-8" />
          <NodentWordmark
            size="sm"
            variant="onCream"
            className={cn(isSignup ? "mt-2" : "mt-1")}
          />
        </div>

        <div
          className={cn(
            "w-full max-w-md rounded-2xl border border-black/[0.04] bg-white/80 p-6 shadow-xl shadow-navy/[0.03] backdrop-blur-md sm:p-10",
            "grain-texture",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
