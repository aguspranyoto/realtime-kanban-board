"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type { AuthResponse } from "@/lib/types";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    // Parse token from hash fragment (#access_token=...)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const accessToken = params.get("access_token");

    if (!accessToken) {
      toast.error("Google authentication failed: Token not found");
      router.push("/");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.post<AuthResponse>("/api/auth/google", {
          token: accessToken,
        });

        localStorage.setItem("token", res.data.token);
        setUser(res.data.user);
        toast.success("Signed in with Google successfully!");
        router.push("/dashboard");
      } catch (err) {
        console.error("Google auth callback error:", err);
        toast.error("Failed to authenticate with Google");
        router.push("/");
      }
    };

    verifyToken();
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
        <p className="text-muted-foreground">Completing Google sign-in...</p>
      </div>
    </div>
  );
}
