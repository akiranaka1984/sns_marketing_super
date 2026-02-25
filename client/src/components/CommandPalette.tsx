import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "cmdk";
import {
  BarChart3,
  Bot,
  FileText,
  FolderKanban,
  Hash,
  Home,
  Layers,
  Search,
  Settings,
  TestTube2,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  Shield,
  MessageSquare,
  Flame,
  Brain,
  Trophy,
  Lightbulb,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type CommandItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
  keywords?: string[];
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Fetch data for search
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { enabled: open });
  const { data: projects } = trpc.projects.list.useQuery(undefined, { enabled: open });
  const { data: agents } = trpc.agents.list.useQuery(undefined, { enabled: open });

  // Register keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
      setOpen(false);
    },
    [setLocation]
  );

  const navigationItems: CommandItem[] = [
    { id: "home", label: "ホーム", icon: <Home className="w-4 h-4" />, action: () => navigate("/"), group: "ナビゲーション", keywords: ["home", "dashboard"] },
    { id: "accounts", label: "アカウント", icon: <Users className="w-4 h-4" />, action: () => navigate("/accounts"), group: "ナビゲーション", keywords: ["accounts"] },
    { id: "projects", label: "プロジェクト", icon: <FolderKanban className="w-4 h-4" />, action: () => navigate("/projects"), group: "ナビゲーション", keywords: ["projects"] },
    { id: "agents", label: "エージェント", icon: <Bot className="w-4 h-4" />, action: () => navigate("/agents"), group: "ナビゲーション", keywords: ["agents", "ai"] },
    { id: "automation", label: "自動化設定", icon: <Zap className="w-4 h-4" />, action: () => navigate("/automation"), group: "ナビゲーション", keywords: ["automation"] },
    { id: "scheduled-posts", label: "スケジュール投稿", icon: <Calendar className="w-4 h-4" />, action: () => navigate("/scheduled-posts"), group: "ナビゲーション", keywords: ["schedule", "posts"] },
    { id: "post-review", label: "投稿レビュー", icon: <Eye className="w-4 h-4" />, action: () => navigate("/post-review"), group: "ナビゲーション", keywords: ["review"] },
    { id: "analytics", label: "分析ダッシュボード", icon: <BarChart3 className="w-4 h-4" />, action: () => navigate("/analytics"), group: "分析", keywords: ["analytics", "dashboard"] },
    { id: "weekly-review", label: "週次レビュー", icon: <TrendingUp className="w-4 h-4" />, action: () => navigate("/weekly-review"), group: "分析", keywords: ["weekly", "review"] },
    { id: "ab-testing", label: "A/Bテスト", icon: <TestTube2 className="w-4 h-4" />, action: () => navigate("/ab-testing"), group: "分析", keywords: ["ab", "test"] },
    { id: "buzz-analysis", label: "バズ分析", icon: <Flame className="w-4 h-4" />, action: () => navigate("/buzz-analysis"), group: "分析", keywords: ["buzz", "viral"] },
    { id: "learning-insights", label: "学習インサイト", icon: <Brain className="w-4 h-4" />, action: () => navigate("/learning-insights"), group: "分析", keywords: ["learning", "insights"] },
    { id: "hashtag-analytics", label: "ハッシュタグ分析", icon: <Hash className="w-4 h-4" />, action: () => navigate("/hashtag-analytics"), group: "分析", keywords: ["hashtag"] },
    { id: "competitor-benchmark", label: "競合比較", icon: <Trophy className="w-4 h-4" />, action: () => navigate("/competitor-benchmark"), group: "分析", keywords: ["competitor", "benchmark"] },
    { id: "model-accounts", label: "モデルアカウント", icon: <Layers className="w-4 h-4" />, action: () => navigate("/model-accounts"), group: "分析", keywords: ["model"] },
    { id: "freeze-detection", label: "凍結検知", icon: <Shield className="w-4 h-4" />, action: () => navigate("/freeze-detection"), group: "監視", keywords: ["freeze", "detection"] },
    { id: "engagement", label: "エンゲージメント", icon: <MessageSquare className="w-4 h-4" />, action: () => navigate("/engagement"), group: "監視", keywords: ["engagement"] },
    { id: "strategies", label: "戦略", icon: <Lightbulb className="w-4 h-4" />, action: () => navigate("/strategies"), group: "その他", keywords: ["strategy"] },
    { id: "logs", label: "ログ", icon: <FileText className="w-4 h-4" />, action: () => navigate("/logs"), group: "その他", keywords: ["logs"] },
    { id: "settings", label: "設定", icon: <Settings className="w-4 h-4" />, action: () => navigate("/settings"), group: "その他", keywords: ["settings"] },
  ];

  const groups = [...new Set(navigationItems.map((item) => item.group))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="rounded-lg border-none bg-white dark:bg-[#1A1D24]" loop>
        <CommandInput
          placeholder="ページ、アカウント、プロジェクトを検索..."
          className="h-12 text-[14px]"
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty className="py-6 text-center text-[13px] text-[#94A3B8]">
            結果が見つかりませんでした
          </CommandEmpty>

          {/* Navigation */}
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {navigationItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                    onSelect={item.action}
                    className="flex items-center gap-3 px-3 py-2.5 text-[13px] cursor-pointer rounded-lg"
                  >
                    <span className="text-[#64748B] dark:text-[#9CA3AF]">{item.icon}</span>
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}

          {/* Dynamic: Accounts */}
          {accounts && accounts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="アカウント">
                {accounts.slice(0, 5).map((account: any) => (
                  <CommandItem
                    key={`account-${account.id}`}
                    value={`${account.username} ${account.platform} account`}
                    onSelect={() => navigate(`/accounts/${account.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 text-[13px] cursor-pointer rounded-lg"
                  >
                    <Users className="w-4 h-4 text-[#64748B] dark:text-[#9CA3AF]" />
                    <span className="flex-1">@{account.username}</span>
                    <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#1F2937] px-1.5 py-0.5 rounded">
                      {account.platform}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Dynamic: Projects */}
          {projects && projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="プロジェクト">
                {projects.slice(0, 5).map((project: any) => (
                  <CommandItem
                    key={`project-${project.id}`}
                    value={`${project.name} project`}
                    onSelect={() => navigate(`/projects/${project.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 text-[13px] cursor-pointer rounded-lg"
                  >
                    <FolderKanban className="w-4 h-4 text-[#64748B] dark:text-[#9CA3AF]" />
                    <span>{project.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Dynamic: Agents */}
          {agents && agents.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="エージェント">
                {agents.slice(0, 5).map((agent: any) => (
                  <CommandItem
                    key={`agent-${agent.id}`}
                    value={`${agent.name} agent`}
                    onSelect={() => navigate(`/agents/${agent.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 text-[13px] cursor-pointer rounded-lg"
                  >
                    <Bot className="w-4 h-4 text-[#64748B] dark:text-[#9CA3AF]" />
                    <span>{agent.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
