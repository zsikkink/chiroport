import { ChevronLeftIcon } from '@heroicons/react/24/solid';

interface BackButtonProps {
  onClick: () => void;
}

export default function BackButton({ onClick }: BackButtonProps) {
  return (
    <button onClick={onClick} aria-label="Go back" className="text-slate-600 flex items-center mb-2 hover:text-slate-800">
      <ChevronLeftIcon className="w-6 h-6" />
    </button>
  );
}
