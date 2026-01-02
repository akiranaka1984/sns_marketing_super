import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link } from "wouter";
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
import Proxies from "./pages/Proxies";
import AccountDetail from "./pages/AccountDetail";
import Automation from "./pages/Automation";
import ScheduledPosts from "./pages/ScheduledPosts";
import FreezeDetection from "./pages/FreezeDetection";
import Engagement from "./pages/Engagement";
import Devices from "./pages/Devices";
import DeviceDetail from "./pages/DeviceDetail";
import { Analytics } from "./pages/Analytics";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import ContentCollection from "./pages/ContentCollection";
import ContentRewrite from "./pages/ContentRewrite";
import ContentReview from "./pages/ContentReview";
import WeeklyReview from "./pages/WeeklyReview";
import AIOptimization from "./pages/AIOptimization";
import ABTesting from "./pages/ABTesting";
import PostReview from "./pages/PostReview";
import DeviceMonitor from "./pages/DeviceMonitor";
import DebugInstagram from "./pages/DebugInstagram";
import DebugXWeb from "./pages/DebugXWeb";
import ADBKeyboard from "./pages/ADBKeyboard";
import XApiSettings from "./pages/XApiSettings";
import InteractionTest from "./pages/InteractionTest";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "./components/ui/button";
import { getLoginUrl } from "./const";
import DashboardLayout from "./components/DashboardLayout";



function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-8xl mb-6">🚀</div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            SNS Marketing Automation
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Automate your social media accounts with AI-powered strategies
          </p>
          <Button size="lg" className="gap-2" asChild>
            <a href={getLoginUrl()}>
              Sign In to Get Started
            </a>
          </Button>
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
        <Route path="/proxies" component={Proxies} />
        <Route path="/automation" component={Automation} />
        <Route path="/scheduled-posts" component={ScheduledPosts} />
        <Route path="/freeze-detection" component={FreezeDetection} />
        <Route path="/engagement" component={Engagement} />
        <Route path="/devices" component={Devices} />
        <Route path="/adbkeyboard" component={ADBKeyboard} />
        <Route path="/x-api-settings" component={XApiSettings} />
        <Route path="/interaction-test" component={InteractionTest} />
        <Route path="/devices/:id" component={DeviceDetail} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:id" component={AgentDetail} />
        <Route path="/content-collection" component={ContentCollection} />
        <Route path="/content-rewrite" component={ContentRewrite} />
        <Route path="/content-review" component={ContentReview} />
        <Route path="/weekly-review" component={WeeklyReview} />
        <Route path="/ai-optimization" component={AIOptimization} />
        <Route path="/ab-testing" component={ABTesting} />
          <Route path="/post-review" component={PostReview} />
        <Route path="/ab-testing/:id" component={ABTesting} />
        <Route path="/device-monitor" component={DeviceMonitor} />
        <Route path="/debug/instagram" component={DebugInstagram} />
        <Route path="/debug/x-web" component={DebugXWeb} />
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
