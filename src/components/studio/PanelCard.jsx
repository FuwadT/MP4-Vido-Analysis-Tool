import React from 'react';
import clsx from 'clsx';

export function PanelCard({
  title,
  subtitle,
  eyebrow,
  children,
  actions,
  footer,
  className,
  contentClassName,
  padded = true,
  tone = 'default'
}) {
  return (
    <section
      className={clsx(
        'group relative overflow-hidden rounded-[28px] border bg-slate-950/78 shadow-[0_22px_60px_rgba(2,6,23,0.32)] backdrop-blur',
        tone === 'brand' && 'border-emerald-400/30',
        tone === 'warning' && 'border-amber-400/30',
        tone === 'default' && 'border-slate-800/90',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {(title || subtitle || eyebrow || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{eyebrow}</div>
            )}
            {title && (
              <h3 className="mt-1 text-lg font-semibold text-slate-100">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded ? 'px-5 py-5' : '', contentClassName)}>
        {children}
      </div>
      {footer && (
        <footer className="border-t border-slate-800/80 px-5 py-4 text-sm text-slate-400">
          {footer}
        </footer>
      )}
    </section>
  );
}
