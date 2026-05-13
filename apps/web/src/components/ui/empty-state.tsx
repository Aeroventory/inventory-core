import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-[#D9E4DD] bg-[#F7FAF8] p-8 text-center",
        className,
      )}
    >
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#E3F6EC] text-[#00684A]">
          <Icon size={20} />
        </div>
        <p className="font-medium text-[#10231B]">{title}</p>
        <p className="mt-1 max-w-md text-sm text-[#5B6B63]">{description}</p>
      </div>
    </div>
  );
}
