import { AppSidebar } from "@/components/layout/Sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}

export function AppShell({ children, title, subtitle, headerRight }: AppShellProps) {
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-transparent">
        <header
          className={`flex shrink-0 items-center gap-2 px-6 backdrop-blur-sm ${
            isDashboard
              ? "border-b-0 bg-[#3f8fc9] py-4 text-white"
              : "h-16 border-b border-white/15 bg-white/10 text-white"
          }`}
        >
          <>
            <SidebarTrigger className="-ml-1 text-white/70 hover:text-white" />
            {!isDashboard && (
              <>
                <Separator orientation="vertical" className="mr-2 h-5 bg-white/15" />
                <button
                  onClick={handleBack}
                  className="inline-flex items-center justify-center rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <Separator orientation="vertical" className="mr-2 h-5 bg-white/15" />
              </>
            )}
          </>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 sm:gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <h1
                className={`font-display truncate tracking-tight text-white ${
                  isDashboard
                    ? "text-[clamp(1.8rem,5.2vw,3rem)] font-extrabold"
                    : isTrackStudy
                      ? "text-[clamp(1.6rem,4.8vw,2.6rem)] font-extrabold"
                    : "text-[clamp(0.95rem,3.8vw,1.25rem)] sm:text-xl"
                }`}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className={`truncate ${
                    isDashboard
                      ? "text-[clamp(1rem,2.6vw,1.25rem)] font-bold text-white/90"
                      : isTrackStudy
                        ? "text-[clamp(0.95rem,2.4vw,1.2rem)] font-bold text-white/85"
                      : "text-sm text-white/70"
                  }`}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {headerRight ? (
              <div className="min-w-0 shrink-0">{headerRight}</div>
            ) : null}
          </div>
        </header>
        {isDashboard && <div className="h-[2px] w-full bg-[#3f8fc9]" />}
        <ScrollArea className="min-h-0 min-w-0 flex-1 bg-transparent">
          <main
            className={`box-border w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 ${
              isDashboard ? "max-w-none text-white" : "mx-auto max-w-7xl text-white"
            } ${isDashboard ? "pt-1 pb-8" : "py-10"}`}
          >
            <div className="animate-fade-in-up min-w-0 max-w-full">
              {children}
            </div>
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
