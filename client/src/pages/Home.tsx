import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Streamdown } from 'streamdown';

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF7]">
      <main className="p-8">
        {/* Example: lucide-react for icons */}
        <div className="mb-4 p-4 bg-[#FFD700] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] inline-block">
          <Loader2 className="animate-spin text-[#1A1A1A]" />
        </div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-4">Example Page</h1>
        {/* Example: Streamdown for markdown rendering */}
        <div className="mb-4 p-4 bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]">
          <Streamdown>Any **markdown** content</Streamdown>
        </div>
        <Button variant="default" className="bg-[#FFD700] hover:bg-[#FFED4A] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] font-bold">Example Button</Button>
      </main>
    </div>
  );
}
