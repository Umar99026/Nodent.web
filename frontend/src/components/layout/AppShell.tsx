import { AppSidebar } from "@/components/layout/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  /** Back arrow + title stay in one left cluster (no stretched title band). */
  compactHeader?: boolean;
  hideTitle?: boolean;
  subtitleClassName?: string;
  edgeToEdgeHeader?: boolean;
  edgeToEdgeMain?: boolean;
  hideBackButton?: boolean;
  edgeToEdgeHeaderClassName?: string;
}

export function AppShell({
  children,
  title,
  subtitle,
  headerRight,
  compactHeader = false,
  hideTitle = false,
  subtitleClassName,
  edgeToEdgeHeader = false,
  edgeToEdgeMain = false,
  hideBackButton = false,
  edgeToEdgeHeaderClassName,
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isTrackStudy = location.pathname === "/track-study";
  const handleBack = () => {
    // Prefer browser history when available, but fall back safely.
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <AppSidebar />
      <header className="text-white">
        <div
          className={`flex items-center gap-3 ${
            compactHeader ? "w-full max-w-none justify-start" : ""
          } ${
            isDashboard
              ? "px-4 sm:px-6 lg:px-8"
              : edgeToEdgeHeader
                ? edgeToEdgeHeaderClassName ?? "px-2 sm:px-3 lg:px-4"
                : compactHeader
                  ? "pl-1 pr-4 sm:pl-2 sm:pr-6 lg:pl-3 lg:pr-8"
                  : "mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8"
          } ${
            isDashboard ? "min-h-12 py-3" : "min-h-14 py-4"
          }`}
        >
          {compactHeader && !isDashboard && !hideBackButton ? (
            <>
              <div className="flex min-w-0 shrink-0 items-center gap-0.5">
                <button
                  onClick={handleBack}
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-white/70 transition-colors hover:bg-black/10 hover:text-white sm:p-2"
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 text-left">
                  {!hideTitle && (
                    <h1
                      className={`font-display truncate text-left tracking-tight text-white ${
                        isTrackStudy
                          ? "text-[clamp(1.1rem,3.8vw,1.5rem)] font-bold"
                          : "text-[clamp(1rem,3vw,1.2rem)] font-semibold"
                      }`}
                    >
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <div
                      className={`truncate text-left ${
                        isTrackStudy
                          ? "text-sm font-medium text-white/75"
                          : "text-xs text-white/65 sm:text-sm"
                      } ${subtitleClassName ?? ""}`}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>
              {headerRight ? (
                <div className="ml-auto min-w-0 shrink-0">{headerRight}</div>
              ) : null}
            </>
          ) : (
            <>
              {!isDashboard && !hideBackButton && (
                <>
                  <button
                    onClick={handleBack}
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 text-white/70 transition-colors hover:bg-black/10 hover:text-white"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <Separator orientation="vertical" className="h-5 bg-white/20" />
                </>
              )}

              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1 pr-2 text-left">
                  {!hideTitle && (
                    <h1
                      className={`font-display truncate text-left tracking-tight text-white ${
                        isDashboard
                          ? "text-[clamp(1.15rem,3.5vw,1.7rem)] font-bold"
                          : isTrackStudy
                            ? "text-[clamp(1.1rem,3.8vw,1.5rem)] font-bold"
                            : "text-[clamp(1rem,3vw,1.2rem)] font-semibold"
                      }`}
                    >
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <div
                      className={`${hideTitle ? "" : "truncate text-left "} ${
                        isDashboard
                          ? "text-sm font-medium text-white/72"
                          : isTrackStudy
                            ? "text-sm font-medium text-white/75"
                            : "text-xs text-white/65 sm:text-sm"
                      } ${subtitleClassName ?? ""}`}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>

                {headerRight ? <div className="ml-auto min-w-0 shrink-0">{headerRight}</div> : null}
              </div>
            </>
          )}
        </div>
      </header>
      <ScrollArea className="min-h-0 min-w-0 flex-1 bg-transparent">
        <main
          className={`box-border w-full min-w-0 max-w-full ${
            isDashboard
              ? "max-w-none px-4 sm:px-6 lg:px-8 text-white"
              : edgeToEdgeMain
                ? "max-w-none px-2 sm:px-3 lg:px-4 text-white"
                : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-white"
          } ${isDashboard ? "pt-2 pb-8" : "py-8"}`}
        >
          <div className="animate-fade-in-up min-w-0 max-w-full">{children}</div>
        </main>
      </ScrollArea>
    </div>
  );
}
