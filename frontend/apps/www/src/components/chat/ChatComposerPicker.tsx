'use client';

import { useEffect, useMemo, useState } from 'react';
import { Smile, Sticker, X } from 'lucide-react';

type PickerMode = 'emoji' | 'sticker';

type EmojiCategory = {
  id: string;
  label: string;
  items: string[];
};

type StickerItem = {
  id: string;
  label: string;
  emoji: string;
};

type Props = {
  locale: string;
  mode: PickerMode;
  disabled?: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (emoji: string) => void;
};

const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'recent', label: 'Terbaru', items: ['😀', '😂', '😍', '👍', '🙏', '🔥', '❤️', '🎉', '😎', '🤝', '👏', '✅'] },
  { id: 'people', label: 'Orang', items: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤗','🤔','🫡','🤭','🤫','🤥','😶','🫠','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'] },
  { id: 'hands', label: 'Gestur', items: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤏','💪','👏','🙌','👐','🤲','🙏','🤝','💅','🫶','👀','👁️','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✨','💫','⭐','🌟','🔥','💯'] },
  { id: 'food', label: 'Makanan', items: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥕','🌽','🥦','🥬','🥒','🍞','🥐','🥖','🍚','🍜','🍝','🍕','🍔','🍟','🌭','🌮','🌯','🍗','🍣','🍤','🍰','🍩','🍪','🍫','🍿','☕','🧋','🥤','🍹'] },
  { id: 'animals', label: 'Hewan', items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦄','🐝','🦋','🐢','🐍','🦎','🐙','🦀','🐠','🐟','🐬','🐳','🦈','🐊','🐘','🦏','🦒','🐆','🐕','🐈','🐓','🦜','🦩','🌿','🌸','🌻'] },
  { id: 'activity', label: 'Aktivitas', items: ['⚽','🏀','🏈','⚾','🎾','🏐','🏆','🎯','🎮','🎲','🎸','🎹','🎤','🎧','🎨','🎬','🎭','📚','✏️','💼','💻','📱','📷','🚗','🏍️','✈️','🚀','🏠','🛒','🎁','🎈','🎉','🎊','💡','🔧','🛠️'] },
  { id: 'symbols', label: 'Simbol', items: ['✅','❌','❗','❓','‼️','⁉️','⭕','🚫','⚠️','💬','💭','💤','🔔','🔕','🔒','🔓','🔑','📌','📍','🔗','🔍','❤️','💚','💙','💜','🩷','🩵','🩶','☀️','🌙','☁️','☔','❄️','⚡','♻️'] },
];

const STICKERS: StickerItem[] = [
  { id: 'celebrate', label: 'Mantap!', emoji: '🎉' },
  { id: 'party', label: 'Gas!', emoji: '🥳' },
  { id: 'sparkles', label: 'Keren', emoji: '✨' },
  { id: 'thumbs', label: 'Siap', emoji: '👍' },
  { id: 'heart', label: 'Terima kasih', emoji: '❤️' },
  { id: 'fire', label: 'Mantul', emoji: '🔥' },
  { id: 'love', label: 'Love', emoji: '😍' },
  { id: 'laugh', label: 'Wkwk', emoji: '😂' },
  { id: 'pray', label: 'Amin', emoji: '🙏' },
  { id: 'clap', label: 'Apresiasi', emoji: '👏' },
  { id: 'ok', label: 'Oke', emoji: '👌' },
  { id: 'agree', label: 'Setuju', emoji: '🤝' },
];

export function ChatComposerPicker({
  locale,
  mode,
  disabled = false,
  onClose,
  onEmojiSelect,
  onStickerSelect,
}: Props) {
  const [categoryId, setCategoryId] = useState(mode === 'emoji' ? 'recent' : 'stickers');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'emoji') return;
    try {
      const raw = window.localStorage.getItem('lajukan:chat:recent-emojis:v1');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setRecent(parsed.filter(item => typeof item === 'string').slice(0, 24));
      }
    } catch {
      setRecent([]);
    }
  }, [mode]);

  useEffect(() => {
    setCategoryId(mode === 'emoji' ? 'recent' : 'stickers');
  }, [mode]);

  const categories = useMemo(() => {
    if (mode !== 'emoji' || recent.length === 0) return EMOJI_CATEGORIES;
    return EMOJI_CATEGORIES.map(category =>
      category.id === 'recent' ? { ...category, items: recent } : category,
    );
  }, [mode, recent]);

  const activeCategory =
    mode === 'emoji'
      ? categories.find(category => category.id === categoryId) || categories[0]
      : null;

  const pickEmoji = (emoji: string) => {
    if (disabled) return;
    onEmojiSelect(emoji);
    setRecent(previous => {
      const next = [emoji, ...previous.filter(item => item !== emoji)].slice(0, 24);
      try {
        window.localStorage.setItem('lajukan:chat:recent-emojis:v1', JSON.stringify(next));
      } catch {
        // Best effort.
      }
      return next;
    });
  };

  return (
    <section
      className="w-full shrink-0 overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_-16px_40px_-28px_rgba(15,23,42,0.5)] dark:border-white/[0.08] dark:bg-[#111b21]"
      aria-label={
        locale === 'id'
          ? mode === 'emoji' ? 'Papan emoji' : 'Papan stiker'
          : mode === 'emoji' ? 'Emoji keyboard' : 'Sticker keyboard'
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-2.5 py-2 dark:border-white/[0.06]">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f8f2] text-[#008f72] dark:bg-[#163b31] dark:text-[#25d366]">
            {mode === 'emoji' ? <Smile className="h-3.5 w-3.5" /> : <Sticker className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-[#111b21] dark:text-[#e9edef]">
              {locale === 'id' ? mode === 'emoji' ? 'Emoji' : 'Stiker' : mode === 'emoji' ? 'Emoji' : 'Stickers'}
            </p>
            <p className="truncate text-[10px] font-medium text-[#667781] dark:text-[#aebac1]">
              {locale === 'id' ? 'Pilih seperti keyboard di ponsel' : 'Choose items like a phone keyboard'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#54656f] transition hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#202c33]"
          aria-label={locale === 'id' ? 'Kembali ke keyboard' : 'Back to keyboard'}
          title={locale === 'id' ? 'Kembali mengetik' : 'Back to typing'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === 'emoji' ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto border-b border-black/[0.05] p-2 dark:border-white/[0.06]">
            {categories.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={[
                  'min-h-8 shrink-0 rounded-full px-2.5 text-[10px] font-bold transition',
                  category.id === categoryId
                    ? 'bg-[#d9fdd3] text-[#008f72] dark:bg-[#173c31] dark:text-[#25d366]'
                    : 'text-[#667781] hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#202c33]',
                ].join(' ')}
              >
                {category.id === 'recent' ? locale === 'id' ? 'Baru' : 'Recent' : category.label}
              </button>
            ))}
          </div>
          <div className="h-[min(18dvh,176px)] min-h-[118px] overflow-y-auto overscroll-contain p-2">
            <div className="grid grid-cols-8 gap-0.5 min-[420px]:grid-cols-9 sm:grid-cols-10 md:grid-cols-12">
              {(activeCategory?.items || []).map((emoji, index) => (
                <button
                  key={emoji + index}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickEmoji(emoji)}
                  className="flex aspect-square min-h-7 items-center justify-center rounded-lg text-[1.1rem] transition hover:bg-[#f0f2f5] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#202c33] sm:text-[1.22rem]"
                  aria-label={(locale === 'id' ? 'Pilih ' : 'Choose ') + emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-black/[0.05] px-3 py-1.5 text-[9px] font-medium text-[#667781] dark:border-white/[0.06] dark:text-[#aebac1]">
            {locale === 'id'
              ? 'Pilih emoji berkali-kali, lalu kembali untuk mengetik atau mengirim.'
              : 'Pick multiple emojis, then return to typing or send.'}
          </div>
        </>
      ) : (
        <>
          <div className="h-[min(18dvh,176px)] min-h-[118px] overflow-y-auto overscroll-contain p-2">
            <div className="grid grid-cols-4 gap-1 min-[420px]:grid-cols-5 sm:grid-cols-6 md:grid-cols-8">
              {STICKERS.map(sticker => (
                <button
                  key={sticker.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStickerSelect(sticker.emoji)}
                  className="flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-[14px] border border-black/[0.04] bg-[#f7f9f8] px-2 py-2 transition hover:-translate-y-0.5 hover:bg-[#eef3f1] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.05] dark:bg-[#202c33] dark:hover:bg-[#2a3942]"
                  aria-label={sticker.label}
                  title={sticker.label}
                >
                  <span className="text-[1.65rem] leading-none" aria-hidden="true">{sticker.emoji}</span>
                  <span className="max-w-full truncate text-[10px] font-bold text-[#54656f] dark:text-[#aebac1]">{sticker.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-black/[0.05] px-2.5 py-1.5 text-[9px] font-medium text-[#667781] dark:border-white/[0.06] dark:text-[#aebac1]">
            {locale === 'id'
              ? 'Stiker dikirim langsung sebagai pesan stiker.'
              : 'Stickers are sent directly as sticker messages.'}
          </div>
        </>
      )}
    </section>
  );
}
