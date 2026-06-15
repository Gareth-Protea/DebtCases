import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AdminLoginPage from "@/pages/admin-login-page";
import DashboardPage from "@/pages/dashboard-page";

// ── Arrears Manager Pages ─────────────────────────────────────
import ArrearsHomePage from "@/pages/arrears-manager/arrears-home-page";

// ── Debt Manager Pages ────────────────────────────────────────
import DebtHomePage from "@/pages/debt-manager/debt-home-page";
import MasterListPage from "@/pages/debt-manager/master-list-page";
import AgentListPage from "@/pages/debt-manager/agent-list-page";
import ReportsPage from "@/pages/debt-manager/reports-page";
import ObjectivesPage from "@/pages/debt-manager/objectives-page";
import ProfilePage from "@/pages/debt-manager/profile-page";
import DebtorCasePage from "@/pages/debt-manager/debtor-case-page";
import ShopPage from "./pages/debt-manager/shop-page";
import ManagerSettingsPage from "@/pages/debt-manager/manager-settings-page";


function Router() {
  return (
    <WouterRouter>
      <Switch>
        <Route path="/" component={AdminLoginPage} />
        <Route path="/dashboard" component={DashboardPage} />

        {/* Arrears Manager routes */}
        <Route path="/arrears-manager" component={ArrearsHomePage} />

        {/* Debt Manager routes */}
        <Route path="/debt-manager" component={DebtHomePage} />
        <Route path="/debt-manager/master-list" component={MasterListPage} />
        <Route path="/debt-manager/agent-list" component={AgentListPage} />
        <Route path="/debt-manager/reports" component={ReportsPage} />
        <Route path="/debt-manager/objectives" component={ObjectivesPage} />
        <Route path="/debt-manager/profile" component={ProfilePage} />
        <Route path="/debt-manager/debtors/:id" component={DebtorCasePage} />
        <Route path="/debt-manager/shop" component={ShopPage} />
        <Route path="/debt-manager/manager-settings" component={ManagerSettingsPage} />

        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}
