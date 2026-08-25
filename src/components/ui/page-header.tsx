// One page title treatment for the whole app. Before this, each page
// hand-rolled its own heading block and they had drifted apart in spacing,
// description styling and where the action buttons sat.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  // Small tracked-out label above the title ("FINANCEBOT"). Optional and
  // used sparingly — on every page it would just be ambient noise, since the
  // sidebar already says what app this is; it earns its place on the
  // dashboard, where it stands in for a "you are here" line.
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-primary mb-1 text-xs font-semibold tracking-[0.14em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
