import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--theme-color)] text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--theme-color)_24%,transparent)] hover:brightness-105",
  secondary:
    "border border-gray-200 bg-white text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppButton({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AppIconButton({
  label,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function AppCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(49,27,18,0.04)] dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

export function AppBadge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    info: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export const appControlClass =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm outline-none transition hover:border-gray-300 focus:border-[var(--theme-color)] focus:ring-2 focus:ring-[var(--theme-color)]/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700";

export function AppPageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <AppCard className={cn("flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)] ring-1 ring-[var(--theme-color)]/15">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">{eyebrow}</p>}
          <h2 className="mt-0.5 text-xl font-black tracking-tight text-gray-950 dark:text-white sm:text-2xl">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500 dark:text-zinc-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center [&>button]:w-full [&>select]:w-full sm:[&>button]:w-auto sm:[&>select]:w-auto">{actions}</div>}
    </AppCard>
  );
}

export function AppSectionHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-[var(--theme-color)]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-base font-black text-gray-950 dark:text-white">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center [&>button]:w-full [&>select]:w-full sm:[&>button]:w-auto sm:[&>select]:w-auto">{actions}</div>}
    </div>
  );
}

export function AppToolbar({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-zinc-800 dark:bg-white/[0.025] sm:flex-row sm:flex-wrap sm:items-center [&>button]:w-full [&>input]:w-full [&>select]:w-full sm:[&>button]:w-auto sm:[&>input]:w-auto sm:[&>select]:w-auto", className)}>
      {children}
    </div>
  );
}

export function AppEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-white/[0.02]", className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500">{icon}</div>}
      <h3 className="text-sm font-black text-gray-800 dark:text-zinc-100">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AppLoadingState({ label = "Carregando módulo..." }: { label?: string }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-3 w-24 rounded-full bg-gray-200 dark:bg-zinc-800" />
        <div className="mt-3 h-7 w-72 max-w-full rounded-lg bg-gray-200 dark:bg-zinc-800" />
        <div className="mt-3 h-3 w-[420px] max-w-full rounded-full bg-gray-100 dark:bg-zinc-800/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-3 w-20 rounded-full bg-gray-100 dark:bg-zinc-800" />
            <div className="mt-4 h-7 w-32 rounded-lg bg-gray-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
