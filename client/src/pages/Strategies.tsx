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
          <Button size="lg" className="gap-2 bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] font-bold">
            <Plus className="h-5 w-5" />
            {t('strategies.generateStrategy')}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
        </div>
      ) : strategies && strategies.length > 0 ? (
        <div className="grid gap-6">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 hover:bg-[#FFF8DC] transition-colors shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-[#FFD700]" />
                    Strategy #{strategy.id}
                  </h3>
                  <p className="text-sm text-[#6B6B6B] font-bold">
                    {strategy.objective}
                  </p>
                </div>
                <span className="text-xs text-[#6B6B6B] font-bold">
                  {new Date(strategy.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">{t('strategies.contentType')}</h4>
                  <p className="text-sm text-[#6B6B6B] font-bold">{strategy.contentType}</p>
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">{t('strategies.hashtags')}</h4>
                  <p className="text-sm text-[#6B6B6B] font-bold">{strategy.hashtags}</p>
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">{t('strategies.postingSchedule')}</h4>
                  <p className="text-sm text-[#6B6B6B] font-bold">{strategy.postingSchedule}</p>
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">{t('strategies.engagementStrategy')}</h4>
                  <p className="text-sm text-[#6B6B6B] font-bold">{strategy.engagementStrategy}</p>
                </div>
              </div>
              {strategy.generatedContent && (
                <div className="mt-4 pt-4 border-t-2 border-[#1A1A1A]">
                  <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">{t('strategies.sampleContent')}</h4>
                  <div className="bg-white rounded-lg p-4 border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                    <pre className="text-sm text-[#1A1A1A] whitespace-pre-wrap font-sans font-bold">
                      {strategy.generatedContent}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">
              {t('strategies.noStrategies')}
            </h3>
            <p className="text-[#6B6B6B] mb-6 font-bold">
              {t('strategies.noStrategiesSubtitle')}
            </p>
            <Link href="/strategies/new">
              <Button size="lg" className="gap-2 bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] font-bold">
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
