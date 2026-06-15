export const API_BASE = `/api`;

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Admin Auth ────────────────────────────────────────────────
export interface AdminUser {
  personId: number;
  username: string;
  accessLevel: number;
}

export const adminApi = {
  login: (data: { username: string; password: string }) =>
    apiRequest<AdminUser>(`${API_BASE}/admin/login`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    apiRequest<{ ok: boolean }>(`${API_BASE}/admin/logout`, {
      method: "POST",
    }),
  me: () => apiRequest<AdminUser>(`${API_BASE}/admin/me`),
};

// ── Arrears Manager APIs ──────────────────────────────────────
export const arrearsApi = {
  getRecords: () =>
    apiRequest<any[]>(`${API_BASE}/arrears-manager/records`),
  // Add more arrears API methods here
};

// ── Debt Manager APIs ─────────────────────────────────────────
export const debtApi = {
  getRecords: () =>
    apiRequest<any[]>(`${API_BASE}/debt-manager/records`),
  // Add more debt API methods here
};
