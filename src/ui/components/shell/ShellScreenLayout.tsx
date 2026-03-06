import type { ReactNode } from 'react';
import { TableSurface } from '../../layout/TableSurface.tsx';
import { PaperSheet } from '../../layout/PaperSheet.tsx';
import { EngravedHeader } from '../../layout/EngravedHeader.tsx';
import './shell-screen-layout.css';

interface ShellScreenLayoutProps {
  eyebrow: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  presentation?: 'page' | 'modal';
  tableClassName?: string;
  boardClassName?: string;
}

export function ShellScreenLayout({
  eyebrow,
  title,
  detail,
  actions,
  children,
  presentation = 'page',
  tableClassName = '',
  boardClassName = '',
}: ShellScreenLayoutProps) {
  const content = (
    <PaperSheet tone="board" className={['shell-board', 'shell-surface', 'shell-surface-focus', boardClassName].filter(Boolean).join(' ')}>
      <EngravedHeader eyebrow={eyebrow} title={title} detail={detail} actions={actions} />
      {children}
    </PaperSheet>
  );

  if (presentation === 'modal') {
    return <div className="shell-screen-layout-modal shell-table">{content}</div>;
  }

  return (
    <TableSurface className={['shell-table', 'shell-depth-surface', tableClassName].filter(Boolean).join(' ')}>
      {content}
    </TableSurface>
  );
}
