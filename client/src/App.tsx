import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import NewAccount from "./pages/NewAccount";
import Strategies from "./pages/Strategies";
import NewStrategy from "./pages/NewStrategy";
import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectEdit from "./pages/ProjectEdit";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

import AccountDetail from "./pages/AccountDetail";
import Automation from "./pages/Automation";
import ScheduledPosts from "./pages/ScheduledPosts";
import FreezeDetection from "./pages/FreezeDetection";
import Engagement from "./pages/Engagement";
import { Analytics } from "./pages/Analytics";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import WeeklyReview from "./pages/WeeklyReview";
import AIOptimization from "./pages/AIOptimization";
import ABTesting from "./pages/ABTesting";
import PostReview from "./pages/PostReview";
import ModelAccounts from "./pages/ModelAccounts";
import BuzzAnalysis from "./pages/BuzzAnalysis";
import LearningInsights from "./pages/LearningInsights";
import HashtagAnalytics from "./pages/HashtagAnalytics";
import CompetitorBenchmark from "./pages/CompetitorBenchmark";
import { useAuth } from "./_core/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[#1A1A1A] flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-[#A3A3A3] mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Auto-login: redirect to dev-login endpoint
    window.location.href = "/api/dev-login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-lg bg-[#1A1A1A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <p className="text-sm text-[#A3A3A3]">ログイン中...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id/edit" component={ProjectEdit} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/accounts/new" component={NewAccount} />
        <Route path="/accounts/add" component={NewAccount} />
        <Route path="/accounts/:id" component={AccountDetail} />
        <Route path="/strategies" component={Strategies} />
        <Route path="/strategies/new" component={NewStrategy} />
        <Route path="/logs" component={Logs} />
        <Route path="/automation" component={Automation} />
        <Route path="/scheduled-posts" component={ScheduledPosts} />
        <Route path="/freeze-detection" component={FreezeDetection} />
        <Route path="/engagement" component={Engagement} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/model-accounts" component={ModelAccounts} />
        <Route path="/buzz-analysis" component={BuzzAnalysis} />
        <Route path="/learning-insights" component={LearningInsights} />
        <Route path="/hashtag-analytics" component={HashtagAnalytics} />
        <Route path="/competitor-benchmark" component={CompetitorBenchmark} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:id" component={AgentDetail} />
        <Route path="/weekly-review" component={WeeklyReview} />
        <Route path="/ai-optimization" component={AIOptimization} />
        <Route path="/ab-testing" component={ABTesting} />
        <Route path="/post-review" component={PostReview} />
        <Route path="/ab-testing/:id" component={ABTesting} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
