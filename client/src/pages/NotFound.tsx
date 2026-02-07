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
        <div className="bg-white rounded-lg border border-[#E5E5E5] p-8">
          <AlertCircle className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />

          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-1">404</h1>

          <h2 className="text-sm font-semibold text-[#525252] mb-3">
            Page Not Found
          </h2>

          <p className="text-xs text-[#A3A3A3] mb-6 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <Button
            onClick={handleGoHome}
            className="bg-[#D4380D] hover:bg-[#B8300B] text-white px-6 h-9 text-sm font-medium"
          >
            <Home className="w-3.5 h-3.5 mr-1.5" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
