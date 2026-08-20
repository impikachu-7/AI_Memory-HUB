import { useEffect } from "react";
import { useLocation } from "wouter";
import { api, setAccessToken } from "@/services/api";

export default function GoogleCallbackPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("access_token");

    if (!token) {
      navigate("/login");
      return;
    }

    setAccessToken(token);

    api.auth.me()
      .then(() => navigate("/chat"))
      .catch(() => {
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
