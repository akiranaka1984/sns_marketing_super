import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import {
  LogOut,
  ChevronDown,
  ChevronsLeft,
  Plus,
  Search,
  Settings,
  MoreHorizontal,
  LayoutDashboard,
  Inbox,
  Users,
  FolderKanban,
  Bot,
  Zap,
  CheckSquare,
  CalendarClock,
  BarChart3,
  TrendingUp,
  Sparkles,
  FlaskConical,
  GraduationCap,
  Flame,
  BrainCircuit,
  Hash,
  Trophy,
  Rocket,
  ShieldAlert,
  MessageCircle,
  Lightbulb,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { LanguageSwitcher } from './LanguageSwitcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-sm w-full px-4">
          <div className="mb-5 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#0F172A]">
            <span className="text-white font-bold text-sm">SA</span>
          </div>
          <h1 className="text-[18px] font-bold text-foreground mb-1 tracking-tight">SNS Autosystem</h1>
          <p className="text-[13px] text-muted-foreground mb-6">Marketing Automation</p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white h-10 text-[13px] font-medium rounded-lg transition-colors"
          >
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    private: true,
    management: true,
    automation: false,
    analytics: false,
    monitoring: false,
  });

  const privatePages: NavItem[] = [
    { icon: LayoutDashboard, label: "ホーム", path: "/" },
    { icon: Inbox, label: "受信トレイ", path: "/inbox" },
  ];

  const sections: NavSection[] = [
    {
      title: "管理",
      defaultOpen: true,
      items: [
        { icon: Users, label: "アカウント", path: "/accounts" },
        { icon: FolderKanban, label: "プロジェクト", path: "/projects" },
        { icon: Bot, label: "エージェント", path: "/agents" },
      ],
    },
    {
      title: "自動化",
      items: [
        { icon: Zap, label: "自動化設定", path: "/automation" },
        { icon: CheckSquare, label: "投稿レビュー", path: "/post-review" },
        { icon: CalendarClock, label: "スケジュール", path: "/scheduled-posts" },
      ],
    },
    {
      title: "分析",
      items: [
        { icon: BarChart3, label: "分析", path: "/analytics" },
        { icon: TrendingUp, label: "週次レビュー", path: "/weekly-review" },
        { icon: Sparkles, label: "AI最適化", path: "/ai-optimization" },
        { icon: FlaskConical, label: "A/Bテスト", path: "/ab-testing" },
        { icon: GraduationCap, label: "モデル", path: "/model-accounts" },
        { icon: Flame, label: "バズ分析", path: "/buzz-analysis" },
        { icon: BrainCircuit, label: "学習インサイト", path: "/learning-insights" },
        { icon: Hash, label: "ハッシュタグ", path: "/hashtag-analytics" },
        { icon: Trophy, label: "競合比較", path: "/competitor-benchmark" },
        { icon: Rocket, label: "グロース", path: "/growth" },
      ],
    },
    {
      title: "監視",
      items: [
        { icon: ShieldAlert, label: "凍結検知", path: "/freeze-detection" },
        { icon: MessageCircle, label: "エンゲージメント", path: "/engagement" },
      ],
    },
  ];

  const bottomItems: NavItem[] = [
    { icon: Lightbulb, label: "戦略", path: "/strategies" },
    { icon: ScrollText, label: "ログ", path: "/logs" },
    { icon: Settings, label: "設定", path: "/settings" },
  ];

  const handleNavigate = useCallback((path: string) => {
    setLocation(path);
  }, [setLocation]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/dashboard";
    return location === path || location.startsWith(path + "/");
  };

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title.toLowerCase()]: !prev[title.toLowerCase()] }));
  };

  const NavItemRow = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <button
        onClick={() => handleNavigate(item.path)}
        className={`
          group w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all duration-150
          ${active
            ? "nav-item-active text-indigo-200"
            : "text-[#8B8FA3] hover:bg-white/[0.04] hover:text-[#C8CAD4]"
          }
        `}
      >
        <span className="w-[22px] h-[22px] flex items-center justify-center flex-shrink-0">
          <Icon className={`w-[16px] h-[16px] transition-colors duration-150 ${active ? 'text-indigo-400' : 'text-[#555872] group-hover:text-[#8B8FA3]'}`} strokeWidth={active ? 2 : 1.5} />
        </span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate tracking-[-0.01em]">
              {item.label}
            </span>
            <MoreHorizontal className="w-3.5 h-3.5 opacity-0 group-hover:opacity-30 flex-shrink-0 transition-opacity" />
          </>
        )}
      </button>
    );
  };

  const SectionGroup = ({ section }: { section: NavSection }) => {
    const isExpanded = expandedSections[section.title.toLowerCase()] ?? section.defaultOpen ?? false;

    return (
      <div className="mt-5">
        <button
          onClick={() => toggleSection(section.title)}
          className="w-full flex items-center gap-1.5 px-2.5 py-[3px] text-[10px] font-semibold text-[#454960] hover:text-[#6B70A0] transition-colors group uppercase tracking-[0.08em]"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
          {!isCollapsed && (
            <span>{section.title}</span>
          )}
          {!isCollapsed && (
            <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-[1px]">
            {section.items.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-[52px]' : 'w-[260px]'}
          flex-shrink-0 flex flex-col transition-all duration-200 ease-out
          border-r border-[#1E2035] bg-[#0C0D14]
        `}
      >
        {/* App Branding */}
        <div className={`flex items-center h-[56px] ${isCollapsed ? 'justify-center px-2' : 'px-4'} border-b border-[#1E2035]`}>
          {!isCollapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 hover:bg-white/[0.04] rounded-lg px-2 py-1.5 transition-all duration-150 flex-1 min-w-0 group">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                    <span className="text-white text-[10px] font-bold tracking-wide">SA</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-[#E0E2EE] truncate leading-tight tracking-[-0.02em]">
                      SNS Autosystem
                    </span>
                    <span className="text-[10px] text-[#555872] truncate leading-tight">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#454960] flex-shrink-0 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px] p-1.5">
                <div className="px-2 py-2">
                  <p className="text-[13px] font-medium text-foreground">{user?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive text-[13px] rounded-md">
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-white/[0.04] rounded-md transition-all duration-150 flex-shrink-0"
            title={isCollapsed ? "展開" : "折りたたむ"}
          >
            <ChevronsLeft className={`w-4 h-4 text-[#454960] hover:text-[#8B8FA3] transition-all duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="px-3 py-2.5">
            <button className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-[#555872] hover:text-[#8B8FA3] bg-[#12131C] hover:bg-[#161724] rounded-md transition-all duration-150 border border-[#1E2035]">
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
              <kbd className="ml-auto text-[10px] text-[#454960] bg-[#0C0D14] px-1.5 py-0.5 rounded border border-[#1E2035] font-mono">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-3">
          <div className="space-y-[1px]">
            {privatePages.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>

          {sections.map((section) => (
            <SectionGroup key={section.title} section={section} />
          ))}

          <div className="my-4 border-t border-[#1E2035]" />

          <div className="space-y-[1px]">
            {bottomItems.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        </nav>

        {/* Language Switcher */}
        {!isCollapsed && (
          <div className="px-3 py-3 border-t border-[#1E2035]">
            <LanguageSwitcher />
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="px-8 py-6 max-w-[1200px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
