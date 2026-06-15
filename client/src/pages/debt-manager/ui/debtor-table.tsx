import { ArrowUpRight, Phone, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DebtorTableRow {
  id: string;
  name: string;
  accountNumber: string;
  contactName: string;
  phone: string;
  area: string;
  daysSinceTermination: number;
  outstandingBalance: number;
  assignedTo?: string | null;
  status: "Unassigned" | "Assigned" | "Promise to Pay" | "Escalated";
  priority: "High" | "Medium" | "Low";
}

interface DebtorTableProps {
  title: string;
  description: string;
  debtors: DebtorTableRow[];
}

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const priorityStyles = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-accent/15 text-[hsl(341,72%,42%)] border-accent/30",
  Low: "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
};

const statusStyles = {
  Unassigned: "bg-muted text-muted-foreground border-border",
  Assigned: "bg-primary/8 text-primary border-primary/15",
  "Promise to Pay": "bg-secondary/10 text-[hsl(142,100%,28%)] border-secondary/20",
  Escalated: "bg-destructive/10 text-destructive border-destructive/20",
};

export function DebtorTable({
  title,
  description,
  debtors,
}: DebtorTableProps) {
  const totalBalance = debtors.reduce(
    (sum, debtor) => sum + debtor.outstandingBalance,
    0,
  );

  return (
    <Card className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {title}
            </CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Accounts
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {debtors.length}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total value
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {currency.format(totalBalance)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-border/70 text-sm">
            <thead className="bg-muted/35">
              <tr className="text-left text-muted-foreground">
                <th className="px-6 py-4 font-medium">Debtor</th>
                <th className="px-6 py-4 font-medium">Account</th>
                <th className="px-6 py-4 font-medium">Area</th>
                <th className="px-6 py-4 font-medium">Days</th>
                <th className="px-6 py-4 font-medium">Balance</th>
                <th className="px-6 py-4 font-medium">Assigned</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {debtors.map((debtor) => (
                <tr
                  key={debtor.id}
                  className="border-t border-border/70 transition hover:bg-muted/20"
                >
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{debtor.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserCircle2 className="h-3.5 w-3.5" />
                        {debtor.contactName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {debtor.phone}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {debtor.accountNumber}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {debtor.area}
                  </td>

                  <td className="px-6 py-4 font-medium text-foreground">
                    {debtor.daysSinceTermination}
                  </td>

                  <td className="px-6 py-4 font-medium text-foreground">
                    {currency.format(debtor.outstandingBalance)}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {debtor.assignedTo ?? "—"}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[debtor.status]}`}
                    >
                      {debtor.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[debtor.priority]}`}
                    >
                      {debtor.priority}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="rounded-xl">
                      Open
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}