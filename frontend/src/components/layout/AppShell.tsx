import { AppSidebar } from "@/components/layout/Sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    // Prefer browser history when available, but fall back safely.
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-6 backdrop-blur-sm bg-background/80">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="mr-2 h-5" />
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <Separator orientation="vertical" className="mr-2 h-5" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="font-display text-lg tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
        </header>
        <ScrollArea className="flex-1">
          <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
            <div className="animate-fade-in-up">
              {children}
            </div>
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
