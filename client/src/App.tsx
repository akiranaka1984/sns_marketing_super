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
import ModelAccounts from "./pages/ModelAccounts";
import BuzzAnalysis from "./pages/BuzzAnalysis";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "./components/ui/button";
import { getLoginUrl } from "./const";
import DashboardLayout from "./components/DashboardLayout";
import {
  Gauge,
  ChevronRight,
  Zap,
  Users,
  BarChart3,
  Shield,
  Sparkles,
  Bot
} from "lucide-react";

// Feature card for the landing page
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay
}: {
  icon: typeof Zap;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      className="fade-in-up glass-card rounded-2xl p-6 group hover:border-white/15 transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="icon-gradient-cyan p-3 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform duration-300">
        <Icon className="w-6 h-6 text-[#3db9cf]" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 animated-gradient opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,10,15,0.9)_100%)]" />

        {/* Floating orbs */}
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-[#3db9cf]/10 rounded-full blur-3xl float" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#8b5cf6]/10 rounded-full blur-3xl float animation-delay-300" />

        <div className="relative z-10 text-center">
          {/* Animated loader */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3db9cf] to-[#8b5cf6] animate-pulse" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3db9cf] to-[#8b5cf6] opacity-50 blur-xl animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Gauge className="w-10 h-10 text-white" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 animated-gradient opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_rgba(61,185,207,0.12),_transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,_rgba(139,92,246,0.08),_transparent)]" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#3db9cf]/8 rounded-full blur-3xl float" />
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-[#8b5cf6]/8 rounded-full blur-3xl float animation-delay-300" />
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-[#e879a9]/6 rounded-full blur-3xl float animation-delay-500" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Header */}
          <header className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#3db9cf] to-[#8b5cf6] shadow-lg shadow-[#3db9cf]/15">
                <Gauge className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg gradient-text">SNS Marketing</span>
            </div>
          </header>

          {/* Hero section */}
          <main className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left side - Text content */}
                <div className="space-y-8 fade-in-up">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm">
                      <Sparkles className="w-4 h-4 text-[#3db9cf]" />
                      <span className="text-muted-foreground">AI-Powered Automation</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                      <span className="gradient-text">Automate</span>
                      <br />
                      <span className="text-foreground">Your Social Media</span>
                      <br />
                      <span className="text-foreground">Marketing</span>
                    </h1>

                    <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                      Streamline your social media presence with AI-powered content creation,
                      scheduling, and analytics. Manage multiple accounts effortlessly.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-[#3db9cf] to-[#8b5cf6] hover:from-[#4bc5db] hover:to-[#9d6ff8] text-white border-0 shadow-lg shadow-[#3db9cf]/20 transition-all duration-300 hover:shadow-[#3db9cf]/30 hover:scale-[1.01] h-14 px-8 text-base"
                      asChild
                    >
                      <a href={getLoginUrl()}>
                        Get Started
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-white/10 hover:bg-white/5 hover:border-white/20 h-14 px-8 text-base"
                    >
                      Learn More
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-8 pt-4">
                    <div>
                      <p className="text-3xl font-bold gradient-text">10K+</p>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold gradient-text">50M+</p>
                      <p className="text-sm text-muted-foreground">Posts Scheduled</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold gradient-text">99.9%</p>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </div>
                  </div>
                </div>

                {/* Right side - Feature cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <FeatureCard
                    icon={Bot}
                    title="AI Content Generation"
                    description="Generate engaging content with advanced AI that understands your brand voice."
                    delay={100}
                  />
                  <FeatureCard
                    icon={Users}
                    title="Multi-Account Management"
                    description="Manage all your social media accounts from a single, unified dashboard."
                    delay={200}
                  />
                  <FeatureCard
                    icon={BarChart3}
                    title="Advanced Analytics"
                    description="Track performance metrics and optimize your strategy with data insights."
                    delay={300}
                  />
                  <FeatureCard
                    icon={Shield}
                    title="Account Protection"
                    description="Built-in freeze detection and automated recovery to keep accounts safe."
                    delay={400}
                  />
                </div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 SNS Marketing Automation. All rights reserved.
            </p>
          </footer>
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
        <Route path="/model-accounts" component={ModelAccounts} />
        <Route path="/buzz-analysis" component={BuzzAnalysis} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:id" component={AgentDetail} />
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
