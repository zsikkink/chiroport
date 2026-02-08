import { Button } from '@/components/ui';

type StatusBarProps = {
  locationName?: string | null;
  userEmail?: string | null;
  role?: string | null;
  actionError?: string;
  onSignOut: () => void;
  offsetForMenu: boolean;
};

export function StatusBar({
  locationName,
  userEmail,
  role,
  actionError,
  onSignOut,
  offsetForMenu,
}: StatusBarProps) {
  return (
    <header className={`flex flex-col gap-3 ${offsetForMenu ? 'pl-16' : ''}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="hidden sm:block" />
        <h1 className="text-center text-3xl font-libre-baskerville">
          Employee Dashboard
          {locationName ? ` · ${locationName}` : ''}
        </h1>
        <div className="flex justify-center sm:justify-end">
          <Button variant="secondary" onClick={onSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
      <p className="text-center text-sm text-slate-500">
        Signed in as {userEmail} ({role})
      </p>
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
    </header>
  );
}
