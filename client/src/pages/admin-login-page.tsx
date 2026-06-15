import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import mainLogo from "@assets/Main_Logo_1765460351436.png";
import flowerIllustration from "@assets/Protea_Metering_Flower_Illustration_Primary_Blue_1753699888326_1765460365313.png";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      adminApi.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-me"] });
      setLocation("/dashboard");
    },
    onError: (err: Error) => {
      setError(err.message || "Login failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background flower illustration — subtle watermark */}
      <img
        src={flowerIllustration}
        alt=""
        className="absolute right-[-8%] bottom-[-10%] w-137.5 opacity-[0.04] pointer-events-none select-none"
      />
      <img
        src={flowerIllustration}
        alt=""
        className="absolute left-[-8%] top-[-10%] w-100 opacity-[0.03] pointer-events-none select-none rotate-180"
      />

      {/* Login card */}
      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={mainLogo} alt="Protea Metering" className="h-16 w-auto" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-primary">
              Arrears & Debt Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in with your Protea Metering credentials
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="h-11 bg-gray-50 border-gray-300 focus:border-primary focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 bg-gray-50 border-gray-300 focus:border-primary focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center bg-red-50 rounded-lg py-2 px-3">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-primary text-white font-semibold hover:bg-primary/90 rounded-lg"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Protea Metering &middot; Premier Utility Solutions
        </p>
      </div>
    </div>
  );
}
