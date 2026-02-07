import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

export default function Strategies() {
  const { t } = useI18n();
  const { data: strategies, isLoading } = trpc.strategies.list.useQuery();

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">{t('strategies.title')}</h1>
          <p className="page-subtitle">{t('strategies.subtitle')}</p>
        </div>
        <Link href="/strategies/new">
          <Button size="lg" className="gap-2 bg-[#D4380D] hover:bg-[#B8300B] text-white">
            <Plus className="h-5 w-5" />
            {t('strategies.generateStrategy')}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#A3A3A3]" />
        </div>
      ) : strategies && strategies.length > 0 ? (
        <div className="grid gap-6">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4 hover:border-[#D4380D]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-[#1A1A1A] flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-[#D4380D]" />
                    Strategy #{strategy.id}
                  </h3>
                  <p className="text-sm text-[#737373]">
                    {strategy.objective}
                  </p>
                </div>
                <span className="text-xs text-[#A3A3A3]">
                  {new Date(strategy.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm">{t('strategies.contentType')}</h4>
                  <p className="text-sm text-[#737373]">{strategy.contentType}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm">{t('strategies.hashtags')}</h4>
                  <p className="text-sm text-[#737373]">{strategy.hashtags}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm">{t('strategies.postingSchedule')}</h4>
                  <p className="text-sm text-[#737373]">{strategy.postingSchedule}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm">{t('strategies.engagementStrategy')}</h4>
                  <p className="text-sm text-[#737373]">{strategy.engagementStrategy}</p>
                </div>
              </div>
              {strategy.generatedContent && (
                <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
                  <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm">{t('strategies.sampleContent')}</h4>
                  <div className="bg-[#F5F5F5] rounded-lg p-4">
                    <pre className="text-sm text-[#525252] whitespace-pre-wrap font-sans">
                      {strategy.generatedContent}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <div className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">
              {t('strategies.noStrategies')}
            </h3>
            <p className="text-[#A3A3A3] mb-6">
              {t('strategies.noStrategiesSubtitle')}
            </p>
            <Link href="/strategies/new">
              <Button size="lg" className="gap-2 bg-[#D4380D] hover:bg-[#B8300B] text-white">
                <Plus className="h-5 w-5" />
                {t('strategies.generateFirstStrategy')}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
