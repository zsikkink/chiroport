import type { ReactNode } from 'react';
import { ResponsiveCard, Heading } from '@/components/ui';

type QueueColumnProps = {
  title: string;
  emptyLabel: string;
  isEmpty: boolean;
  children?: ReactNode;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  headerAction?: ReactNode;
  useCardTitle?: boolean;
  itemsClassName?: string;
  cardClassName?: string;
};

export function QueueColumn({
  title,
  emptyLabel,
  isEmpty,
  children,
  onDragOver,
  onDrop,
  headerAction,
  useCardTitle = false,
  itemsClassName = 'space-y-4',
  cardClassName = 'h-full min-h-[calc(100vh-260px)]',
}: QueueColumnProps) {
  const content = (
    <>
      {!useCardTitle ? (
        <div className="mb-3 flex items-center justify-between">
          <Heading className="text-slate-900">{title}</Heading>
          {headerAction}
        </div>
      ) : null}
      {isEmpty ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className={itemsClassName}>{children}</div>
      )}
    </>
  );

  return (
    <div onDragOver={onDragOver} onDrop={onDrop}>
      {useCardTitle ? (
        <ResponsiveCard title={title} className={cardClassName}>
          {content}
        </ResponsiveCard>
      ) : (
        <ResponsiveCard className={cardClassName}>{content}</ResponsiveCard>
      )}
    </div>
  );
}
