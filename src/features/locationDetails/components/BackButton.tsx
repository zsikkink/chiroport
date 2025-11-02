import { ChevronLeftIcon } from '@heroicons/react/24/solid';

interface BackButtonProps {
  onClick: () => void;
}

export default function BackButton({ onClick }: BackButtonProps) {
  return (
    <button onClick={onClick} aria-label="Go back" className="text-white flex items-center mb-2">
      <ChevronLeftIcon className="w-6 h-6" />
    </button>
  );
}
