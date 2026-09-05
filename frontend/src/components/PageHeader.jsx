export default function PageHeader({ title, subtitle, children, testid }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5" data-testid={testid}>
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
