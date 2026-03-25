import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_EMAIL } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Track Study", icon: Clock, path: "/track" },
  { label: "Admin", icon: Settings, path: "/admin", adminOnly: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile } = useSidebar();

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNav = (path: string) => {
    navigate(path);
    setOpenMobile(false);
  };

  return (
    <SidebarRoot
      collapsible="icon"
      className="border-r-0"
      style={
        {
          "--sidebar-background": "#0f172a",
          "--sidebar-foreground": "rgba(255, 255, 255, 0.9)",
          "--sidebar-accent": "rgba(55, 151, 211, 0.08)",
          "--sidebar-accent-foreground": "rgba(255, 255, 255, 0.95)",
          "--sidebar-border": "rgba(255, 255, 255, 0.06)",
          "--sidebar-primary": "#3797D3",
          "--sidebar-primary-foreground": "#ffffff",
          "--sidebar-ring": "#3797D3",
        } as React.CSSProperties
      }
    >
      {/* Logo */}
      <SidebarHeader className="px-4 pt-5 pb-0">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Nodent logo"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg tracking-tight text-white">
              Nodent
            </span>
            <span className="text-[11px] leading-tight text-white/35 font-medium">
              VCE Study Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 my-3 bg-white/6" />

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (
                  item.adminOnly &&
                  user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()
                )
                  return null;

                const isActive = location.pathname.startsWith(item.path);

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => handleNav(item.path)}
                      className={
                        isActive
                          ? "bg-brand/12 text-brand-light hover:bg-brand/16 hover:text-brand-light"
                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }
                    >
                      <item.icon
                        className={
                          isActive ? "text-brand" : "text-white/35"
                        }
                      />
                      <span className="font-medium">{item.label}</span>
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(55,151,211,0.6)] group-data-[collapsible=icon]:hidden" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User card */}
      <SidebarFooter className="border-t border-white/6">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-brand/15 text-xs font-bold text-brand-light">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-white/85">
                  {user?.username ?? "Guest"}
                </span>
                <span className="truncate text-[11px] text-white/35">
                  {user?.email ?? ""}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md p-1.5 text-white/25 transition-colors hover:bg-white/6 hover:text-red-400 group-data-[collapsible=icon]:hidden"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}
