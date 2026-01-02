import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { LayoutDashboard, LogOut, PanelLeft, Users, Sparkles, FileText, Settings, FolderKanban, Network, Zap, Calendar, AlertTriangle, Heart, Smartphone, BarChart3, Bot, Download, Wand2, CheckSquare, TrendingUp, Sparkles as SparklesIcon, ChevronDown, FolderOpen, UserCircle, CalendarClock, TrendingUpIcon, Shield, MoreHorizontal, FlaskConical } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/contexts/I18nContext';

// Menu items will be translated dynamically

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
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
      label: "コンテンツ管理",
      icon: FolderOpen,
      defaultOpen: true,
      items: [
        { icon: Download, label: "コンテンツ収集", path: "/content-collection" },
        { icon: Wand2, label: "AIリライト", path: "/content-rewrite" },
        { icon: CheckSquare, label: "コンテンツ審査", path: "/content-review" },
      ],
    },
    {
      label: "アカウント管理",
      icon: UserCircle,
      defaultOpen: true,
      items: [
        { icon: Users, label: t('nav.accounts'), path: "/accounts" },
        { icon: Bot, label: "SNSエージェント", path: "/agents" },
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
        { icon: Calendar, label: "スケジュール投稿", path: "/scheduled-posts" },
        { icon: CheckSquare, label: "投稿レビュー", path: "/post-review" },
      ],
    },
    {
      label: "分析・最適化",
      icon: TrendingUpIcon,
      defaultOpen: true,
      items: [
        { icon: BarChart3, label: "パフォーマンス分析", path: "/analytics" },
        { icon: TrendingUp, label: "週次レビュー", path: "/weekly-review" },
        { icon: SparklesIcon, label: "AI最適化", path: "/ai-optimization" },
        { icon: FlaskConical, label: "A/Bテスト", path: "/ab-testing" },
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-open-groups');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: open groups based on defaultOpen
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
      <Sidebar ref={sidebarRef} collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <LayoutDashboard className="size-4" />
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SNS Marketing</span>
                <span className="truncate text-xs text-muted-foreground">
                  Automation System
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/")}
                  isActive={location === "/"}
                  tooltip={t('nav.dashboard')}
                >
                  <LayoutDashboard />
                  <span>{t('nav.dashboard')}</span>
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
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <group.icon className="mr-2 size-4" />
                    <span className="flex-1">{group.label}</span>
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        openGroups[group.label] ? "rotate-180" : ""
                      }`}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            onClick={() => setLocation(item.path)}
                            isActive={location === item.path}
                            tooltip={item.label}
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem onClick={() => logout()}>
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

        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1">
            <PanelLeft />
            <span className="sr-only">Toggle Sidebar</span>
          </SidebarTrigger>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
