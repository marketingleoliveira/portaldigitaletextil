import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = LEAD_STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", config.color, className)}>
      {config.label}
    </span>
  );
}
