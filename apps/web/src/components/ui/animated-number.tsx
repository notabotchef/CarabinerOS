"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 1,
  className,
  formatOptions,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const prevValue = useRef(0);

  const displayed = useTransform(motionValue, (v) => {
    const formatted = formatOptions
      ? v.toLocaleString("en-US", formatOptions)
      : Math.round(v).toLocaleString("en-US");
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
    });
    prevValue.current = value;
    return controls.stop;
  }, [value, duration, motionValue]);

  return (
    <motion.span className={className}>
      {displayed}
    </motion.span>
  );
}
