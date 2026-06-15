// Billing period number — months since December 1999
// Used when querying SOAP data for a specific billing month
export function getBillingNo(date: Date): number {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDate = new Date(1999, 11, 1); // Dec 1999
  const months =
    (monthStart.getFullYear() - startDate.getFullYear()) * 12 +
    (monthStart.getMonth() - startDate.getMonth());
  return months + 1;
}

export function getBillingDate(billingNo: number): Date {
  const startDate = new Date(1999, 11, 1);
  return new Date(
    startDate.getFullYear(),
    startDate.getMonth() + billingNo - 1,
    1
  );
}
