import { describe, expect, it } from 'vitest';
import { computeCoverCrop, dragCropPosition, mediaCropPreset } from './media-crop';

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

  it('translates direct canvas dragging into crop position changes', () => {
    expect(dragCropPosition({
      sourceWidth: 2400,
      sourceHeight: 1200,
      targetAspect: 1,
      zoom: 1,
      horizontalPosition: 0,
      verticalPosition: 0,
      deltaX: 100,
      deltaY: 100,
      viewportWidth: 400,
      viewportHeight: 400,
    })).toEqual({ horizontal: -0.5, vertical: 0 });
  });

  it('clamps direct dragging at the available image edges', () => {
    expect(dragCropPosition({
      sourceWidth: 2400,
      sourceHeight: 1200,
      targetAspect: 1,
      zoom: 2,
      horizontalPosition: 0.9,
      verticalPosition: -0.9,
      deltaX: -1000,
      deltaY: 1000,
      viewportWidth: 400,
      viewportHeight: 400,
    })).toEqual({ horizontal: 1, vertical: -1 });
  });

  it('ignores invalid viewport deltas instead of creating non-finite positions', () => {
    expect(dragCropPosition({
      sourceWidth: 1200,
      sourceHeight: 1200,
      targetAspect: 1,
      zoom: 1,
      horizontalPosition: 0.25,
      verticalPosition: -0.25,
      deltaX: 50,
      deltaY: 50,
      viewportWidth: 0,
      viewportHeight: Number.NaN,
    })).toEqual({ horizontal: 0.25, vertical: -0.25 });
  });
});
