"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  Box,
  BriefcaseBusiness,
  ChevronRight,
  Heart,
  Info,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Package,
  Play,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
  User,
  Volume2,
  VolumeX,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import type { LajukanReel, ReelsPageResult } from "../../_data/reels";

type ReelsClientProps = {
  locale: string;
  initialIndex: number;
  initialItems: LajukanReel[];
  initialCursor: number | null;
  initialHasMore: boolean;
};

const iconMap: Record<LajukanReel["iconKey"], LucideIcon> = {
  supplier: BriefcaseBusiness,
  marketing: Megaphone,
  finance: WalletCards,
  packaging: Box,
  frozen: ShoppingBag,
};

export default function ReelsClient({
  locale,
  initialIndex,
  initialItems,
  initialCursor,
  initialHasMore,
}: ReelsClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const firstScrollDoneRef = useRef(false);

  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(initialItems.length - 1, 0),
  );

  const [items, setItems] = useState<LajukanReel[]>(initialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [muted, setMuted] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [bufferingId, setBufferingId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [detailReel, setDetailReel] = useState<LajukanReel | null>(null);

  const overlayOpen = searchOpen || detailReel !== null;

  const activeReel = useMemo(() => {
    if (items.length === 0) return null;
    return items[Math.min(activeIndex, items.length - 1)] || null;
  }, [activeIndex, items]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || cursor === null) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/reels?cursor=${cursor}&limit=6`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load reels");
      }

      const data = (await response.json()) as ReelsPageResult;

      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const nextItems = data.items.filter((item) => !existingIds.has(item.id));
        return [...prev, ...nextItems];
      });

      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setLoadError("Gagal memuat video. Coba lagi.");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, hasMore]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;

      const nextIndex = Math.min(
        Math.max(index, 0),
        Math.max(items.length - 1, 0),
      );

      container.scrollTo({
        top: nextIndex * container.clientHeight,
        behavior,
      });

      setActiveIndex(nextIndex);
      setPausedByUser(false);
    },
    [items.length],
  );

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const container = containerRef.current;
      if (!container || items.length === 0) return;

      const height = container.clientHeight || window.innerHeight;
      const rawIndex = Math.round(container.scrollTop / height);

      const nextIndex = Math.min(
        Math.max(rawIndex, 0),
        Math.max(items.length - 1, 0),
      );

      setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));

      const distanceToBottom =
        container.scrollHeight - (container.scrollTop + height);

      if (distanceToBottom < height * 2) {
        void loadMore();
      }
    });
  }, [items.length, loadMore]);

  useEffect(() => {
    if (firstScrollDoneRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    firstScrollDoneRef.current = true;

    const frame = requestAnimationFrame(() => {
      container.scrollTo({
        top: safeInitialIndex * container.clientHeight,
        behavior: "auto",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [safeInitialIndex]);

  useEffect(() => {
    if (activeIndex >= items.length - 3) {
      void loadMore();
    }
  }, [activeIndex, items.length, loadMore]);

  useEffect(() => {
    if (activeIndex < items.length) {
      window.history.replaceState(
        null,
        "",
        `/${locale}/reels?video=${activeIndex + 1}`,
      );
    }
  }, [activeIndex, items.length, locale]);

  useEffect(() => {
    setPausedByUser(false);
    setBufferingId(null);
  }, [activeIndex]);

  useEffect(() => {
    items.forEach((item, index) => {
      const video = videoRefs.current[item.id];
      if (!video) return;

      video.muted = muted;
      video.volume = muted ? 0 : 1;

      if (overlayOpen) {
        video.pause();
        return;
      }

      if (index === activeIndex && !pausedByUser) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [activeIndex, items, muted, overlayOpen, pausedByUser]);

  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach((video) => {
        video?.pause();
      });
    };
  }, []);

  function toggleCurrentVideo() {
    if (!activeReel) return;

    const video = videoRefs.current[activeReel.id];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setPausedByUser(false);
    } else {
      video.pause();
      setPausedByUser(true);
    }
  }

  function toggleSound() {
    const nextMuted = !muted;

    setMuted(nextMuted);

    if (!nextMuted) {
      setSoundUnlocked(true);
    }

    if (!activeReel) return;

    const video = videoRefs.current[activeReel.id];
    if (!video) return;

    video.muted = nextMuted;
    video.volume = nextMuted ? 0 : 1;

    if (!nextMuted) {
      video.play().catch(() => {});
      setPausedByUser(false);
    }
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-black text-white">
      <div className="relative h-full w-full overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.10),transparent_32%)] lg:block" />

        <div className="relative mx-auto h-full w-full max-w-[520px] overflow-hidden bg-black shadow-2xl">
          <ReelsTopBar
            locale={locale}
            muted={muted}
            onToggleSound={toggleSound}
            onOpenSearch={() => setSearchOpen(true)}
          />

          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((reel, index) => (
              <ReelSlide
                key={reel.id}
                reel={reel}
                locale={locale}
                active={index === activeIndex}
                shouldLoad={Math.abs(index - activeIndex) <= 2}
                muted={muted}
                soundUnlocked={soundUnlocked}
                paused={pausedByUser && index === activeIndex}
                buffering={bufferingId === reel.id && index === activeIndex}
                setVideoRef={(node) => {
                  if (node) {
                    videoRefs.current[reel.id] = node;
                  } else {
                    delete videoRefs.current[reel.id];
                  }
                }}
                onWaiting={() => {
                  if (index === activeIndex) setBufferingId(reel.id);
                }}
                onPlaying={() => {
                  if (bufferingId === reel.id) setBufferingId(null);
                }}
                onTogglePlay={toggleCurrentVideo}
                onToggleSound={toggleSound}
                onOpenDetail={() => setDetailReel(reel)}
              />
            ))}
          </div>

          <LoadingToast
            loading={loadingMore}
            error={loadError}
            onRetry={() => void loadMore()}
          />

          {!hasMore && activeIndex >= items.length - 1 && items.length > 0 && (
            <EndMiniToast
              onRestart={() => scrollToIndex(0)}
              onSearch={() => setSearchOpen(true)}
            />
          )}
        </div>

        <SearchOverlay
          open={searchOpen}
          items={items}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadError={loadError}
          onClose={() => setSearchOpen(false)}
          onLoadMore={() => void loadMore()}
          onSelect={(index) => {
            setSearchOpen(false);
            scrollToIndex(index);
          }}
        />

        <DetailOverlay
          locale={locale}
          reel={detailReel}
          onClose={() => setDetailReel(null)}
        />
      </div>
    </main>
  );
}

/* =========================
   TOP BAR
========================= */

function ReelsTopBar({
  locale,
  muted,
  onToggleSound,
  onOpenSearch,
}: {
  locale: string;
  muted: boolean;
  onToggleSound: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pb-16 pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="pointer-events-auto flex items-center gap-3">
        <Link
          href={`/${locale}/home`}
          aria-label="Kembali"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/12 px-4 py-3 text-left text-sm font-bold text-white/85 backdrop-blur transition active:scale-[0.98]"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Cari reels, produk, supplier...</span>
        </button>

        <button
          type="button"
          onClick={onToggleSound}
          aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 backdrop-blur transition active:scale-[0.96]"
        >
          {muted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
}

/* =========================
   MAIN REEL
========================= */

function ReelSlide({
  reel,
  locale,
  active,
  shouldLoad,
  muted,
  soundUnlocked,
  paused,
  buffering,
  setVideoRef,
  onWaiting,
  onPlaying,
  onTogglePlay,
  onToggleSound,
  onOpenDetail,
}: {
  reel: LajukanReel;
  locale: string;
  active: boolean;
  shouldLoad: boolean;
  muted: boolean;
  soundUnlocked: boolean;
  paused: boolean;
  buffering: boolean;
  setVideoRef: (node: HTMLVideoElement | null) => void;
  onWaiting: () => void;
  onPlaying: () => void;
  onTogglePlay: () => void;
  onToggleSound: () => void;
  onOpenDetail: () => void;
}) {
  const Icon = iconMap[reel.iconKey];

  return (
    <article className="relative flex h-[100svh] snap-start overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+34px)] pt-[calc(env(safe-area-inset-top)+92px)]">
      <video
        ref={setVideoRef}
        src={shouldLoad ? reel.videoSrc : undefined}
        className="absolute inset-0 h-full w-full object-cover"
        muted={muted}
        loop
        playsInline
        preload={active ? "auto" : shouldLoad ? "metadata" : "none"}
        disablePictureInPicture
        onWaiting={onWaiting}
        onPlaying={onPlaying}
      />

      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute inset-0 z-10"
        aria-label={paused ? "Putar video" : "Pause video"}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/35" />

      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+84px)] z-20 flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-xs font-black backdrop-blur">
        <Icon className="h-4 w-4" />
        {reel.tag}
      </div>

      <ActionRail reel={reel} onOpenDetail={onOpenDetail} />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/35 backdrop-blur">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      )}

      {paused && active && !buffering && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 backdrop-blur">
            <Play className="h-9 w-9 fill-white" />
          </div>
        </div>
      )}

      {active && muted && !soundUnlocked && !buffering && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSound();
          }}
          className="absolute left-1/2 top-1/2 z-40 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-2xl"
        >
          <Volume2 className="h-5 w-5" />
          Ketuk untuk suara
        </button>
      )}

      <div className="relative z-20 mt-auto min-w-0 flex-1 pr-16">
        <CreatorRow reel={reel} />

        <button type="button" onClick={onOpenDetail} className="block text-left">
          <h1 className="text-[22px] font-black leading-tight drop-shadow-sm">
            {reel.title}
          </h1>
        </button>

        <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-white/90 drop-shadow-sm">
          {reel.caption}
        </p>

        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-white/80"
        >
          Lihat detail
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <ProductCartDock locale={locale} reel={reel} onOpenDetail={onOpenDetail} />

        {!reel.productName && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white backdrop-blur">
            <Info className="h-3.5 w-3.5" />
            Konten informasi bisnis
          </div>
        )}
      </div>
    </article>
  );
}

function CreatorRow({ reel }: { reel: LajukanReel }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/20">
        <User className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-black">{reel.creator}</p>
        <p className="text-xs font-semibold text-white/70">
          Tips bisnis & supplier
        </p>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-950"
      >
        Ikuti
      </button>
    </div>
  );
}

/* =========================
   PRODUCT CART
========================= */

function ProductCartDock({
  locale,
  reel,
  onOpenDetail,
}: {
  locale: string;
  reel: LajukanReel;
  onOpenDetail: () => void;
}) {
  if (!reel.productName || !reel.productPrice || !reel.productHref) {
    return null;
  }

  return (
    <div className="mt-4 flex max-w-[370px] overflow-hidden rounded-[22px] bg-yellow-400 text-slate-950 shadow-xl shadow-yellow-500/20 ring-1 ring-yellow-200">
      <Link
        href={`/${locale}${reel.productHref}`}
        className="flex min-w-0 flex-1 items-center gap-3 p-3"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
          <ShoppingBag className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 inline-flex items-center rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-300">
            Keranjang
          </div>

          <p className="truncate text-sm font-black">{reel.productName}</p>
          <p className="truncate text-xs font-bold text-slate-700">
            {reel.productPrice}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={onOpenDetail}
        aria-label="Detail produk"
        className="grid w-12 shrink-0 place-items-center border-l border-yellow-500/30 bg-yellow-300/70"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function ActionRail({
  reel,
  onOpenDetail,
}: {
  reel: LajukanReel;
  onOpenDetail: () => void;
}) {
  const actions = [
    {
      label: reel.likes,
      icon: Heart,
    },
    {
      label: reel.comments,
      icon: MessageCircle,
    },
    {
      label: reel.shares,
      icon: Send,
    },
    {
      label: "Simpan",
      icon: Bookmark,
    },
  ];

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-30 flex flex-col items-center gap-4">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.label}
            type="button"
            className="flex flex-col items-center gap-1 transition active:scale-95"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-[11px] font-black drop-shadow">
              {action.label}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenDetail}
        className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 transition active:scale-95"
      >
        <MoreHorizontal className="h-6 w-6" />
      </button>
    </div>
  );
}

/* =========================
   SEARCH OVERLAY
========================= */

function SearchOverlay({
  open,
  items,
  hasMore,
  loadingMore,
  loadError,
  onClose,
  onLoadMore,
  onSelect,
}: {
  open: boolean;
  items: LajukanReel[];
  hasMore: boolean;
  loadingMore: boolean;
  loadError: string | null;
  onClose: () => void;
  onLoadMore: () => void;
  onSelect: (index: number) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mapped = items.map((item, index) => ({ item, index }));

    if (!q) return mapped;

    return mapped.filter(({ item }) => {
      const haystack = [
        item.title,
        item.creator,
        item.caption,
        item.tag,
        item.productName || "",
        item.productPrice || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  function handleResultsScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom =
      element.scrollHeight - (element.scrollTop + element.clientHeight);

    if (distanceToBottom < 900 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[90] flex min-h-0 flex-col bg-[#050505] text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <Search className="h-4 w-4 shrink-0 text-white/60" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari video, produk, supplier, packaging, kopi..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-white/45"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-white/60 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 sm:inline-flex"
          >
            Tutup
          </button>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[1440px] gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["Semua", "Supplier", "Packaging", "Kopi", "Keuangan", "Online Shop"].map(
            (chip) => {
              const active = query === chip || (!query && chip === "Semua");

              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setQuery(chip === "Semua" ? "" : chip)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-2 text-xs font-black transition",
                    active
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-white/75 hover:bg-white/15",
                  )}
                >
                  {chip}
                </button>
              );
            },
          )}
        </div>
      </header>

      <div
        onScroll={handleResultsScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5"
      >
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/45">
                {query ? "Hasil pencarian" : "Eksplor Reels"}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {query ? `Cari: ${query}` : "Temukan video bisnis terbaik"}
              </h1>
            </div>

            <p className="hidden text-sm font-bold text-white/45 sm:block">
              {results.length} video dimuat
            </p>
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map(({ item, index }) => (
                <SearchVideoCard
                  key={item.id}
                  reel={item}
                  onClick={() => onSelect(index)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white/10 p-8 text-center ring-1 ring-white/10">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10">
                <Search className="h-8 w-8" />
              </div>
              <p className="mt-5 text-xl font-black">Belum ada video</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                Coba kata lain seperti supplier, packaging, kopi, frozen food,
                marketing, atau keuangan.
              </p>
            </div>
          )}

          <div className="py-8">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-sm font-black text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat video...
              </div>
            )}

            {!loadingMore && hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="mx-auto flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Muat video lainnya
              </button>
            )}

            {!loadingMore && !hasMore && results.length > 0 && (
              <p className="text-center text-xs font-bold text-white/40">
                Semua video sudah dimuat
              </p>
            )}

            {loadError && (
              <button
                type="button"
                onClick={onLoadMore}
                className="mx-auto mt-3 flex rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950"
              >
                Coba lagi
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchVideoCard({
  reel,
  onClick,
}: {
  reel: LajukanReel;
  onClick: () => void;
}) {
  const Icon = iconMap[reel.iconKey];

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(event) => {
        const video = event.currentTarget.querySelector("video");
        if (video instanceof HTMLVideoElement) {
          video.play().catch(() => {});
        }
      }}
      onMouseLeave={(event) => {
        const video = event.currentTarget.querySelector("video");
        if (video instanceof HTMLVideoElement) {
          video.pause();
          video.currentTime = 0;
        }
      }}
      className="group relative aspect-[9/14] overflow-hidden rounded-2xl bg-white/10 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/20 active:scale-[0.98]"
    >
      <video
        src={reel.videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/12 to-black/25" />

      <div className="absolute left-2 top-2 flex max-w-[calc(100%-56px)] items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{reel.tag}</span>
      </div>

      {reel.productName && (
        <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-yellow-400 text-slate-950 shadow-lg">
          <ShoppingBag className="h-4 w-4" />
        </div>
      )}

      <div className="absolute inset-0 grid place-items-center opacity-90 transition group-hover:scale-110">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/18 backdrop-blur">
          <Play className="h-4 w-4 fill-white text-white" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-xs font-black leading-tight text-white">
          {reel.title}
        </p>

        {reel.productName ? (
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-slate-950">
            <ShoppingBag className="h-3 w-3 shrink-0" />
            <span className="truncate">{reel.productName}</span>
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-black text-white/80">
            <Info className="h-3 w-3" />
            Info bisnis
          </div>
        )}

        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-white/75">
          <Play className="h-3 w-3 fill-white" />
          {reel.likes}
        </div>
      </div>
    </button>
  );
}

/* =========================
   DETAIL OVERLAY
========================= */

function DetailOverlay({
  locale,
  reel,
  onClose,
}: {
  locale: string;
  reel: LajukanReel | null;
  onClose: () => void;
}) {
  if (!reel) return null;

  const Icon = iconMap[reel.iconKey];

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 p-0 text-white backdrop-blur-md sm:grid sm:place-items-center sm:p-5">
      <button
        type="button"
        aria-label="Tutup detail"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative mt-auto flex h-full w-full flex-col overflow-hidden bg-[#080808] shadow-2xl sm:h-[min(760px,calc(100svh-40px))] sm:max-w-[1040px] sm:rounded-[32px] lg:grid lg:grid-cols-[430px_minmax(0,1fr)]">
        <div className="relative min-h-[42svh] overflow-hidden bg-black sm:min-h-0">
          <video
            src={reel.videoSrc}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />

          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black backdrop-blur">
            <Icon className="h-4 w-4" />
            {reel.tag}
          </div>

          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/15 backdrop-blur">
              <Play className="h-7 w-7 fill-white" />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 text-slate-950 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Detail Reels
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight">
                {reel.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 transition active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100">
              <User className="h-5 w-5 text-slate-500" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{reel.creator}</p>
              <p className="text-xs font-semibold text-slate-500">
                {reel.tag} · Tips bisnis
              </p>
            </div>

            <button
              type="button"
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              Ikuti
            </button>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-slate-700">
            {reel.caption}
          </p>

          {reel.productName && reel.productPrice && reel.productHref ? (
            <Link
              href={`/${locale}${reel.productHref}`}
              className="mt-5 flex items-center gap-3 rounded-[24px] bg-yellow-400 p-4 text-slate-950 shadow-lg shadow-yellow-400/20"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
                <ShoppingBag className="h-7 w-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 inline-flex rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-300">
                  Produk terkait
                </div>
                <p className="truncate text-base font-black">{reel.productName}</p>
                <p className="truncate text-sm font-bold text-slate-700">
                  {reel.productPrice}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0" />
            </Link>
          ) : (
            <div className="mt-5 rounded-[24px] bg-slate-100 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                <Info className="h-5 w-5 text-emerald-700" />
                Konten informasi
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Reels ini tidak terhubung ke produk. Isinya fokus edukasi, tips,
                atau insight bisnis.
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatPill label="Like" value={reel.likes} />
            <StatPill label="Komentar" value={reel.comments} />
            <StatPill label="Share" value={reel.shares} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-800"
            >
              Simpan
            </button>
            <button
              type="button"
              className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white"
            >
              Bagikan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3 text-center">
      <p className="text-sm font-black">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

/* =========================
   LOADING
========================= */

function LoadingToast({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 shadow-xl">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat reels...
          </>
        ) : (
          <>
            <span>{error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-slate-950 px-3 py-1 text-white"
            >
              Coba
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EndMiniToast({
  onRestart,
  onSearch,
}: {
  onRestart: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-slate-950 shadow-xl backdrop-blur">
        <span>Semua reels sudah dimuat</span>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-white"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Ulang
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="rounded-full bg-slate-100 px-3 py-1.5"
        >
          Cari
        </button>
      </div>
    </div>
  );
}

/* =========================
   UTILS
========================= */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}