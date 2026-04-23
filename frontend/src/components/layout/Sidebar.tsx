import { NodentWordmark } from "@/components/branding/NodentWordmark";
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
  { label: "Track My Study", icon: Clock, path: "/track" },
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
      className="border-r-0 overflow-hidden"
      style={
        {
          "--sidebar-background": "#000000",
          "--sidebar-foreground": "#ffffff",
          "--sidebar-accent": "rgba(255, 255, 255, 0.08)",
          "--sidebar-accent-foreground": "rgba(255, 255, 255, 0.95)",
          "--sidebar-border": "rgba(255, 255, 255, 0.08)",
          "--sidebar-primary": "#56abe6",
          "--sidebar-primary-foreground": "#ffffff",
          "--sidebar-ring": "#56abe6",
        } as React.CSSProperties
      }
    >
      {/* Logo */}
      <SidebarHeader className="px-4 pt-5 pb-0 group-data-[collapsible=icon]:px-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand">
              <img
                src="/logo.png"
                alt="Nodent logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <NodentWordmark
              size="sm"
              variant="onDark"
              className="-ml-0.5 pb-2.5"
            />
          </div>
        </div>
        {/* Collapsed: logo only */}
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
            <img
              src="/logo.png"
              alt="Nodent logo"
              className="h-7 w-7 object-contain"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 my-3 bg-white/6" />

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
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
                          ? "relative bg-white/10 text-white hover:bg-white/15"
                          : "relative text-white/60 hover:text-white/90 hover:bg-white/5"
                      }
                    >
                      <item.icon
                        className={
                          isActive ? "text-white" : "text-white/40"
                        }
                      />
                      <span className="font-medium group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.35)] group-data-[collapsible=icon]:hidden" />
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
            <div className="flex flex-col gap-3 px-2 pb-3 pt-2 group-data-[collapsible=icon]:px-1">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1">
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
              </div>

              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 group-data-[collapsible=icon]:px-2"
              >
                <LogOut className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">Log out</span>
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}
