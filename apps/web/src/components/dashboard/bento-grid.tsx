import { type ReactNode } from "react";

interface BentoItemProps {
  children: ReactNode;
  className?: string;
  span?: "1x1" | "2x1" | "1x2" | "2x2";
}

const spanClasses = {
  "1x1": "",
  "2x1": "sm:col-span-2",
  "1x2": "sm:row-span-2",
  "2x2": "sm:col-span-2 sm:row-span-2",
};

export function BentoItem({ children, className = "", span = "1x1" }: BentoItemProps) {
  return (
    <div className={`${spanClasses[span]} ${className}`}>
      {children}
    </div>
  );
}

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {children}
    </div>
  );
}
