export type EffectPreviewItem = {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning';
};

type EffectPreviewProps = {
  items: EffectPreviewItem[];
  ariaLabel?: string;
};

const toneClass: Record<NonNullable<EffectPreviewItem['tone']>, string> = {
  default: 'text-portal-ink',
  positive: 'text-portal-forest',
  warning: 'text-portal-ember',
};

export function EffectPreview({ items, ariaLabel = 'Dampak' }: EffectPreviewProps) {
  return (
    <div aria-label={ariaLabel} className="grid gap-2 sm:grid-cols-2">
      {items.map(item => (
        <div key={item.label} className="rounded-xl bg-[#fafbf9] px-3 py-2.5">
          <p className="text-[11px] text-portal-soft">{item.label}</p>
          <p className={`mt-0.5 text-sm font-black ${toneClass[item.tone ?? 'default']}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
