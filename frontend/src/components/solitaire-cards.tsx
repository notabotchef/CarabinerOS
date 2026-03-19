"use client";

import { motion, type Variants } from "framer-motion";

const CARDS = [
  {
    label: "Orders",
    value: "3",
    subtitle: "1 needs approval",
    subtitleColor: "text-primary",
    rotation: -4,
  },
  {
    label: "Food Cost",
    value: "28.4%",
    subtitle: "\u2193 1.2%",
    subtitleColor: "text-emerald-500",
    rotation: -1,
  },
  {
    label: "Prep",
    value: "12/18",
    subtitle: "6 remaining",
    subtitleColor: "text-muted-foreground",
    rotation: 2,
  },
  {
    label: "Covers",
    value: "142",
    subtitle: "proj. 185",
    subtitleColor: "text-muted-foreground",
    rotation: 5,
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  }),
};

export function SolitaireCards() {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      {CARDS.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          whileHover={{
            scale: 1.05,
            rotate: 0,
            y: -2,
            transition: { type: "spring", stiffness: 400, damping: 25 },
          }}
          style={{ rotate: card.rotation }}
          className="
            w-[120px] rounded-xl border border-border bg-card
            px-4 py-5
            shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_8px_rgba(0,0,0,0.08)]
            hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.12)]
            flex flex-col items-center text-center
            select-none cursor-default
            transition-shadow duration-300
          "
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {card.label}
          </span>
          <span className="mt-1 text-2xl font-bold text-foreground tabular-nums">
            {card.value}
          </span>
          <span className={`mt-0.5 text-[11px] font-medium ${card.subtitleColor}`}>
            {card.subtitle}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
