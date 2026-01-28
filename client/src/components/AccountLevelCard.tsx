import { Star, TrendingUp, BookOpen, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AccountLevelCardProps {
  level: number;
  experiencePoints: number;
  currentLevelXP: number;
  requiredXP: number;
  progressPercent: number;
  totalLearningsCount: number;
  learningsByType?: Record<string, number>;
}

export default function AccountLevelCard({
  level,
  experiencePoints,
  currentLevelXP,
  requiredXP,
  progressPercent,
  totalLearningsCount,
  learningsByType = {},
}: AccountLevelCardProps) {
  // Calculate total learnings by category
  const successPatterns = (learningsByType.success_pattern || 0) + (learningsByType.engagement_pattern || 0);
  const stylePatterns = (learningsByType.posting_style || 0) + (learningsByType.comment_style || 0);
  const otherPatterns = totalLearningsCount - successPatterns - stylePatterns;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Star className="h-7 w-7 text-white fill-white" />
            </div>
            <div>
              <div className="text-sm text-purple-600 font-medium">アカウントレベル</div>
              <div className="text-3xl font-bold text-purple-900">Lv. {level}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-600">経験値</div>
            <div className="text-lg font-semibold text-purple-900">
              {experiencePoints.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-purple-600 mb-1">
            <span>次のレベルまで</span>
            <span>{currentLevelXP} / {requiredXP} XP</span>
          </div>
          <Progress value={progressPercent} className="h-3 bg-purple-200" />
          <div className="text-right text-xs text-purple-500 mt-1">{progressPercent}%</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-purple-200">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">{successPatterns}</div>
            <div className="text-xs text-slate-500">成功パターン</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">{stylePatterns}</div>
            <div className="text-xs text-slate-500">スタイル</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
              <Zap className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">{totalLearningsCount}</div>
            <div className="text-xs text-slate-500">総学習数</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
