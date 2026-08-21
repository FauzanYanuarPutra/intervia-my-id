type MediaTrackLike = {
  stop: () => void;
};

type MediaStreamLike = {
  getTracks: () => MediaTrackLike[];
};

type PeerConnectionLike = {
  close: () => void;
};

type TimerHandle = number;

export type CallLifecycle = {
  isActive: () => boolean;
  registerStream: (stream: MediaStreamLike) => boolean;
  registerPeer: (peer: PeerConnectionLike) => boolean;
  setOfferTimer: (timer: TimerHandle) => boolean;
  addCleanup: (cleanup: () => void) => boolean;
  dispose: () => void;
};

function stopStream(stream: MediaStreamLike) {
  stream.getTracks().forEach(track => {
    try {
      track.stop();
    } catch {
      // Continue releasing the remaining tracks.
    }
  });
}

/**
 * Owns every resource created by a single call-effect run.
 *
 * Browser media requests cannot be aborted reliably. registerStream/registerPeer
 * therefore reject and immediately release resources that arrive after dispose().
 */
export function createCallLifecycle(
  clearTimer: (timer: TimerHandle) => void = timer => clearTimeout(timer),
): CallLifecycle {
  let active = true;
  let offerTimer: TimerHandle | null = null;
  const streams = new Set<MediaStreamLike>();
  const peers = new Set<PeerConnectionLike>();
  const cleanups = new Set<() => void>();

  return {
    isActive: () => active,

    registerStream(stream) {
      if (!active) {
        stopStream(stream);
        return false;
      }
      streams.add(stream);
      return true;
    },

    registerPeer(peer) {
      if (!active) {
        try {
          peer.close();
        } catch {
          // The peer may already be closed.
        }
        return false;
      }
      peers.add(peer);
      return true;
    },

    setOfferTimer(timer) {
      if (!active) {
        clearTimer(timer);
        return false;
      }
      if (offerTimer !== null) {
        clearTimer(offerTimer);
      }
      offerTimer = timer;
      return true;
    },

    addCleanup(cleanup) {
      if (!active) {
        try {
          cleanup();
        } catch {
          // Disposal is best-effort and must not leak the remaining resources.
        }
        return false;
      }
      cleanups.add(cleanup);
      return true;
    },

    dispose() {
      if (!active) return;
      active = false;

      if (offerTimer !== null) {
        clearTimer(offerTimer);
        offerTimer = null;
      }

      cleanups.forEach(cleanup => {
        try {
          cleanup();
        } catch {
          // Continue releasing the remaining resources.
        }
      });
      cleanups.clear();
      streams.forEach(stopStream);
      streams.clear();
      peers.forEach(peer => {
        try {
          peer.close();
        } catch {
          // The peer may already be closed.
        }
      });
      peers.clear();
    },
  };
}
