import { OFFERING_CODES } from '@/domain/services/catalog';
import {
  createWizardInitialState,
  wizardReducer,
} from '@/features/location-details/reducer';

describe('intake service choice', () => {
  it('changes the complete service decision atomically', () => {
    const initial = createWizardInitialState();
    const pending = wizardReducer(initial, {
      type: 'SELECT_SERVICE',
      value: 'priority_pass_pending',
    });
    const resolved = wizardReducer(pending, {
      type: 'SELECT_SERVICE',
      value: OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS,
    });

    expect(pending.serviceChoice).toBe('priority_pass_pending');
    expect(resolved.serviceChoice).toBe(
      OFFERING_CODES.PRIORITY_PASS_ADJUSTMENTS
    );
    expect(Object.keys(resolved)).not.toEqual(
      expect.arrayContaining([
        'isMember',
        'spinalAdjustment',
        'selectedTreatment',
        'visitCategory',
      ])
    );
  });
});
