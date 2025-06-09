/**
 * YesNoButtons Atom Component
 * 
 * A pair of animated buttons for yes/no selections with selection state
 */

import { AnimatedButton } from './AnimatedButton';

export interface YesNoButtonsProps {
  onYes: () => void;
  onNo: () => void;
  selected: boolean | null;
  onDeselect?: () => void;
}

export function YesNoButtons({ 
  onYes, 
  onNo, 
  selected,
  onDeselect
}: YesNoButtonsProps) {
  return (
    <div className="flex gap-4">
      <AnimatedButton
        onClick={() => selected === true && onDeselect ? onDeselect() : onYes()}
        selected={selected === true}
      >
        Yes
      </AnimatedButton>
      <AnimatedButton
        onClick={() => selected === false && onDeselect ? onDeselect() : onNo()}
        selected={selected === false}
      >
        No
      </AnimatedButton>
    </div>
  );
} 