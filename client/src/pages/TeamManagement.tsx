import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  MoreHorizontal,
  Trash2,
  Crown,
  Eye,
  Edit3,
  Clock,
  Activity,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "pending";
  joinedAt: string;
  avatarUrl?: string;
};

type ActivityLogEntry = {
  id: string;
  action: string;
  actor: string;
  target?: string;
  timestamp: string;
};

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "田中 太郎",
    email: "tanaka@example.com",
    role: "admin",
    status: "active",
    joinedAt: "2025-12-01",
  },
  {
    id: "2",
    name: "佐藤 花子",
    email: "sato@example.com",
    role: "editor",
    status: "active",
    joinedAt: "2026-01-15",
  },
  {
    id: "3",
    name: "山田 次郎",
    email: "yamada@example.com",
    role: "viewer",
    status: "active",
    joinedAt: "2026-01-20",
  },
  {
    id: "4",
    name: "",
    email: "suzuki@example.com",
    role: "editor",
    status: "pending",
    joinedAt: "2026-02-05",
  },
  {
    id: "5",
    name: "高橋 美咲",
    email: "takahashi@example.com",
    role: "viewer",
    status: "active",
    joinedAt: "2026-02-08",
  },
];

const MOCK_ACTIVITY_LOG: ActivityLogEntry[] = [
  {
    id: "a1",
    action: "メンバーを招待しました",
    actor: "田中 太郎",
    target: "suzuki@example.com",
    timestamp: "2026-02-05 14:30",
  },
  {
    id: "a2",
    action: "権限を変更しました",
    actor: "田中 太郎",
    target: "佐藤 花子 (viewer → editor)",
    timestamp: "2026-02-03 10:15",
  },
  {
    id: "a3",
    action: "チームに参加しました",
    actor: "高橋 美咲",
    timestamp: "2026-02-08 09:00",
  },
  {
    id: "a4",
    action: "メンバーを招待しました",
    actor: "田中 太郎",
    target: "takahashi@example.com",
    timestamp: "2026-02-01 16:45",
  },
  {
    id: "a5",
    action: "メンバーを削除しました",
    actor: "田中 太郎",
    target: "test-user@example.com",
    timestamp: "2026-01-28 11:20",
  },
];

const ROLE_CONFIG = {
  admin: {
    label: "管理者",
    color: "#FF6B6B",
    bgColor: "bg-[#FF6B6B]",
    textColor: "text-[#1A1A1A]",
    borderColor: "border-[#1A1A1A]",
    icon: Crown,
  },
  editor: {
    label: "編集者",
    color: "#4ECDC4",
    bgColor: "bg-[#4ECDC4]",
    textColor: "text-[#1A1A1A]",
    borderColor: "border-[#1A1A1A]",
    icon: Edit3,
  },
  viewer: {
    label: "閲覧者",
    color: "#A8E6CF",
    bgColor: "bg-[#A8E6CF]",
    textColor: "text-[#1A1A1A]",
    borderColor: "border-[#1A1A1A]",
    icon: Eye,
  },
};

function RoleBadge({ role }: { role: "admin" | "editor" | "viewer" }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${config.bgColor} ${config.textColor} ${config.borderColor} border-2`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: "active" | "pending" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
        アクティブ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
      招待中
    </span>
  );
}

function MemberAvatar({ member }: { member: TeamMember }) {
  const initials = member.name
    ? member.name
        .split(" ")
        .map((n) => n.charAt(0))
        .join("")
        .slice(0, 2)
    : member.email.charAt(0).toUpperCase();

  return (
    <div className="w-9 h-9 rounded-lg bg-[#DDA0DD] flex items-center justify-center flex-shrink-0 border-2 border-[#1A1A1A]">
      <span className="text-[#1A1A1A] text-[11px] font-bold">{initials}</span>
    </div>
  );
}

export default function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [activityLog] = useState<ActivityLogEntry[]>(MOCK_ACTIVITY_LOG);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isChangeRoleDialogOpen, setIsChangeRoleDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">("viewer");

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error("有効なメールアドレスを入力してください");
      return;
    }
    if (members.some((m) => m.email === inviteEmail)) {
      toast.error("このメールアドレスは既に登録されています");
      return;
    }

    const newMember: TeamMember = {
      id: String(Date.now()),
      name: "",
      email: inviteEmail,
      role: inviteRole,
      status: "pending",
      joinedAt: new Date().toISOString().split("T")[0],
    };
    setMembers((prev) => [...prev, newMember]);
    toast.success(`${inviteEmail} に招待を送信しました`);
    setInviteEmail("");
    setInviteRole("viewer");
    setIsInviteDialogOpen(false);
  };

  const handleChangeRole = () => {
    if (!selectedMember) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === selectedMember.id ? { ...m, role: newRole } : m))
    );
    toast.success(
      `${selectedMember.name || selectedMember.email} の権限を ${ROLE_CONFIG[newRole].label} に変更しました`
    );
    setIsChangeRoleDialogOpen(false);
    setSelectedMember(null);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;
    setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
    toast.success(
      `${selectedMember.name || selectedMember.email} をチームから削除しました`
    );
    setIsRemoveDialogOpen(false);
    setSelectedMember(null);
  };

  const openChangeRoleDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setIsChangeRoleDialogOpen(true);
  };

  const openRemoveDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setIsRemoveDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const activeCount = members.filter((m) => m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="fade-in-up">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#87CEEB] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                <Users className="w-5 h-5 text-[#1A1A1A]" />
              </div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                チーム管理
              </h1>
            </div>
            <p className="text-[14px] text-[#6B6B6B] font-bold ml-[52px]">
              メンバーの招待と権限管理
            </p>
          </div>
          <Button
            onClick={() => setIsInviteDialogOpen(true)}
            className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] h-10 px-4 text-[13px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            メンバーを招待
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="fade-in-up grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#87CEEB] flex items-center justify-center border-2 border-[#1A1A1A]">
              <Users className="w-4.5 h-4.5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">
                総メンバー
              </p>
              <p className="text-xl font-bold text-[#1A1A1A]">
                {members.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#A8E6CF] flex items-center justify-center border-2 border-[#1A1A1A]">
              <Shield className="w-4.5 h-4.5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">
                アクティブ
              </p>
              <p className="text-xl font-bold text-[#1A1A1A]">
                {activeCount}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFD700] flex items-center justify-center border-2 border-[#1A1A1A]">
              <Mail className="w-4.5 h-4.5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">
                招待中
              </p>
              <p className="text-xl font-bold text-[#1A1A1A]">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Member List */}
      <div className="fade-in-up">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-[#1A1A1A] bg-[#FFD700]">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">
              メンバー一覧
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-[#1A1A1A] hover:bg-transparent">
                <TableHead className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-wider pl-6">
                  メンバー
                </TableHead>
                <TableHead className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-wider">
                  権限
                </TableHead>
                <TableHead className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-wider">
                  ステータス
                </TableHead>
                <TableHead className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-wider">
                  参加日
                </TableHead>
                <TableHead className="text-[12px] font-bold text-[#1A1A1A] uppercase tracking-wider text-right pr-6">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow
                  key={member.id}
                  className="border-b-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors"
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1A1A1A] truncate">
                          {member.name || "(未登録)"}
                        </p>
                        <p className="text-[12px] text-[#6B6B6B] font-bold truncate">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-[13px] text-[#6B6B6B] font-bold">
                      {formatDate(member.joinedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#FFF8DC] rounded-lg"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[180px] p-1.5 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]"
                      >
                        <DropdownMenuItem
                          onClick={() => openChangeRoleDialog(member)}
                          className="text-[13px] font-bold rounded-lg cursor-pointer"
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          権限を変更
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#1A1A1A]" />
                        <DropdownMenuItem
                          onClick={() => openRemoveDialog(member)}
                          className="text-[#FF6B6B] focus:text-[#FF6B6B] text-[13px] font-bold rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          メンバーを削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Activity Log */}
      <div className="fade-in-up">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-[#1A1A1A] bg-[#FFD700]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1A1A1A]" />
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">
                アクティビティログ
              </h2>
            </div>
          </div>
          <div className="divide-y-2 divide-[#1A1A1A]">
            {activityLog.map((entry) => (
              <div
                key={entry.id}
                className="px-6 py-3.5 flex items-start gap-3 hover:bg-[#FFF8DC] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[#FFDAB9] flex items-center justify-center flex-shrink-0 mt-0.5 border-2 border-[#1A1A1A]">
                  <Clock className="w-3.5 h-3.5 text-[#1A1A1A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#1A1A1A] font-bold">
                    <span className="font-bold">{entry.actor}</span>
                    <span className="text-[#6B6B6B]">
                      {" "}
                      が{entry.action}
                    </span>
                    {entry.target && (
                      <span className="text-[#1A1A1A] font-bold">
                        {" "}
                        {entry.target}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B] font-bold mt-0.5">
                    {entry.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-[#FFFDF7] border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#1A1A1A]">
              メンバーを招待
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6B6B] font-bold">
              メールアドレスを入力して、チームメンバーを招待します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="invite-email"
                className="text-[13px] font-bold text-[#1A1A1A]"
              >
                メールアドレス
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="pl-10 h-10 text-[13px] border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg focus:ring-[#FFD700] focus:border-[#1A1A1A] font-bold"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-[#1A1A1A]">
                権限
              </Label>
              <Select
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole(value as "admin" | "editor" | "viewer")
                }
              >
                <SelectTrigger className="h-10 text-[13px] border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                  <SelectItem value="admin" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-[#FF6B6B]" />
                      管理者 - 全ての操作が可能
                    </div>
                  </SelectItem>
                  <SelectItem value="editor" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-3.5 h-3.5 text-[#4ECDC4]" />
                      編集者 - コンテンツの編集が可能
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-[#A8E6CF]" />
                      閲覧者 - 閲覧のみ
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsInviteDialogOpen(false);
                setInviteEmail("");
                setInviteRole("viewer");
              }}
              className="text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] font-bold"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleInvite}
              className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] text-[13px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              招待を送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleDialogOpen} onOpenChange={setIsChangeRoleDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#FFFDF7] border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#1A1A1A]">
              権限を変更
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6B6B] font-bold">
              {selectedMember?.name || selectedMember?.email} の権限を変更します。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-[#1A1A1A]">
                新しい権限
              </Label>
              <Select
                value={newRole}
                onValueChange={(value) =>
                  setNewRole(value as "admin" | "editor" | "viewer")
                }
              >
                <SelectTrigger className="h-10 text-[13px] border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                  <SelectItem value="admin" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-[#FF6B6B]" />
                      管理者
                    </div>
                  </SelectItem>
                  <SelectItem value="editor" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-3.5 h-3.5 text-[#4ECDC4]" />
                      編集者
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer" className="text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-[#A8E6CF]" />
                      閲覧者
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsChangeRoleDialogOpen(false);
                setSelectedMember(null);
              }}
              className="text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] font-bold"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleChangeRole}
              className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] text-[13px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Shield className="w-4 h-4 mr-2" />
              変更を保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#FFFDF7] border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#1A1A1A]">
              メンバーを削除
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B6B6B] font-bold">
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-[#FF6B6B]/20 rounded-lg border-2 border-[#FF6B6B]">
              <AlertCircle className="w-5 h-5 text-[#FF6B6B] flex-shrink-0" />
              <p className="text-[13px] text-[#1A1A1A] font-bold">
                <span className="font-bold">
                  {selectedMember?.name || selectedMember?.email}
                </span>{" "}
                をチームから削除しますか？削除されたメンバーはプロジェクトやデータにアクセスできなくなります。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsRemoveDialogOpen(false);
                setSelectedMember(null);
              }}
              className="text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] font-bold"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleRemoveMember}
              className="bg-[#FF6B6B] hover:bg-[#FF6B6B] text-[#1A1A1A] text-[13px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
