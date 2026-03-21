"use client";

interface ExpoBarProps {
  text: string | null;
  active: boolean;
  hasTicket?: boolean;
  ticketExpanded?: boolean;
  onToggleTicket?: () => void;
}

export function ExpoBar({
  text,
  active,
  hasTicket = false,
  ticketExpanded = false,
  onToggleTicket,
}: ExpoBarProps) {
  if (!text) return null;

  const showToggle = !active && hasTicket;

  return (
    <div
      className={`
        flex items-center gap-2.5 px-4 py-2
        transition-all duration-300 ease-in-out
        ${text ? "opacity-100 max-h-12" : "opacity-0 max-h-0"}
      `}
    >
      {active ? (
        <div className="flex items-center gap-1">
          <span className="expo-dot-1 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-2 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-3 inline-block size-[6px] rounded-full bg-primary" />
        </div>
      ) : (
        <span className="inline-block size-[6px] rounded-full bg-emerald-500" />
      )}
      <span
        className={`text-xs leading-tight truncate flex-1 ${
          active
            ? "italic text-primary/80"
            : "font-medium text-emerald-400/80"
        }`}
      >
        {text}
      </span>
      {showToggle && (
        <button
          type="button"
          onClick={onToggleTicket}
          className="text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors px-1"
          style={{ fontSize: "8px", lineHeight: 1 }}
          aria-label={ticketExpanded ? "Collapse ticket" : "Expand ticket"}
        >
          {ticketExpanded ? "\u25B2" : "\u25BC"}
        </button>
      )}
    </div>
  );
}
