import AnimatedButton from './AnimatedButton';

interface YesNoButtonsProps {
  onYes: () => void;
  onNo: () => void;
  selected: boolean | null;
  onDeselect?: () => void;
}

export default function YesNoButtons({ onYes, onNo, selected, onDeselect }: YesNoButtonsProps) {
  return (
    <div className="flex gap-4">
      <AnimatedButton
        onClick={() => (selected === true && onDeselect ? onDeselect() : onYes())}
        selected={selected === true}
      >
        Yes
      </AnimatedButton>
      <AnimatedButton
        onClick={() => (selected === false && onDeselect ? onDeselect() : onNo())}
        selected={selected === false}
      >
        No
      </AnimatedButton>
    </div>
  );
}
