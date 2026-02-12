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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EEF2FF]">
        <div className="text-center max-w-sm w-full px-4">
          <div className="mb-5 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#5C5CFF] to-[#7C3AED] shadow-lg">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <h1 className="text-[18px] font-bold text-[#1A1D21] mb-1 tracking-tight">SNS Marketing</h1>
          <p className="text-[13px] text-[#6B7280] mb-6">Automation Platform</p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full bg-gradient-to-r from-[#5C5CFF] to-[#4747CC] hover:from-[#4747CC] hover:to-[#3737A8] text-white h-10 text-[13px] font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return <NotionLayout>{children}</NotionLayout>;
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

function NotionLayout({ children }: { children: React.ReactNode }) {
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
    { emoji: "🏠", label: "ホーム", path: "/" },
    { emoji: "📥", label: "受信トレイ", path: "/inbox" },
  ];

  const sections: NavSection[] = [
    {
      title: "管理",
      defaultOpen: true,
      items: [
        { emoji: "👥", label: "アカウント", path: "/accounts" },
        { emoji: "📁", label: "プロジェクト", path: "/projects" },
        { emoji: "🤖", label: "エージェント", path: "/agents" },
      ],
    },
    {
      title: "自動化",
      items: [
        { emoji: "⚡", label: "自動化設定", path: "/automation" },
        { emoji: "✅", label: "投稿レビュー", path: "/post-review" },
        { emoji: "📅", label: "スケジュール", path: "/scheduled-posts" },
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
        { emoji: "🚀", label: "グロース", path: "/growth" },
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
        className={`
          group w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150
          ${active
            ? "bg-white text-[#1A1D21] shadow-sm font-medium"
            : "text-[#64748B] hover:bg-white/60 hover:text-[#1A1D21]"
          }
        `}
      >
        <span className={`w-[24px] h-[24px] flex items-center justify-center text-[15px] flex-shrink-0 rounded-md transition-colors ${active ? 'bg-[#EEF2FF]' : 'group-hover:bg-[#F1F5F9]'}`}>
          {item.emoji}
        </span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate">
              {item.label}
            </span>
            <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
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
          className="w-full flex items-center gap-1.5 px-2.5 py-[4px] text-[11px] font-semibold text-[#94A3B8] hover:text-[#64748B] transition-colors group uppercase tracking-wider"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
          {!isCollapsed && (
            <span>{section.title}</span>
          )}
          {!isCollapsed && (
            <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-[2px]">
            {section.items.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#FAFBFC] overflow-hidden">
      {/* Refined Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-[52px]' : 'w-[260px]'}
          flex-shrink-0 bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] flex flex-col transition-all duration-200 ease-out
          border-r border-[#E2E8F0]
        `}
      >
        {/* Workspace Switcher */}
        <div className={`flex items-center h-[56px] ${isCollapsed ? 'justify-center px-2' : 'px-4'} border-b border-[#E2E8F0]/60`}>
          {!isCollapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 hover:bg-white/80 rounded-lg px-2 py-1.5 transition-all duration-150 flex-1 min-w-0 group">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5C5CFF] to-[#7C3AED] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-[12px] font-bold">
                      {user?.name?.charAt(0).toUpperCase() || "S"}
                    </span>
                  </div>
                  <span className="text-[14px] font-semibold text-[#1E293B] truncate">
                    {user?.name || "Workspace"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 group-hover:text-[#64748B] transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px] p-1.5 shadow-lg border-[#E2E8F0]">
                <div className="px-2 py-2">
                  <p className="text-[13px] font-medium text-[#1E293B]">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-[#E2E8F0]" />
                <DropdownMenuItem onClick={() => logout()} className="text-[#EF4444] focus:text-[#EF4444] text-[13px] rounded-md">
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-white/80 rounded-lg transition-all duration-150 flex-shrink-0"
            title={isCollapsed ? "展開" : "折りたたむ"}
          >
            <ChevronsLeft className={`w-4 h-4 text-[#94A3B8] hover:text-[#64748B] transition-all duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search (collapsed: icon only) */}
        {!isCollapsed && (
          <div className="px-3 py-3">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#94A3B8] hover:text-[#64748B] bg-white/60 hover:bg-white rounded-lg transition-all duration-150 border border-[#E2E8F0]/60 hover:border-[#E2E8F0] shadow-sm hover:shadow">
              <Search className="w-4 h-4" />
              <span>検索</span>
              <span className="ml-auto text-[11px] text-[#CBD5E1] bg-[#F1F5F9] px-1.5 py-0.5 rounded font-medium">⌘K</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Private Pages */}
          <div className="space-y-[2px]">
            {privatePages.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>

          {/* Sections */}
          {sections.map((section) => (
            <SectionGroup key={section.title} section={section} />
          ))}

          {/* Divider */}
          <div className="my-4 border-t border-[#E2E8F0]" />

          {/* Bottom Items */}
          <div className="space-y-[2px]">
            {bottomItems.map((item) => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        </nav>

        {/* Language Switcher */}
        {!isCollapsed && (
          <div className="px-3 py-3 border-t border-[#E2E8F0]/60">
            <LanguageSwitcher />
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Refined Header */}
        <header className="h-[52px] flex items-center justify-between px-5 border-b border-[#E5E7EB] flex-shrink-0 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[13px] text-[#94A3B8]">
            {/* Breadcrumb placeholder */}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[13px] text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] font-medium rounded-lg transition-all duration-150"
            >
              共有
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] rounded-lg transition-all duration-150"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
          <div className="px-8 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
