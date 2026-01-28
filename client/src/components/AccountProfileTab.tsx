import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Copy, Check, Wand2, BarChart3, Globe, RefreshCw, User, Users, FileText } from "lucide-react";
import { toast } from "sonner";

interface AccountProfileTabProps {
  accountId: number;
  account: {
    username: string;
    xHandle?: string | null;
    platform: string;
    personaRole?: string | null;
    personaTone?: string | null;
    personaCharacteristics?: string | null;
  };
}

type BioStyle = 'professional' | 'casual' | 'creative' | 'minimalist';
type AnalysisLanguage = 'ja' | 'en';

const bioStyleLabels: Record<BioStyle, string> = {
  professional: 'プロフェッショナル',
  casual: 'カジュアル',
  creative: 'クリエイティブ',
  minimalist: 'ミニマル',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function AccountProfileTab({ accountId, account }: AccountProfileTabProps) {
  const [bioStyle, setBioStyle] = useState<BioStyle>('professional');
  const [keyPoints, setKeyPoints] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [generatedBios, setGeneratedBios] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<AnalysisLanguage>('ja');
  const [mode, setMode] = useState<'analyze' | 'generate'>('analyze');

  // Fetch current profile
  const { data: currentProfileData, isLoading: isLoadingProfile, refetch: refetchProfile } =
    trpc.profileOptimization.getCurrentProfile.useQuery(
      { accountId },
      { enabled: !!accountId }
    );

  // Mutations
  const analyzeMutation = trpc.profileOptimization.analyzeProfile.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("プロフィール分析が完了しました");
        setAnalysisResult(result.analysis);
      } else {
        toast.error(result.error || "分析に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(`分析失敗: ${error.message}`);
    },
  });

  const generateBioMutation = trpc.profileOptimization.generateBio.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Bio候補を生成しました");
        setGeneratedBios(result.bios);
      } else {
        toast.error(result.error || "生成に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(`生成失敗: ${error.message}`);
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate({
      targetType: 'own_account',
      accountId,
      includeModelComparison: true,
      language,
    });
  };

  const handleGenerateBio = () => {
    const keyPointsArray = keyPoints.split(',').map(s => s.trim()).filter(s => s);

    generateBioMutation.mutate({
      targetType: 'own_account',
      accountId,
      targetStyle: bioStyle,
      keyPoints: keyPointsArray,
      language,
    });
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("コピーしました");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                プロフィール最適化
              </CardTitle>
              <CardDescription className="mt-1.5">
                AIを使用してプロフィールを分析し、改善提案とBio候補を生成します
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={language} onValueChange={(v) => setLanguage(v as AnalysisLanguage)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Current Profile Display */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">現在のプロフィール</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchProfile()}
                disabled={isLoadingProfile}
              >
                {isLoadingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isLoadingProfile ? (
              <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : currentProfileData?.success && currentProfileData.profile ? (
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  {currentProfileData.profile.profileImageUrl ? (
                    <img
                      src={currentProfileData.profile.profileImageUrl}
                      alt={currentProfileData.profile.displayName}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{currentProfileData.profile.displayName}</p>
                    <p className="text-sm text-slate-500">@{currentProfileData.profile.username}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-1">Bio</p>
                  {currentProfileData.profile.bio ? (
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentProfileData.profile.bio}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Bioが設定されていません</p>
                  )}
                </div>
                <div className="flex gap-4 pt-2 border-t border-slate-200 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{currentProfileData.profile.followersCount?.toLocaleString() || 0} フォロワー</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{currentProfileData.profile.followingCount?.toLocaleString() || 0} フォロー中</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{currentProfileData.profile.postsCount?.toLocaleString() || 0} 投稿</span>
                  </div>
                </div>
              </div>
            ) : currentProfileData?.error ? (
              <div className="p-4 bg-red-50 rounded-lg text-sm text-red-600">
                {currentProfileData.error}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-500">
                X Handleが設定されていないため、プロフィールを取得できません
              </div>
            )}
          </div>

          {/* Persona info display */}
          {(account.personaRole || account.personaTone || account.personaCharacteristics) && (
            <div className="p-3 bg-blue-50 rounded-lg mb-4">
              <p className="text-sm font-medium text-blue-900 mb-1">ペルソナ設定を反映</p>
              <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                {account.personaRole && <Badge variant="outline">{account.personaRole}</Badge>}
                {account.personaTone && <Badge variant="outline">{account.personaTone}</Badge>}
              </div>
              {account.personaCharacteristics && (
                <p className="text-xs text-blue-600 mt-1 line-clamp-2">{account.personaCharacteristics}</p>
              )}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === 'analyze' ? 'default' : 'outline'}
              onClick={() => setMode('analyze')}
              size="sm"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              分析
            </Button>
            <Button
              variant={mode === 'generate' ? 'default' : 'outline'}
              onClick={() => setMode('generate')}
              size="sm"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Bio生成
            </Button>
          </div>

          {/* Analyze Mode */}
          {mode === 'analyze' && (
            <div className="space-y-4">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full"
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-2" />
                )}
                プロフィールを分析
              </Button>
            </div>
          )}

          {/* Generate Mode */}
          {mode === 'generate' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>スタイル</Label>
                  <Select value={bioStyle} onValueChange={(v) => setBioStyle(v as BioStyle)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(bioStyleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>キーポイント（カンマ区切り）</Label>
                  <Input
                    placeholder="例: 起業家, AI, マーケティング"
                    value={keyPoints}
                    onChange={(e) => setKeyPoints(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateBio}
                disabled={generateBioMutation.isPending}
                className="w-full"
              >
                {generateBioMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Bio候補を生成
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && mode === 'analyze' && (
        <div className="space-y-4">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">総合スコア</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.overallScore)}`}>
                  {analysisResult.overallScore}
                </div>
                <Progress value={analysisResult.overallScore} className="flex-1" />
              </div>
            </CardContent>
          </Card>

          {/* Bio Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bio分析</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                {[
                  { key: 'clarity', label: '明確さ' },
                  { key: 'personality', label: '個性' },
                  { key: 'callToAction', label: 'CTA' },
                  { key: 'keywords', label: 'キーワード' },
                  { key: 'length', label: '長さ' },
                ].map(({ key, label }) => (
                  <div key={key} className="text-center">
                    <div className={`text-lg font-bold ${getScoreColor(analysisResult.bioAnalysis[key])}`}>
                      {analysisResult.bioAnalysis[key]}
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {analysisResult.bioAnalysis.overallAnalysis}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-green-600">強み</h4>
                  <ul className="text-sm space-y-1">
                    {analysisResult.bioAnalysis.strengths?.map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-600">改善点</h4>
                  <ul className="text-sm space-y-1">
                    {analysisResult.bioAnalysis.weaknesses?.map((w: string, i: number) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggestions */}
          {analysisResult.suggestions?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">改善提案</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.suggestions.map((suggestion: any, i: number) => (
                    <div key={i} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${priorityColors[suggestion.priority]}`} />
                        <span className="font-medium">{suggestion.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      {suggestion.example && (
                        <p className="text-sm mt-1 italic">例: {suggestion.example}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Improved Bio Options */}
          {analysisResult.improvedBioOptions?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">改善Bio候補</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.improvedBioOptions.map((bio: any, i: number) => (
                    <div key={i} className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">{bioStyleLabels[bio.style as BioStyle] || bio.style}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(bio.bio, i)}
                        >
                          {copiedIndex === i ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm font-medium mb-1">"{bio.bio}"</p>
                      <p className="text-xs text-muted-foreground">{bio.whyItWorks}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Generated Bios */}
      {generatedBios.length > 0 && mode === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">生成されたBio候補</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedBios.map((bio, i) => (
                <div key={i} className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {bioStyleLabels[bio.style as BioStyle] || bio.style}
                      </Badge>
                      <Badge variant="outline">{bio.focus}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(bio.bio, i + 100)}
                    >
                      {copiedIndex === i + 100 ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm font-medium mb-2 p-2 bg-background rounded">
                    "{bio.bio}"
                  </p>
                  <p className="text-xs text-muted-foreground">{bio.whyItWorks}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
