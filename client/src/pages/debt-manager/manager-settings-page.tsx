import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtAppShell } from "./ui/debt-app-shell";
import { DebtPageHeader } from "./ui/debt-page-header";

interface ManagerSettings {
  dailyTargetPerAgent: number;
  maxOpenCasesPerAgent: number;
  targetUnassignedPool: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Simple API helper to fetch JSON with credentials.
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function ManagerSettingsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<ManagerSettings>({
    dailyTargetPerAgent: 5,
    maxOpenCasesPerAgent: 10,
    targetUnassignedPool: 5,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load current settings from server
  const settingsQuery = useQuery({
    queryKey: ["debt-manager", "manager-settings"],
    queryFn: () =>
      apiRequest<ApiResponse<ManagerSettings>>(
        "/api/debt-manager/manager-settings",
      ),
    onSuccess: (resp) => {
      if (resp.success && resp.data) {
        setFormState(resp.data);
      }
    },
  });

  // Mutation to update settings
  const updateMutation = useMutation({
    mutationFn: (values: ManagerSettings) =>
      apiRequest<ApiResponse<ManagerSettings>>(
        "/api/debt-manager/manager-settings",
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      ),
    onSuccess: (resp) => {
      if (resp.success) {
        queryClient.invalidateQueries(["debt-manager", "manager-settings"]);
        setStatusMessage("Settings updated successfully.");
      } else {
        setStatusMessage(resp.message ?? "Failed to update settings.");
      }
    },
    onError: (error: any) => {
      setStatusMessage(error?.message ?? "Failed to update settings.");
    },
  });

  // Mutation to run daily import
  const importMutation = useMutation({
    mutationFn: () =>
      apiRequest<ApiResponse<any>>(
        "/api/debt-manager/manager-settings/import",
        {
          method: "POST",
        },
      ),
    onSuccess: (resp) => {
      if (resp.success) {
        setStatusMessage(
          resp.message ||
            "Import completed. New cases have been pulled into the action page.",
        );
      } else {
        setStatusMessage(resp.message ?? "Failed to run import.");
      }
    },
    onError: (error: any) => {
      setStatusMessage(error?.message ?? "Failed to run import.");
    },
  });

  const handleChange = (field: keyof ManagerSettings, value: string) => {
    const num = Number(value);
    setFormState((prev) => ({ ...prev, [field]: Number.isFinite(num) ? num : 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formState);
  };

  return (
    <DebtAppShell>
      <DebtPageHeader
        badge="Settings"
        title="Manager settings"
        description="Configure daily import limits and case assignment thresholds. Changes apply immediately across the system."
      />
      <div className="max-w-2xl space-y-6 p-4 md:p-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Daily import & assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground" htmlFor="dailyTargetPerAgent">
                    Daily target per agent
                  </label>
                  <Input
                    id="dailyTargetPerAgent"
                    type="number"
                    min={1}
                    value={formState.dailyTargetPerAgent}
                    onChange={(e) => handleChange("dailyTargetPerAgent", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of new cases each collector receives per day.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground" htmlFor="maxOpenCasesPerAgent">
                    Max open cases per agent
                  </label>
                  <Input
                    id="maxOpenCasesPerAgent"
                    type="number"
                    min={1}
                    value={formState.maxOpenCasesPerAgent}
                    onChange={(e) => handleChange("maxOpenCasesPerAgent", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total active cases a collector can hold concurrently.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground" htmlFor="targetUnassignedPool">
                    Unassigned pool size
                  </label>
                  <Input
                    id="targetUnassignedPool"
                    type="number"
                    min={0}
                    value={formState.targetUnassignedPool}
                    onChange={(e) => handleChange("targetUnassignedPool", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many cases remain in the unassigned pool after import.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isLoading}>
                  {updateMutation.isLoading ? "Saving..." : "Save settings"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isLoading}
                >
                  {importMutation.isLoading ? "Importing..." : "Run daily import now"}
                </Button>
              </div>
              {statusMessage ? (
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </DebtAppShell>
  );
}