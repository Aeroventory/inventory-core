import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftSlot, ...props }, ref) => {
    return (
      <div className="relative">
        {leftSlot && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6B63]">
            {leftSlot}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "h-10 w-full rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm text-[#10231B] outline-none transition placeholder:text-[#8A9A92] focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]",
            leftSlot && "pl-9",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
