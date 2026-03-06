import type { ReactNode } from 'react';

export function EngravedHeader({
  title,
  eyebrow,
  detail,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="engraved-header">
      <div className="engraved-header-copy">
        {eyebrow ? <span className="engraved-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {actions ? <div className="engraved-header-actions">{actions}</div> : null}
    </header>
  );
}
