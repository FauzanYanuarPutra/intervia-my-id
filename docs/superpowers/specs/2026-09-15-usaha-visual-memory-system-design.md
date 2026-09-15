# Lajukan Usaha Visual Memory System Design

## Goal
Make usaha.lajukan.com easier to understand on first use and easier to remember on repeat use by giving every major job a stable visual identity, vocabulary, icon, position, and hierarchy.

## Principles
- Keep Lajukan forest green as the brand/primary-action color.
- Add restrained semantic accents for daily jobs: sales=green, catalog=violet, stock=amber, money=blue, system/settings=slate.
- Never rely on color alone; pair accents with stable icons and labels.
- Use one label for one concept everywhere. Use `Jual`, `Barang`, `Stok`, `Uang`, and `Menu` consistently.
- Mobile top-level navigation is `Beranda · Jual · Barang · Uang · Menu`; stock stays one tap away in Menu and remains surfaced from Home when attention is needed.
- Desktop keeps the five daily jobs visible because horizontal space is available: `Beranda · Jual · Barang · Stok · Uang`.
- One section must have one canonical icon across desktop and mobile.
- Reduce generic card chrome. Strong hierarchy should come from spacing, typography, grouped surfaces, and semantic accents rather than borders everywhere.
- Keep existing permissions and routes intact.

## Components
### Visual semantics
Create `src/lib/portal-visual.ts` as the single source of truth for section accent roles and stable icon choices consumed by navigation components.

### Navigation
`portal-navigation.ts` keeps the route model but changes merchant vocabulary and mobile primary order. `SidebarNav.tsx` and `MobileNav.tsx` consume the same visual metadata so the user sees the same concept the same way on every viewport.

### Shell
`PortalShell.tsx` strengthens the Lajukan brand anchor and makes the active workspace easier to scan without adding more chrome.

### Home
Home should answer three questions in order: what happened today, what needs attention, what can I do now. Quick actions become visually distinct by job while preserving permission-aware behavior.

### Tokens
`tailwind.config.ts` and `globals.css` gain restrained semantic accent tokens and shared utility classes. Existing portal colors remain compatible so feature pages do not regress.

## Accessibility
- Accent text/background pairs must remain readable.
- Active navigation uses icon + label + shape + color, not color alone.
- Existing focus-visible behavior remains.
- No route or permission is removed.

## Testing
Extend the existing merchant UI contract tests first so they fail against the old navigation vocabulary and missing visual-role source. Then implement until the Usaha test, typecheck, and build gates pass.
