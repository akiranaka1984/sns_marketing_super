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
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { useTheme } from "../contexts/ThemeContext";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

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
      <div className="flex items-center justify-center min-h-screen bg-[#FFFDF7] dark:bg-[#1A1A2E]">
        <div className="text-center max-w-sm w-full px-4">
          <div className="mb-5 inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#FFD700] border-3 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
            <span className="text-[#1A1A1A] font-bold text-xl">S</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#1A1A1A] dark:text-[#FFFDF7] mb-1 tracking-tight">SNS Marketing</h1>
          <p className="text-[14px] text-[#6B6B6B] dark:text-[#A0A0B0] mb-6 font-medium">Automation Platform</p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full bg-[#FFD700] hover:bg-[#FFED4A] text-[#1A1A1A] h-12 text-[14px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
          >
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return <NeoLayout>{children}</NeoLayout>;
}

type NavItem = {
  label: string;
  path: string;
  emoji: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

function NeoLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    private: true,
    management: true,
    automation: false,
    analytics: false,
    monitoring: false,
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  const privatePages: NavItem[] = [
    { emoji: "🏠", label: "ホーム", path: "/" },
    { emoji: "📥", label: "受信トレイ", path: "/inbox" },
  ];

  const sections: NavSection[] = [
    {
      title: "管理",
      defaultOpen: true,
      items: [
        { emoji: "👥", label: "アカウント", path: "/accounts" },
        { emoji: "📁", label: "プラン検討", path: "/projects" },
        { emoji: "🤖", label: "エージェント", path: "/agents" },
        { emoji: "🤝", label: "チーム管理", path: "/team" },
      ],
    },
    {
      title: "自動化",
      items: [
        { emoji: "⚡", label: "自動化設定", path: "/automation" },
        { emoji: "✅", label: "投稿レビュー", path: "/post-review" },
        { emoji: "📅", label: "スケジュール", path: "/scheduled-posts" },
        { emoji: "🗓️", label: "カレンダー", path: "/content-calendar" },
      ],
    },
    {
      title: "分析",
      items: [
        { emoji: "📊", label: "分析", path: "/analytics" },
        { emoji: "📈", label: "週次レビュー", path: "/weekly-review" },
        { emoji: "✨", label: "AI最適化", path: "/ai-optimization" },
        { emoji: "🧪", label: "A/Bテスト", path: "/ab-testing" },
        { emoji: "🎓", label: "モデル", path: "/model-accounts" },
        { emoji: "🔥", label: "バズ分析", path: "/buzz-analysis" },
        { emoji: "🧠", label: "学習インサイト", path: "/learning-insights" },
        { emoji: "#️⃣", label: "ハッシュタグ", path: "/hashtag-analytics" },
        { emoji: "🏆", label: "競合比較", path: "/competitor-benchmark" },
      ],
    },
    {
      title: "監視",
      items: [
        { emoji: "⚠️", label: "凍結検知", path: "/freeze-detection" },
        { emoji: "💬", label: "エンゲージメント", path: "/engagement" },
      ],
    },
  ];

  const bottomItems: NavItem[] = [
    { emoji: "💡", label: "戦略", path: "/strategies" },
    { emoji: "📝", label: "ログ", path: "/logs" },
    { emoji: "⚙️", label: "設定", path: "/settings" },
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
    return (
      <button
        onClick={() => handleNavigate(item.path)}
        aria-current={active ? 'page' : undefined}
        className={`
          group w-full flex items-center gap-2.5 px-2.5 py-[8px] rounded-lg text-[13px] font-medium transition-all duration-100
          ${active
            ? "bg-[#FFD700] dark:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]"
            : "text-[#1A1A1A] dark:text-[#FFFDF7] hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] border-2 border-transparent hover:border-[#1A1A1A] dark:hover:border-[#FFFDF7]"
          }
        `}
      >
        <span className="w-[24px] h-[24px] flex items-center justify-center text-[15px] flex-shrink-0">
          {item.emoji}
        </span>
        {!(isCollapsed && !isMobile) && (
          <>
            <span className="flex-1 text-left truncate">
              {item.label}
            </span>
          </>
        )}
      </button>
    );
  };

  const SectionGroup = ({ section }: { section: NavSection }) => {
    const isExpanded = expandedSections[section.title.toLowerCase()] ?? section.defaultOpen ?? false;

    return (
      <div className="mt-4">
        <button
          onClick={() => toggleSection(section.title)}
          aria-expanded={isExpanded}
          className="w-full flex items-center gap-1.5 px-2.5 py-[4px] text-[11px] font-bold text-[#6B6B6B] dark:text-[#A0A0B0] hover:text-[#1A1A1A] dark:hover:text-[#FFFDF7] transition-colors group uppercase tracking-wider"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
          {!(isCollapsed && !isMobile) && (
            <span>{section.title}</span>
          )}
          {!(isCollapsed && !isMobile) && (
            <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-[3px]">
            {section.items.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Workspace Switcher */}
      <div className={`flex items-center h-[60px] ${(isCollapsed && !isMobile) ? 'justify-center px-2' : 'px-4'} border-b-2 border-[#1A1A1A] dark:border-[#FFFDF7]`}>
        {!(isCollapsed && !isMobile) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] rounded-lg px-2 py-1.5 transition-all duration-100 flex-1 min-w-0 group">
                <div className="w-8 h-8 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0_#1A1A1A]">
                  <span className="text-[#1A1A1A] text-[13px] font-bold">
                    {user?.name?.charAt(0).toUpperCase() || "S"}
                  </span>
                </div>
                <span className="text-[14px] font-bold text-[#1A1A1A] dark:text-[#FFFDF7] truncate">
                  {user?.name || "Workspace"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] flex-shrink-0 group-hover:text-[#1A1A1A] transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px] p-1.5 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg">
              <div className="px-2 py-2">
                <p className="text-[13px] font-bold text-[#1A1A1A] dark:text-[#FFFDF7]">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-[#1A1A1A] dark:bg-[#FFFDF7]" />
              <DropdownMenuItem onClick={() => logout()} className="text-[#FF6B6B] focus:text-[#FF6B6B] text-[13px] rounded-md font-bold">
                <LogOut className="w-4 h-4 mr-2" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] rounded-lg transition-all duration-100 flex-shrink-0"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5 text-[#1A1A1A] dark:text-[#FFFDF7]" />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] rounded-lg transition-all duration-100 flex-shrink-0"
            aria-label={isCollapsed ? "展開" : "折りたたむ"}
          >
            <ChevronsLeft className={`w-4 h-4 text-[#6B6B6B] hover:text-[#1A1A1A] transition-all duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Search */}
      {!(isCollapsed && !isMobile) && (
        <div className="px-3 py-3">
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] bg-white dark:bg-[#0F3460] rounded-lg transition-all duration-100 border-2 border-[#1A1A1A] dark:border-[#FFFDF7] shadow-[2px_2px_0_#1A1A1A] dark:shadow-[2px_2px_0_#FFFDF7] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] font-medium"
            aria-label="検索を開く (Cmd+K)"
          >
            <Search className="w-4 h-4" />
            <span>検索</span>
            <span className="ml-auto text-[11px] text-[#1A1A1A] dark:text-[#FFFDF7] bg-[#FFD700] px-1.5 py-0.5 rounded font-bold border border-[#1A1A1A]">⌘K</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="メインナビゲーション">
        <div className="space-y-[3px]">
          {privatePages.map((item) => (
            <NavItemRow key={item.path} item={item} />
          ))}
        </div>

        {sections.map((section) => (
          <SectionGroup key={section.title} section={section} />
        ))}

        <div className="my-4 border-t-2 border-[#1A1A1A] dark:border-[#FFFDF7]" />

        <div className="space-y-[3px]">
          {bottomItems.map((item) => (
            <NavItemRow key={item.path} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!(isCollapsed && !isMobile) && (
        <div className="px-3 py-3 border-t-2 border-[#1A1A1A] dark:border-[#FFFDF7] space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-2.5 py-[8px] rounded-lg text-[13px] font-medium text-[#1A1A1A] dark:text-[#FFFDF7] hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] border-2 border-transparent hover:border-[#1A1A1A] dark:hover:border-[#FFFDF7] transition-all duration-100"
            aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            <span>{theme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
          </button>
          <LanguageSwitcher />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-[#FFFDF7] dark:bg-[#1A1A2E] overflow-hidden">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile
            ? `fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${isCollapsed ? 'w-[52px]' : 'w-[260px]'} flex-shrink-0 transition-all duration-200 ease-out`
          }
          bg-[#FFFDF7] dark:bg-[#1A1A2E] flex flex-col
          border-r-2 border-[#1A1A1A] dark:border-[#FFFDF7]
        `}
        aria-label="サイドバー"
      >
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[56px] flex items-center justify-between px-5 border-b-2 border-[#1A1A1A] dark:border-[#FFFDF7] flex-shrink-0 bg-[#FFFDF7] dark:bg-[#1A1A2E]">
          <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="p-1.5 -ml-1.5 hover:bg-[#FFF8DC] dark:hover:bg-[#0F3460] rounded-lg transition-colors"
                aria-label="メニューを開く"
              >
                <Menu className="w-5 h-5 text-[#1A1A1A] dark:text-[#FFFDF7]" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-[13px] text-[#1A1A1A] dark:text-[#FFFDF7] hover:bg-[#FFD700] font-bold rounded-lg border-2 border-[#1A1A1A] dark:border-[#FFFDF7] transition-all duration-100"
            >
              共有
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-[#1A1A1A] dark:text-[#FFFDF7] hover:bg-[#FFD700] rounded-lg border-2 border-[#1A1A1A] dark:border-[#FFFDF7] transition-all duration-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-[#FFFDF7] dark:bg-[#1A1A2E]">
          <div className="px-4 sm:px-8 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
