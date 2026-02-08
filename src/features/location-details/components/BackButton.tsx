import { ChevronLeftIcon } from '@heroicons/react/24/solid';

interface BackButtonProps {
  onClick: () => void;
}

export default function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Go back"
      className="
        flex items-center justify-center mb-2
        h-9 w-9 rounded-full
        bg-[var(--color-header)] text-white
        border border-[color:var(--color-body)]
        hover:bg-[var(--color-primary-dark)]
        transition-colors duration-200
      "
    >
      <ChevronLeftIcon className="w-6 h-6" />
    </button>
  );
}
