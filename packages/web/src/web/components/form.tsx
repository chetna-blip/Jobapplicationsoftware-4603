import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow">{label}</span>
      {hint && <span className="mt-1 block text-xs text-muted-foreground/80">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

/** Chip list with a free-text add box — used for titles, locations, industries, links. */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
  }

  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          className="grid size-[42px] shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          aria-label="Add"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-foreground"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            From your resume
          </span>
          {open.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-3.5 py-2 text-sm transition-colors",
            value === o.value
              ? "border-primary bg-primary/12 text-foreground"
              : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-md border border-border bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-primary/40"
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary/30" : "border-border bg-background",
        )}
      >
        <span
          className={cn(
            "size-3.5 rounded-full transition-transform",
            checked ? "translate-x-[18px] bg-primary" : "translate-x-[3px] bg-muted-foreground",
          )}
        />
      </span>
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}
