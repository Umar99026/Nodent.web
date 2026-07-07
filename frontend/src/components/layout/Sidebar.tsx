import { NodentWordmark } from "@/components/branding/NodentWordmark";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Clock,
  Settings,
  LogOut,
  UserRound,
  Camera,
  Shield,
  GraduationCap,
  Users,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  canAccessTeacherNav,
  canAccessTrackNav,
  isAdminUser,
} from "@/lib/constants";
import { fetchClassMembership } from "@/lib/teacherClass";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  teacherOnly?: boolean;
  studentOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Report", icon: BarChart3, path: "/report" },
  { label: "Track My Study", icon: Clock, path: "/track", studentOnly: true },
  { label: "Teacher", icon: GraduationCap, path: "/teacher", teacherOnly: true },
  { label: "Admin", icon: Shield, path: "/admin", adminOnly: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateAccount, setProfilePhoto } = useAuth();
  void location;
  const [accountOpen, setAccountOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [classMembership, setClassMembership] = useState<{
    enrolled: boolean;
    className?: string;
    teacherName?: string;
  }>({ enrolled: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleNav = (path: string) => {
    navigate(path);
  };

  useEffect(() => {
    setUsername(user?.username ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setPhotoPreview(user?.profilePhoto ?? null);
  }, [user, accountOpen]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchClassMembership()
      .then((data) => {
        if (!cancelled) setClassMembership(data);
      })
      .catch(() => {
        if (!cancelled) setClassMembership({ enrolled: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, accountOpen]);

  const openJoinClass = () => {
    navigate("/join-class");
  };

  const handlePhotoSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAccount = async () => {
    const trimmedUsername = username.trim();
    const usernameChanged = trimmedUsername !== (user?.username ?? "");
    const passwordChanged = currentPassword.trim().length > 0 || newPassword.trim().length > 0;
    const photoChanged = (photoPreview ?? null) !== (user?.profilePhoto ?? null);

    if (!usernameChanged && !passwordChanged && !photoChanged) {
      setAccountOpen(false);
      return;
    }

    try {
      setIsSaving(true);

      if (usernameChanged || passwordChanged) {
        await updateAccount({
          ...(usernameChanged ? { username: trimmedUsername } : {}),
          ...(passwordChanged
            ? {
                currentPassword,
                newPassword,
              }
            : {}),
        });
      }

      if (photoChanged) {
        await setProfilePhoto(photoPreview ?? null);
      }

      toast.success("Account updated.");
      setCurrentPassword("");
      setNewPassword("");
      setAccountOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update account.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="safe-top sticky top-0 z-40 border-b border-white/10 bg-black/95 text-white backdrop-blur-sm">
        <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => handleNav("/dashboard")}
          className="mr-auto flex min-w-0 items-center gap-3 rounded-full pr-2 transition-opacity hover:opacity-90"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
            <img
              src="/logo.png"
              alt="Nodent logo"
              className="h-6 w-6 object-contain"
            />
          </div>
          <NodentWordmark size="sm" variant="onDark" className="-ml-0.5 pb-1.5" />
        </button>

        <div className="order-3 flex w-full justify-center sm:order-2 sm:flex-1">
          <div className="flex w-full max-w-xl items-center gap-1 overflow-x-auto rounded-full border border-white/12 bg-white/6 p-1">
            {navItems.map((item) => {
              if (item.adminOnly && !isAdminUser(user)) {
                return null;
              }
              if (item.teacherOnly && !canAccessTeacherNav(user)) {
                return null;
              }
              if (item.studentOnly && !canAccessTrackNav(user)) {
                return null;
              }

              const isActive = location.pathname.startsWith(item.path);

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={[
                    "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm",
                    isActive
                      ? "bg-brand-light/50 text-[#0b0f19]"
                      : "text-white/70 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="order-2 flex items-center sm:order-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="touch-target inline-flex items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition-colors hover:bg-white/12"
              aria-label="Open settings"
            >
              <Settings className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border border-black/10 bg-white p-1.5 text-black"
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={user?.profilePhoto ?? undefined} alt={user?.username ?? "User"} />
                  <AvatarFallback className="bg-brand/15 text-xs font-bold text-brand-light">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-black">
                    {user?.username ?? "Guest"}
                  </div>
                  <div className="truncate text-xs text-black/55">
                    {user?.email ?? ""}
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={openJoinClass}
                className="cursor-pointer rounded-lg px-3 py-2"
              >
                <Users className="size-4" />
                <span>
                  {classMembership.enrolled
                    ? `My class · ${classMembership.className ?? "Class"}`
                    : "Join a class"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/premium")}
                className="cursor-pointer rounded-lg px-3 py-2"
              >
                <Sparkles className="size-4" />
                <span>Plan & limits</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAccountOpen(true)}
                className="cursor-pointer rounded-lg px-3 py-2"
              >
                <UserRound className="size-4" />
                <span>Account</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                variant="destructive"
                className="cursor-pointer rounded-lg px-3 py-2"
              >
                <LogOut className="size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      </div>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-lg border border-black/10 bg-white p-0 text-black">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-display text-xl font-semibold text-[#0b0f19]">
              Account settings
            </DialogTitle>
            <DialogDescription>
              Update your username, password, and profile photo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6">
            <div className="flex items-center gap-4 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
              <Avatar className="size-16 shrink-0">
                <AvatarImage src={photoPreview ?? undefined} alt={user?.username ?? "User"} />
                <AvatarFallback className="bg-brand/15 text-base font-bold text-brand-light">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0b0f19]">Profile photo</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[#0b0f19] transition-colors hover:bg-black/5"
                  >
                    <Camera className="size-4" />
                    <span>Upload photo</span>
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="rounded-full border border-black/10 px-3 py-2 text-sm font-medium text-black/65 transition-colors hover:bg-black/5 hover:text-black"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0b0f19]">Username</label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your username"
                className="h-11 border-black/10"
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
              <div>
                <p className="text-sm font-semibold text-[#0b0f19]">Class</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {classMembership.enrolled
                    ? `You're in ${classMembership.className ?? "a class"}${classMembership.teacherName ? ` with ${classMembership.teacherName}` : ""}.`
                    : "Join your teacher's class with their code so they can see your stats."}
                </p>
              </div>
              <Button
                type="button"
                variant={classMembership.enrolled ? "outline" : "default"}
                className={
                  classMembership.enrolled
                    ? "w-full border-black/10"
                    : "w-full bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                }
                onClick={() => {
                  setAccountOpen(false);
                  openJoinClass();
                }}
              >
                {classMembership.enrolled ? "View class" : "Join a class"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0b0f19]">
                  Current password
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Required to change password"
                  className="h-11 border-black/10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0b0f19]">New password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 4 characters"
                  className="h-11 border-black/10"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-black/10 bg-[#fafafa]">
            <Button
              variant="outline"
              onClick={() => setAccountOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveAccount()}
              className="bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
