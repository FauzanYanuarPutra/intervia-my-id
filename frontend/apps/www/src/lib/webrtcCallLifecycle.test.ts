import { describe, expect, it, vi } from 'vitest';
import { createCallLifecycle } from './webrtcCallLifecycle';

function mediaResource() {
  const stop = vi.fn();
  return {
    stop,
    stream: { getTracks: () => [{ stop }] },
  };
}

describe('createCallLifecycle', () => {
  it('releases accepted call resources once and clears delayed signaling', () => {
    const clearTimer = vi.fn();
    const lifecycle = createCallLifecycle(clearTimer);
    const media = mediaResource();
    const peer = { close: vi.fn() };
    const cleanup = vi.fn();
    const timer = 42;

    expect(lifecycle.registerStream(media.stream)).toBe(true);
    expect(lifecycle.registerPeer(peer)).toBe(true);
    expect(lifecycle.addCleanup(cleanup)).toBe(true);
    expect(lifecycle.setOfferTimer(timer)).toBe(true);

    lifecycle.dispose();
    lifecycle.dispose();

    expect(lifecycle.isActive()).toBe(false);
    expect(clearTimer).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalledWith(timer);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(media.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();
  });

  it('immediately releases media and peers that resolve after disposal', () => {
    const lifecycle = createCallLifecycle();
    const media = mediaResource();
    const peer = { close: vi.fn() };
    const lateCleanup = vi.fn();

    lifecycle.dispose();

    expect(lifecycle.registerStream(media.stream)).toBe(false);
    expect(lifecycle.registerPeer(peer)).toBe(false);
    expect(lifecycle.addCleanup(lateCleanup)).toBe(false);
    expect(media.stop).toHaveBeenCalledOnce();
    expect(peer.close).toHaveBeenCalledOnce();
    expect(lateCleanup).toHaveBeenCalledOnce();
  });
});
