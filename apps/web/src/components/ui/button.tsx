import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "border-[#00684A] bg-[#00684A] text-white shadow-[0_10px_22px_rgba(0,104,74,0.16)] hover:border-[#00523A] hover:bg-[#00523A] focus-visible:ring-[rgba(0,104,74,0.18)]",
        secondary:
          "border-[#D9E4DD] bg-white text-[#10231B] hover:border-[#B8C9BF] hover:bg-[#F7FAF8] focus-visible:ring-[rgba(0,104,74,0.12)]",
        soft:
          "border-[#B6E8CC] bg-[#E3F6EC] text-[#00684A] hover:bg-[#D8F0E4] focus-visible:ring-[rgba(0,104,74,0.14)]",
        ghost:
          "border-transparent bg-transparent text-[#00684A] hover:bg-[#E3F6EC] focus-visible:ring-[rgba(0,104,74,0.12)]",
        warning:
          "border-[#B7791F] bg-[#B7791F] text-white hover:bg-[#996516] focus-visible:ring-[rgba(183,121,31,0.18)]",
        danger:
          "border-[#B91C1C] bg-[#B91C1C] text-white hover:bg-[#991B1B] focus-visible:ring-[rgba(185,28,28,0.18)]",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
