import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopbarProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function Topbar({ title, subtitle, className }: TopbarProps) {
  const { user } = useAuth();

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-4 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {user && (
        <div className="flex items-center gap-2.5 rounded-full border border-border/50 bg-card/60 py-1.5 pr-4 pl-1.5 transition-all duration-200 hover:border-border">
          <Avatar size="sm">
            <AvatarFallback className="bg-brand/15 text-[10px] font-semibold text-brand">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground/80">
            {user.username}
          </span>
        </div>
      )}
    </header>
  );
}
