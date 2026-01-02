import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ja' | 'zh';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as Language) || 'ja';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// Translation data
const translations: Record<Language, any> = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      projects: 'Projects',
      accounts: 'Accounts',
      proxies: 'Proxies',
      strategies: 'Strategies',
      logs: 'Logs',
      settings: 'Settings',
      logout: 'Logout',
    },
    dashboard: {
      title: 'Welcome back',
      subtitle: 'Manage your SNS accounts and marketing strategies',
      totalAccounts: 'Total Accounts',
      activeAccounts: 'Active Accounts',
      availableDevices: 'Available Devices',
      failedAccounts: 'Failed Accounts',
      active: 'active',
      pending: 'pending',
      successfullyRegistered: 'Successfully registered',
      readyForRegistration: 'Ready for registration',
      needsAttention: 'Needs attention',
      quickActions: 'Quick Actions',
      quickActionsSubtitle: 'Get started with common tasks',
      addNewAccount: 'Add New Account',
      generateStrategy: 'Generate Strategy',
      recentActivity: 'Recent Activity',
      recentActivitySubtitle: 'Latest registration logs',
      noRecentActivity: 'No recent activity',
      viewAllLogs: 'View All Logs',
      yourAccounts: 'Your Accounts',
      yourAccountsSubtitle: 'Manage your SNS accounts',
    },
    accounts: {
      title: 'Accounts',
      subtitle: 'Manage your SNS accounts',
      addAccount: 'Add Account',
      viewDetails: 'View Details',
      viewInDuoPlus: 'View in DuoPlus',
      register: 'Register',
      delete: 'Delete',
      created: 'Created',
      status: {
        active: 'active',
        pending: 'pending',
        failed: 'failed',
      },
      platform: {
        twitter: 'Twitter',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook',
      },
    },
    accountDetail: {
      backToAccounts: 'Back to Accounts',
      account: 'Account',
      status: 'Status',
      device: 'Device',
      created: 'Created',
      unknownDevice: 'Unknown Device',
      performanceAnalytics: 'Performance Analytics',
      followersGrowth: 'Followers Growth',
      engagementRate: 'Engagement Rate',
      previous: 'Previous',
      followersTrend: 'Followers Trend',
      followersTrendSubtitle: 'Track your follower growth over time',
      engagementRateTitle: 'Engagement Rate',
      engagementRateSubtitle: 'Monitor your engagement performance',
      engagementMetrics: 'Engagement Metrics',
      engagementMetricsSubtitle: 'Detailed breakdown of likes, comments, and shares',
      likes: 'Likes',
      comments: 'Comments',
      shares: 'Shares',
      accountDetails: 'Account Details',
      accountDetailsSubtitle: 'Complete information about this account',
    },
    strategies: {
      title: 'Marketing Strategies',
      subtitle: 'AI-generated strategies for your campaigns',
      generateStrategy: 'Generate Strategy',
      strategy: 'Strategy',
      contentType: 'Content Type',
      hashtags: 'Hashtags',
      postingSchedule: 'Posting Schedule',
      engagementStrategy: 'Engagement Strategy',
      sampleContent: 'Sample Content',
    },
    logs: {
      title: 'Activity Logs',
      subtitle: 'View detailed logs of all account registration and operations',
      noLogs: 'No logs yet',
      noLogsMessage: 'Activity logs will appear here once you start using the system',
    },
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close',
      confirm: 'Confirm',
    },
  },
  ja: {
    nav: {
      dashboard: 'ダッシュボード',
      projects: 'プロジェクト',
      accounts: 'アカウント',
      proxies: 'プロキシ',
      strategies: '戦略',
      logs: 'ログ',
      settings: '設定',
      logout: 'ログアウト',
    },
    dashboard: {
      title: 'おかえりなさい',
      subtitle: 'SNSアカウントとマーケティング戦略を管理',
      totalAccounts: '総アカウント数',
      activeAccounts: 'アクティブアカウント',
      availableDevices: '利用可能デバイス',
      failedAccounts: '失敗アカウント',
      active: 'アクティブ',
      pending: '保留中',
      successfullyRegistered: '登録成功',
      readyForRegistration: '登録準備完了',
      needsAttention: '要注意',
      quickActions: 'クイックアクション',
      quickActionsSubtitle: '一般的なタスクを開始',
      addNewAccount: '新規アカウント追加',
      generateStrategy: '戦略生成',
      recentActivity: '最近のアクティビティ',
      recentActivitySubtitle: '最新の登録ログ',
      noRecentActivity: '最近のアクティビティはありません',
      viewAllLogs: 'すべてのログを表示',
      yourAccounts: 'あなたのアカウント',
      yourAccountsSubtitle: 'SNSアカウントを管理',
    },
    accounts: {
      title: 'アカウント',
      subtitle: 'SNSアカウントを管理',
      addAccount: 'アカウント追加',
      viewDetails: '詳細を表示',
      viewInDuoPlus: 'DuoPlusで表示',
      register: '登録',
      delete: '削除',
      created: '作成日時',
      status: {
        active: 'アクティブ',
        pending: '保留中',
        failed: '失敗',
      },
      platform: {
        twitter: 'Twitter',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook',
      },
    },
    accountDetail: {
      backToAccounts: 'アカウント一覧に戻る',
      account: 'アカウント',
      status: 'ステータス',
      device: 'デバイス',
      created: '作成日時',
      unknownDevice: '不明なデバイス',
      performanceAnalytics: 'パフォーマンス分析',
      followersGrowth: 'フォロワー成長',
      engagementRate: 'エンゲージメント率',
      previous: '前回',
      followersTrend: 'フォロワー推移',
      followersTrendSubtitle: 'フォロワー数の成長を追跡',
      engagementRateTitle: 'エンゲージメント率',
      engagementRateSubtitle: 'エンゲージメントパフォーマンスを監視',
      engagementMetrics: 'エンゲージメント指標',
      engagementMetricsSubtitle: 'いいね、コメント、シェアの詳細内訳',
      likes: 'いいね',
      comments: 'コメント',
      shares: 'シェア',
      accountDetails: 'アカウント詳細',
      accountDetailsSubtitle: 'このアカウントの完全な情報',
    },
    strategies: {
      title: 'マーケティング戦略',
      subtitle: 'AIが生成したキャンペーン戦略',
      generateStrategy: '戦略生成',
      strategy: '戦略',
      contentType: 'コンテンツタイプ',
      hashtags: 'ハッシュタグ',
      postingSchedule: '投稿スケジュール',
      engagementStrategy: 'エンゲージメント戦略',
      sampleContent: 'サンプルコンテンツ',
    },
    logs: {
      title: 'アクティビティログ',
      subtitle: 'すべてのアカウント登録と操作の詳細ログを表示',
      noLogs: 'ログはまだありません',
      noLogsMessage: 'システムの使用を開始すると、アクティビティログがここに表示されます',
    },
    common: {
      loading: '読み込み中...',
      error: 'エラー',
      success: '成功',
      cancel: 'キャンセル',
      save: '保存',
      close: '閉じる',
      confirm: '確認',
    },
  },
  zh: {
    nav: {
      dashboard: '仪表板',
      projects: '项目',
      accounts: '账户',
      proxies: '代理',
      strategies: '策略',
      logs: '日志',
      settings: '设置',
      logout: '登出',
    },
    dashboard: {
      title: '欢迎回来',
      subtitle: '管理您的社交媒体账户和营销策略',
      totalAccounts: '总账户数',
      activeAccounts: '活跃账户',
      availableDevices: '可用设备',
      failedAccounts: '失败账户',
      active: '活跃',
      pending: '待处理',
      successfullyRegistered: '注册成功',
      readyForRegistration: '准备注册',
      needsAttention: '需要注意',
      quickActions: '快速操作',
      quickActionsSubtitle: '开始常见任务',
      addNewAccount: '添加新账户',
      generateStrategy: '生成策略',
      recentActivity: '最近活动',
      recentActivitySubtitle: '最新注册日志',
      noRecentActivity: '暂无最近活动',
      viewAllLogs: '查看所有日志',
      yourAccounts: '您的账户',
      yourAccountsSubtitle: '管理您的社交媒体账户',
    },
    accounts: {
      title: '账户',
      subtitle: '管理您的社交媒体账户',
      addAccount: '添加账户',
      viewDetails: '查看详情',
      viewInDuoPlus: '在DuoPlus中查看',
      register: '注册',
      delete: '删除',
      created: '创建时间',
      status: {
        active: '活跃',
        pending: '待处理',
        failed: '失败',
      },
      platform: {
        twitter: 'Twitter',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook',
      },
    },
    accountDetail: {
      backToAccounts: '返回账户列表',
      account: '账户',
      status: '状态',
      device: '设备',
      created: '创建时间',
      unknownDevice: '未知设备',
      performanceAnalytics: '性能分析',
      followersGrowth: '粉丝增长',
      engagementRate: '互动率',
      previous: '上次',
      followersTrend: '粉丝趋势',
      followersTrendSubtitle: '跟踪您的粉丝增长',
      engagementRateTitle: '互动率',
      engagementRateSubtitle: '监控您的互动表现',
      engagementMetrics: '互动指标',
      engagementMetricsSubtitle: '点赞、评论和分享的详细分类',
      likes: '点赞',
      comments: '评论',
      shares: '分享',
      accountDetails: '账户详情',
      accountDetailsSubtitle: '关于此账户的完整信息',
    },
    strategies: {
      title: '营销策略',
      subtitle: 'AI生成的活动策略',
      generateStrategy: '生成策略',
      strategy: '策略',
      contentType: '内容类型',
      hashtags: '标签',
      postingSchedule: '发布计划',
      engagementStrategy: '互动策略',
      sampleContent: '示例内容',
    },
    logs: {
      title: '活动日志',
      subtitle: '查看所有账户注册和操作的详细日志',
      noLogs: '暂无日志',
      noLogsMessage: '开始使用系统后，活动日志将显示在这里',
    },
    common: {
      loading: '加载中...',
      error: '错误',
      success: '成功',
      cancel: '取消',
      save: '保存',
      close: '关闭',
      confirm: '确认',
    },
  },
};
