"use client";

interface ExpoBarProps {
  text: string | null;
  active: boolean;
}

export function ExpoBar({ text, active }: ExpoBarProps) {
  if (!text) return null;

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2
        transition-all duration-300 ease-in-out
        ${text ? "opacity-100 max-h-12" : "opacity-0 max-h-0"}
      `}
    >
      {active ? (
        /* Three animated amber dots */
        <div className="flex items-center gap-1">
          <span className="expo-dot-1 inline-block size-[6px] rounded-full bg-amber-500" />
          <span className="expo-dot-2 inline-block size-[6px] rounded-full bg-amber-500" />
          <span className="expo-dot-3 inline-block size-[6px] rounded-full bg-amber-500" />
        </div>
      ) : (
        /* Green completion dot */
        <span className="inline-block size-[6px] rounded-full bg-emerald-500" />
      )}
      <span
        className={`text-xs leading-tight ${
          active
            ? "italic text-amber-600/80"
            : "text-emerald-600/80"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
