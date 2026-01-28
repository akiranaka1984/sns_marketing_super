import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  Sparkles,
  FileText,
  Settings,
  FolderKanban,
  Network,
  Zap,
  AlertTriangle,
  Heart,
  Smartphone,
  BarChart3,
  Bot,
  Download,
  Wand2,
  CheckSquare,
  TrendingUp,
  ChevronDown,
  FolderOpen,
  UserCircle,
  CalendarClock,
  Shield,
  MoreHorizontal,
  FlaskConical,
  Gauge,
  ChevronRight,
  Brain,
  GraduationCap
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/contexts/I18nContext';

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,10,15,0.8)_100%)]" />

        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#3db9cf]/15 rounded-full blur-3xl float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8b5cf6]/15 rounded-full blur-3xl float animation-delay-300" />

        <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="glass-card rounded-2xl p-8 w-full text-center">
            {/* Logo */}
            <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3db9cf] to-[#8b5cf6] glow-cyan">
              <Gauge className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl font-bold mb-2">
              <span className="gradient-text">SNS Marketing</span>
            </h1>
            <p className="text-muted-foreground mb-8">
              Sign in to access the automation dashboard
            </p>

            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full bg-gradient-to-r from-[#3db9cf] to-[#8b5cf6] hover:from-[#4bc5db] hover:to-[#9d6ff8] text-white border-0 shadow-lg shadow-[#3db9cf]/20 transition-all duration-300 hover:shadow-[#3db9cf]/30 hover:scale-[1.01]"
            >
              Sign in
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

type MenuGroup = {
  label: string;
  icon: typeof FolderOpen;
  defaultOpen?: boolean;
  items: {
    icon: typeof LayoutDashboard;
    label: string;
    path: string;
  }[];
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const menuGroups: MenuGroup[] = [
    {
      label: "アカウント管理",
      icon: UserCircle,
      defaultOpen: true,
      items: [
        { icon: Users, label: t('nav.accounts'), path: "/accounts" },
        { icon: Network, label: t('nav.proxies'), path: "/proxies" },
      ],
    },
    {
      label: "投稿・自動化",
      icon: CalendarClock,
      defaultOpen: true,
      items: [
        { icon: FolderKanban, label: t('nav.projects'), path: "/projects" },
        { icon: Zap, label: "自動化", path: "/automation" },
        { icon: CheckSquare, label: "投稿レビュー", path: "/post-review" },
      ],
    },
    {
      label: "分析・最適化",
      icon: TrendingUp,
      defaultOpen: true,
      items: [
        { icon: BarChart3, label: "パフォーマンス分析", path: "/analytics" },
        { icon: TrendingUp, label: "週次レビュー", path: "/weekly-review" },
        { icon: Sparkles, label: "AI最適化", path: "/ai-optimization" },
        { icon: Bot, label: "SNSエージェント", path: "/agents" },
        { icon: FlaskConical, label: "A/Bテスト", path: "/ab-testing" },
        { icon: GraduationCap, label: "モデルアカウント", path: "/model-accounts" },
        { icon: Brain, label: "バズ分析", path: "/buzz-analysis" },
      ],
    },
    {
      label: "監視",
      icon: Shield,
      defaultOpen: false,
      items: [
        { icon: AlertTriangle, label: "凍結検知", path: "/freeze-detection" },
        { icon: Heart, label: "エンゲージメント", path: "/engagement" },
        { icon: Smartphone, label: "デバイス", path: "/devices" },
        { icon: Shield, label: "デバイス監視", path: "/device-monitor" },
        { icon: Download, label: "ADBKeyboard", path: "/adbkeyboard" },
      ],
    },
    {
      label: "その他",
      icon: MoreHorizontal,
      defaultOpen: false,
      items: [
        { icon: Sparkles, label: t('nav.strategies'), path: "/strategies" },
        { icon: FileText, label: t('nav.logs'), path: "/logs" },
        { icon: Settings, label: "X API設定", path: "/x-api-settings" },
        { icon: Settings, label: t('nav.settings'), path: "/settings" },
      ],
    },
  ];

  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-open-groups');
    if (saved) {
      return JSON.parse(saved);
    }
    const defaults: Record<string, boolean> = {};
    menuGroups.forEach(group => {
      defaults[group.label] = group.defaultOpen ?? false;
    });
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-open-groups', JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <Sidebar ref={sidebarRef} collapsible="icon" className="border-r-0">
        {/* Glass sidebar background */}
        <div className="absolute inset-0 glass-card rounded-none border-0 border-r border-white/[0.06]" />

        <SidebarHeader className="relative border-b border-white/[0.06] z-10">
          <div className="flex items-center gap-3 px-2 py-3">
            {/* Animated logo */}
            <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3db9cf] to-[#8b5cf6] shadow-lg shadow-[#3db9cf]/15 transition-transform duration-300 hover:scale-105">
              <Gauge className="size-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-bold text-base gradient-text">
                  SNS Marketing
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Automation Platform
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="relative z-10">
          {/* Dashboard link with special styling */}
          <SidebarGroup className="pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/")}
                  isActive={location === "/"}
                  tooltip={t('nav.dashboard')}
                  className={`relative transition-all duration-200 ${
                    location === "/"
                      ? "bg-gradient-to-r from-[#3db9cf]/15 to-[#8b5cf6]/08 text-[#3db9cf] border border-[#3db9cf]/15"
                      : "hover:bg-white/5"
                  }`}
                >
                  <LayoutDashboard className={location === "/" ? "text-[#3db9cf]" : ""} />
                  <span className="font-medium">{t('nav.dashboard')}</span>
                  {location === "/" && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-gradient-to-b from-[#3db9cf] to-[#8b5cf6] rounded-r-full" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          {menuGroups.map((group) => (
            <Collapsible
              key={group.label}
              open={openGroups[group.label]}
              onOpenChange={() => toggleGroup(group.label)}
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-white/5 rounded-lg transition-colors px-2 py-1.5 mx-2 group">
                    <group.icon className="mr-2 size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform duration-200 ${
                        openGroups[group.label] ? "rotate-180" : ""
                      }`}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item, itemIndex) => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem
                            key={item.path}
                            className="fade-in-up"
                            style={{ animationDelay: `${itemIndex * 50}ms` }}
                          >
                            <SidebarMenuButton
                              onClick={() => setLocation(item.path)}
                              isActive={isActive}
                              tooltip={item.label}
                              className={`relative transition-all duration-200 ${
                                isActive
                                  ? "bg-white/8 text-foreground"
                                  : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <item.icon className={`size-4 ${isActive ? "text-[#3db9cf]" : ""}`} />
                              <span>{item.label}</span>
                              {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-gradient-to-b from-[#3db9cf] to-[#8b5cf6] rounded-r-full" />
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}
        </SidebarContent>

        <SidebarFooter className="relative border-t border-white/[0.06] z-10">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-white/10 hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar with gradient ring */}
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#3db9cf] to-[#8b5cf6] rounded-lg opacity-60" />
                      <Avatar className="h-8 w-8 rounded-lg relative">
                        <AvatarFallback className="rounded-lg bg-background text-foreground font-semibold">
                          {user?.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl glass-card border-white/10"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <div className="px-2 py-2 border-b border-white/10">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('nav.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-2 pb-2">
            <LanguageSwitcher />
          </div>
        </SidebarFooter>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#3db9cf]/40 transition-colors z-20"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </Sidebar>

      <SidebarInset className="bg-[#f8f9fb] content-light">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-4 bg-white border-b border-gray-200/80 sticky top-0 z-40">
          <SidebarTrigger className="-ml-1 hover:bg-gray-100 transition-colors rounded-lg p-2 text-gray-600">
            <Menu className="size-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </SidebarTrigger>

          {/* Breadcrumb area - can be expanded */}
          <div className="flex-1" />

          {/* Optional: Add header actions here */}
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-live" />
              <span className="text-xs font-medium text-emerald-600">System Online</span>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 flex-col gap-4 p-6">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
