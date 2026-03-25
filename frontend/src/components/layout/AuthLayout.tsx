import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Left: Brand hero — brand blue */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden px-12 lg:flex">
        <div className="absolute inset-0 bg-brand" />
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        </div>
        {/* Animated background orbs */}
        <div className="orb-float-slow pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="orb-float-medium pointer-events-none absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="orb-float-slow pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />

        {/* Grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 flex max-w-md flex-col items-center text-center">
          {/* Logo mark */}
          <div className="relative mb-8">
            <img
              src="/logo.png"
              alt="Nodent logo"
              className="h-20 w-20 drop-shadow-2xl"
            />
            <div className="absolute -inset-2 -z-10 rounded-3xl bg-brand/20 blur-xl" />
          </div>

          <h1 className="font-display text-4xl tracking-tight text-white">
            Nodent
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-white/85">
            Know where you stand before results land
          </p>

          {/* (Removed left-side feature list to keep login clean/sleek.) */}
        </div>
      </div>

      {/* Right: Form area */}
      <div className="flex items-center justify-center bg-cream px-4 py-12 sm:px-8">
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2.5 lg:hidden">
          <img src="/logo.png" alt="Nodent logo" className="h-8 w-8" />
          <span className="font-display text-lg text-navy">Nodent</span>
        </div>

        <div
          className={cn(
            "w-full max-w-md rounded-2xl border border-black/[0.04] bg-white/80 p-8 shadow-xl shadow-navy/[0.03] backdrop-blur-md sm:p-10",
            "grain-texture",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
