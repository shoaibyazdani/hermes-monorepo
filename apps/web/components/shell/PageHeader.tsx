import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Coordinate-style metadata rendered on the right. */
  meta?: Array<{ label: string; value: string }>;
  /** Controls rendered below the metadata on narrow screens. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader — the standard heading band for a route.
 *
 * One per page, so every route names itself the same way and the metadata
 * strip stays visually aligned across the system.
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-none flex-wrap items-end gap-x-6 gap-y-3 border-b border-line-soft px-3 py-3 sm:px-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <h1 className="t-section-title text-ink">{title}</h1>
        {subtitle && <p className="t-meta mt-1.5 truncate">{subtitle}</p>}
      </div>

      {meta && meta.length > 0 && (
        <dl className="flex flex-none flex-wrap items-baseline gap-x-5 gap-y-1">
          {meta.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <dt className="t-label">{m.label}</dt>
              <dd
                className="font-data text-xs font-bold tabular-nums text-hud-cyan"
                suppressHydrationWarning
              >
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  );
}
