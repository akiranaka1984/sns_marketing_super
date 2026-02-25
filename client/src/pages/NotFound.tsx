import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-full max-w-md mx-4 text-center">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-8">
          <AlertCircle className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />

          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-1">404</h1>

          <h2 className="text-sm font-bold text-[#6B6B6B] mb-3">
            Page Not Found
          </h2>

          <p className="text-xs text-[#6B6B6B] mb-6 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <Button
            onClick={handleGoHome}
            className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] px-6 h-9 text-sm font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <Home className="w-3.5 h-3.5 mr-1.5" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
