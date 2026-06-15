import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminUser } from "@/lib/api";
import { useLocation } from "wouter";

export function useAuth() {
  const [, setLocation] = useLocation();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<AdminUser>({
    queryKey: ["admin-me"],
    queryFn: () => adminApi.me(),
    retry: false,
  });

  const isAuthenticated = !!user && !error;

  const redirectToLogin = () => {
    setLocation("/");
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    redirectToLogin,
  };
}
