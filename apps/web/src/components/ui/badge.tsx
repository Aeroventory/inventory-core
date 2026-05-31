import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        green: "border-[#B6E8CC] bg-[#E3F6EC] text-[#00684A]",
        neutral: "border-[#D9E4DD] bg-[#F7FAF8] text-[#5B6B63]",
        warning: "border-[#F4D7A2] bg-[#FFF7E6] text-[#B7791F]",
        danger: "border-[#F7B8A4] bg-[#FFF1ED] text-[#C2410C]",
        blue: "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]",
        purple: "border-[#D7C5FF] bg-[#F3EEFF] text-[#6D28D9]",
      },
    },
    defaultVariants: {
      tone: "green",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean;
}

export function Badge({ className, tone, withDot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, className }))} {...props}>
      {withDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
