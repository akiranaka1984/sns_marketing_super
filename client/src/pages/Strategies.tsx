import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

export default function Strategies() {
  const { t } = useI18n();
  const { data: strategies, isLoading } = trpc.strategies.list.useQuery();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">{t('strategies.title')}</h1>
            <p className="text-slate-600">{t('strategies.subtitle')}</p>
          </div>
          <Link href="/strategies/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              {t('strategies.generateStrategy')}
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : strategies && strategies.length > 0 ? (
          <div className="grid gap-6">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Strategy #{strategy.id}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {strategy.objective}
                      </CardDescription>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(strategy.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">{t('strategies.contentType')}</h4>
                      <p className="text-sm text-slate-600">{strategy.contentType}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">{t('strategies.hashtags')}</h4>
                      <p className="text-sm text-slate-600">{strategy.hashtags}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">{t('strategies.postingSchedule')}</h4>
                      <p className="text-sm text-slate-600">{strategy.postingSchedule}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">{t('strategies.engagementStrategy')}</h4>
                      <p className="text-sm text-slate-600">{strategy.engagementStrategy}</p>
                    </div>
                  </div>
                  {strategy.generatedContent && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-semibold text-slate-900 mb-2">{t('strategies.sampleContent')}</h4>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                          {strategy.generatedContent}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {t('strategies.noStrategies')}
                </h3>
                <p className="text-slate-600 mb-6">
                  {t('strategies.noStrategiesSubtitle')}
                </p>
                <Link href="/strategies/new">
                  <Button size="lg" className="gap-2">
                    <Plus className="h-5 w-5" />
                    {t('strategies.generateFirstStrategy')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
