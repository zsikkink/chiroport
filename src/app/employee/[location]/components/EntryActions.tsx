import { memo } from 'react';
import type { MenuEntry } from '../types';

type EntryActionsProps = {
  entry: MenuEntry;
  isDeleteBusy: boolean;
  menuOpen: boolean;
  canMove: boolean;
  onCloseMenu: () => void;
  onMove: (entry: MenuEntry) => void;
  onEdit: (entry: MenuEntry) => void;
  onDelete: (entryId: string) => void;
};

export const EntryActions = memo(function EntryActions({
  entry,
  isDeleteBusy,
  menuOpen,
  canMove,
  onCloseMenu,
  onMove,
  onEdit,
  onDelete,
}: EntryActionsProps) {
  if (!menuOpen) return null;
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-20 cursor-default"
        onClick={onCloseMenu}
        aria-label="Close menu"
      />
      <div className="absolute right-0 top-7 z-30 w-36 rounded-lg bg-white text-black opacity-100 shadow-xl ring-1 ring-black/20">
        {canMove ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => onMove(entry)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M12 4v16" />
              <path d="M4 12h16" />
              <path d="M12 4l-3 3" />
              <path d="M12 4l3 3" />
              <path d="M12 20l-3-3" />
              <path d="M12 20l3-3" />
              <path d="M4 12l3-3" />
              <path d="M4 12l3 3" />
              <path d="M20 12l-3-3" />
              <path d="M20 12l-3 3" />
            </svg>
            <span>Move</span>
          </button>
        ) : null}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5"
          onClick={() => onEdit(entry)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          disabled={isDeleteBusy}
          onClick={() => onDelete(entry.queue_entry_id)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </>
  );
});
