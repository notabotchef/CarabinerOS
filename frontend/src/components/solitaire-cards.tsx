"use client";

const CARDS = [
  {
    label: "Orders",
    value: "3",
    subtitle: "1 needs approval",
    subtitleColor: "text-amber-600",
    rotation: "-rotate-[4deg]",
  },
  {
    label: "Food Cost",
    value: "28.4%",
    subtitle: "\u2193 1.2%",
    subtitleColor: "text-emerald-600",
    rotation: "-rotate-[1deg]",
  },
  {
    label: "Prep",
    value: "12/18",
    subtitle: "6 remaining",
    subtitleColor: "text-neutral-500",
    rotation: "rotate-[2deg]",
  },
  {
    label: "Covers",
    value: "142",
    subtitle: "proj. 185",
    subtitleColor: "text-neutral-500",
    rotation: "rotate-[5deg]",
  },
];

export function SolitaireCards() {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      {CARDS.map((card) => (
        <div
          key={card.label}
          className={`
            ${card.rotation}
            w-[120px] rounded-xl border border-neutral-200 bg-white
            px-4 py-5 shadow-sm
            transition-transform duration-300 hover:scale-105 hover:rotate-0
            hover:shadow-md
            flex flex-col items-center text-center
            select-none
          `}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {card.label}
          </span>
          <span className="mt-1 text-2xl font-bold text-neutral-900">
            {card.value}
          </span>
          <span className={`mt-0.5 text-[11px] font-medium ${card.subtitleColor}`}>
            {card.subtitle}
          </span>
        </div>
      ))}
    </div>
  );
}
