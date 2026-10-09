import { OperationsShell } from "@/components/operations-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";

export default function CatalogOperationsPage() {
  return (
    <OperationsShell>
      <OperationsDashboard />
    </OperationsShell>
  );
}
