import { describe, expect, it } from 'vitest';
import { notifyReviewNeeded } from './notify';

describe('notifyReviewNeeded (FR-008)', () => {
  it('resolves without throwing when no channel is wired (today\'s state)', async () => {
    await expect(
      notifyReviewNeeded({
        type: 'pending',
        detectorType: 'resignation',
        name: 'Szöllősi György',
        confidence: 0.82,
        articleUrl: 'https://telex.hu/example',
      }),
    ).resolves.toBeUndefined();
  });

  it('never throws even for a near_miss event with edge-case values', async () => {
    await expect(
      notifyReviewNeeded({
        type: 'near_miss',
        detectorType: 'media_closure',
        name: '',
        confidence: 0,
        articleUrl: '',
      }),
    ).resolves.toBeUndefined();
  });
});
