import { describe, expect, it } from 'vitest';
import { computeCoverCrop, mediaCropPreset } from './media-crop';

describe('business media crop geometry', () => {
  it('uses fixed production ratios and output dimensions', () => {
    expect(mediaCropPreset('logo')).toMatchObject({ aspect: 1, width: 640, height: 640 });
    expect(mediaCropPreset('banner')).toMatchObject({ aspect: 8 / 3, width: 1600, height: 600 });
    expect(mediaCropPreset('product')).toMatchObject({ aspect: 1, width: 1200, height: 1200 });
  });

  it('centers a landscape source for a square crop and honors horizontal positioning', () => {
    expect(computeCoverCrop(2400, 1200, 1, 1, 0, 0)).toEqual({
      x: 600,
      y: 0,
      width: 1200,
      height: 1200,
    });
    expect(computeCoverCrop(2400, 1200, 1, 1, 1, 0)).toEqual({
      x: 1200,
      y: 0,
      width: 1200,
      height: 1200,
    });
  });

  it('zooms without allowing a crop outside the source image', () => {
    expect(computeCoverCrop(1200, 1800, 8 / 3, 2, -1, 1)).toEqual({
      x: 0,
      y: 1575,
      width: 600,
      height: 225,
    });
  });
});
