import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { setAccessToken } from "@/services/api";

export default function GoogleCallbackPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();

  useEffect(() => {
    refresh().then((user) => {
      if (user) {
        navigate("/chat");
        return;
      }
        setAccessToken(null);
        navigate("/login");
      });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-semibold">Signing you in...</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Completing Google authentication.
        </p>
      </div>
    </div>
  );
}
