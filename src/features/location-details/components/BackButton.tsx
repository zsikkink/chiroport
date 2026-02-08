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
        mb-2 inline-flex items-center justify-center
        p-0
        text-slate-900
        hover:text-black
        transition-colors duration-200
        !shadow-none hover:!shadow-none active:!shadow-none
        hover:!translate-y-0 active:!translate-y-0
        focus:outline-none
      "
    >
      <ChevronLeftIcon className="h-5 w-5" />
    </button>
  );
}
