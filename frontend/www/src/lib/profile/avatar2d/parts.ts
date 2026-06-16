import type {
  AvatarAuraId,
  AvatarBackgroundId,
  AvatarHairColorId,
  AvatarOutfitColorId,
  AvatarSkinId,
  AvatarWingId,
  LajukanAvatarSpec,
} from './types';

const SKIN_COLOR: Record<AvatarSkinId, string> = {
  porcelain: '#f6d8c9',
  kuning: '#eec39b',
  sawo: '#c88652',
  tan: '#a8683f',
  deep: '#6f3f2a',
  olive: '#b48755',
  mahogany: '#7b4a32',
  rosewarm: '#d99a83',
};

const HAIR_COLOR: Record<AvatarHairColorId, string> = {
  espresso: '#312218',
  black: '#111827',
  chestnut: '#7c3f1d',
  auburn: '#9a3412',
  silver: '#cbd5e1',
  hazel: '#8b5a2b',
  copper: '#c2410c',
  midnight: '#020617',
  gold: '#d97706',
};

const OUTFIT_COLOR: Record<AvatarOutfitColorId, string> = {
  emerald: '#0f766e',
  sky: '#2563eb',
  amber: '#f59e0b',
  rose: '#e11d48',
  slate: '#334155',
  violet: '#7c3aed',
  navy: '#1e3a8a',
  teal: '#0d9488',
  gold: '#d97706',
  cream: '#f5e6c8',
  black: '#111827',
};

const BG_COLOR: Record<AvatarBackgroundId, [string, string, string]> = {
  mint: ['#dcfce7', '#99f6e4', '#ecfdf5'],
  sky: ['#dbeafe', '#7dd3fc', '#f0f9ff'],
  sunset: ['#ffedd5', '#fdba74', '#fff7ed'],
  rose: ['#ffe4e6', '#f9a8d4', '#fff1f2'],
  slate: ['#e2e8f0', '#94a3b8', '#f8fafc'],
  neon: ['#111827', '#7c3aed', '#22d3ee'],
  market: ['#ecfdf5', '#86efac', '#fef3c7'],
  workshop: ['#fff7ed', '#fdba74', '#e2e8f0'],
  warehouse: ['#f8fafc', '#cbd5e1', '#e0f2fe'],
  studio: ['#fae8ff', '#f0abfc', '#e0f2fe'],
  map: ['#dbeafe', '#93c5fd', '#dcfce7'],
  night: ['#020617', '#1e293b', '#0f766e'],
};

function isWideBody(spec: LajukanAvatarSpec): boolean {
  return spec.body === 'sturdy' || spec.body === 'athletic';
}

function isTallBody(spec: LajukanAvatarSpec): boolean {
  return spec.body === 'tall' || spec.body === 'athletic';
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAvatarDefs(spec: LajukanAvatarSpec): string {
  const [start, end, glow] = BG_COLOR[spec.background];
  return `<defs><linearGradient id="avatarBg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${start}"/><stop offset=".62" stop-color="${end}"/><stop offset="1" stop-color="${glow}"/></linearGradient><radialGradient id="avatarSpot" cx="50%" cy="30%" r="72%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset=".72" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient><clipPath id="avatarClip"><circle cx="128" cy="128" r="128"/></clipPath><filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#0f172a" flood-opacity=".18"/></filter></defs>`;
}

function avatarCss(motion: LajukanAvatarSpec['motion']): string {
  const factor = motion === 'calm' ? 1.55 : 1;
  const duration = (seconds: number) => `${(seconds * factor).toFixed(2)}s`;
  const still =
    motion === 'still' ? '.avatar2d *{animation:none!important}' : '';
  return `<style>@keyframes idleBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.018)}}@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}@keyframes hairSway{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(2deg)}}@keyframes leftFlap{0%,100%{transform:rotate(-5deg) translateY(0)}50%{transform:rotate(-14deg) translateY(-3px)}}@keyframes rightFlap{0%,100%{transform:rotate(5deg) translateY(0)}50%{transform:rotate(14deg) translateY(-3px)}}@keyframes auraPulse{0%,100%{opacity:.62;transform:scale(.98)}50%{opacity:1;transform:scale(1.05)}}@keyframes sparkleDrift{0%,100%{transform:translate(0,0);opacity:.45}50%{transform:translate(5px,-8px);opacity:1}}@keyframes capeSway{0%,100%{transform:skewX(-3deg)}50%{transform:skewX(5deg)}}@keyframes itemFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}@keyframes flameFlicker{0%,100%{transform:scaleY(.88);opacity:.72}50%{transform:scaleY(1.18);opacity:1}}.avatar2d *{transform-box:fill-box}.avatar-body{animation:idleBob ${duration(3.1)} ease-in-out infinite;transform-origin:128px 142px}.avatar-breath{animation:breathe ${duration(2.8)} ease-in-out infinite;transform-origin:128px 168px}.avatar-eye{animation:blink ${duration(4.6)} ease-in-out infinite;transform-origin:center}.avatar-hair{animation:hairSway ${duration(3.4)} ease-in-out infinite;transform-origin:128px 82px}.avatar-wing-left{animation:leftFlap ${duration(2.6)} ease-in-out infinite;transform-origin:98px 128px}.avatar-wing-right{animation:rightFlap ${duration(2.6)} ease-in-out infinite;transform-origin:158px 128px}.avatar-aura{animation:auraPulse ${duration(2.5)} ease-in-out infinite;transform-origin:128px 128px}.avatar-spark{animation:sparkleDrift ${duration(3.2)} ease-in-out infinite}.avatar-cape{animation:capeSway ${duration(2.8)} ease-in-out infinite;transform-origin:128px 155px}.avatar-hand-item{animation:itemFloat ${duration(2.9)} ease-in-out infinite;transform-origin:center}.avatar-jet-flame{animation:flameFlicker ${duration(0.68)} ease-in-out infinite;transform-origin:bottom}${still}@media (prefers-reduced-motion:reduce){.avatar2d *{animation:none!important}}</style>`;
}

function renderBackground(spec: LajukanAvatarSpec): string {
  const arcade = spec.background === 'neon';
  const base = `<rect width="256" height="256" fill="url(#avatarBg)"/><circle cx="128" cy="91" r="98" fill="url(#avatarSpot)"/><path d="M12 210c40-22 70-18 104 0 35 19 75 20 132-7v53H12v-46Z" fill="#ffffff" opacity="${arcade ? '.14' : '.32'}"/><path d="M31 45h31M201 55h20M34 177h18M207 166h24" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="${arcade ? '.22' : '.44'}"/>`;
  if (spec.background === 'market') {
    return `${base}<g opacity=".42"><path d="M32 72h192l-18 32H50L32 72Z" fill="#ef4444"/><path d="M50 104h156v24H50z" fill="#ffffff"/><path d="M61 104v24M92 104v24M123 104v24M154 104v24M185 104v24" stroke="#0f766e" stroke-width="5"/></g>`;
  }
  if (spec.background === 'workshop') {
    return `${base}<g opacity=".38" stroke="#92400e" stroke-width="6" stroke-linecap="round"><path d="M31 151h194"/><path d="M54 135l24-28 24 28M158 136l23-27 23 27"/><path d="M70 156v45M184 156v45"/></g>`;
  }
  if (spec.background === 'warehouse') {
    return `${base}<g opacity=".38"><path d="M31 97h194v114H31z" fill="#64748b"/><path d="M50 117h35v33H50zM111 117h35v33h-35zM172 117h35v33h-35z" fill="#f8fafc"/><path d="M45 172h166" stroke="#f8fafc" stroke-width="6"/></g>`;
  }
  if (spec.background === 'studio') {
    return `${base}<g opacity=".46"><circle cx="54" cy="83" r="18" fill="#f8fafc"/><path d="M42 125h44v72H42zM181 91l33 17-33 17z" fill="#0f172a"/><path d="M169 108h12M176 108v79" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/></g>`;
  }
  if (spec.background === 'map') {
    return `${base}<g fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".48"><path d="M31 151c30-42 66-42 96 0s67 42 98 0"/><path d="M45 76c27 21 53 21 79 0s54-21 87 0"/></g><g fill="#ef4444" opacity=".7"><path d="M201 94a16 16 0 0 0-16 16c0 14 16 31 16 31s16-17 16-31a16 16 0 0 0-16-16Zm0 22a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"/></g>`;
  }
  if (spec.background === 'night') {
    return `${base}<g fill="#fef3c7" opacity=".72"><circle cx="55" cy="63" r="3"/><circle cx="88" cy="42" r="2.5"/><circle cx="190" cy="57" r="3"/><circle cx="214" cy="102" r="2.5"/><path d="M139 39l4 8 9 3-9 3-4 8-4-8-9-3 9-3 4-8Z"/></g>`;
  }
  return base;
}

function renderAura(aura: AvatarAuraId): string {
  if (aura === 'none') return '';
  if (aura === 'halo') {
    return `<g class="avatar-aura"><ellipse cx="128" cy="57" rx="36" ry="12" fill="none" stroke="#fde68a" stroke-width="7"/><ellipse cx="128" cy="57" rx="48" ry="16" fill="none" stroke="#fff7d6" stroke-width="2" opacity=".76"/></g>`;
  }
  if (aura === 'energy') {
    return `<circle class="avatar-aura" cx="128" cy="132" r="93" fill="none" stroke="#5eead4" stroke-width="7" stroke-dasharray="10 12" opacity=".72"/>`;
  }
  if (aura === 'rainbow') {
    return `<g class="avatar-aura" fill="none" stroke-width="5" opacity=".78"><circle cx="128" cy="130" r="95" stroke="#f9a8d4"/><circle cx="128" cy="130" r="84" stroke="#fde68a"/><circle cx="128" cy="130" r="73" stroke="#86efac"/></g>`;
  }
  if (aura === 'orbit') {
    return `<g class="avatar-aura" fill="none" stroke-linecap="round"><ellipse cx="128" cy="132" rx="90" ry="48" stroke="#a78bfa" stroke-width="6" stroke-dasharray="16 18" opacity=".72"/><circle cx="205" cy="132" r="7" fill="#fef3c7"/></g>`;
  }
  if (aura === 'flame') {
    return `<g class="avatar-aura" opacity=".72"><path d="M48 203c-14-64 22-111 47-132-3 40 30 46 33 84 4-31 31-44 38-78 34 38 53 77 43 126-25-20-137-20-161 0Z" fill="#fb923c"/><path d="M74 202c-7-38 15-68 36-87 0 30 28 37 27 73 9-25 25-35 34-56 17 22 27 45 19 70-27-11-87-11-116 0Z" fill="#fde68a" opacity=".72"/></g>`;
  }
  if (aura === 'stars') {
    return `<g class="avatar-spark" fill="#fde68a" opacity=".9"><path d="M58 58l6 13 14 5-14 5-6 13-6-13-14-5 14-5 6-13ZM204 76l5 11 12 4-12 5-5 11-5-11-12-5 12-4 5-11ZM48 176l5 11 12 5-12 4-5 11-5-11-12-4 12-5 5-11ZM210 183l6 13 14 5-14 5-6 13-6-13-14-5 14-5 6-13Z"/></g>`;
  }
  if (aura === 'coins') {
    return `<g class="avatar-spark" fill="#facc15" stroke="#a16207" stroke-width="2" opacity=".86"><circle cx="54" cy="84" r="9"/><circle cx="205" cy="92" r="8"/><circle cx="45" cy="173" r="8"/><circle cx="214" cy="180" r="9"/><path d="M54 79v10M205 88v8M214 175v10" stroke="#fef3c7" stroke-width="2"/></g>`;
  }
  if (aura === 'mist') {
    return `<g class="avatar-aura" fill="none" stroke="#bae6fd" stroke-width="9" stroke-linecap="round" opacity=".58"><path d="M37 149c28-18 54-18 82 0s56 18 100-5"/><path d="M48 181c32-14 59-12 84 2s51 13 83-2"/><path d="M54 111c19-14 44-14 63 0s43 13 70-4"/></g>`;
  }
  if (aura === 'matrix') {
    return `<g class="avatar-aura" fill="#86efac" font-family="monospace" font-size="16" font-weight="700" opacity=".62"><text x="34" y="78">01</text><text x="197" y="91">10</text><text x="43" y="183">11</text><text x="190" y="180">01</text><path d="M31 54v151M224 48v157" stroke="#86efac" stroke-width="3" stroke-dasharray="8 12"/></g>`;
  }
  return `<g class="avatar-spark" fill="#fff7d6"><path d="M58 72l5 10 11 4-11 4-5 10-5-10-11-4 11-4 5-10ZM205 83l4 8 9 3-9 4-4 8-4-8-9-4 9-3 4-8ZM46 169l4 8 8 4-8 3-4 8-4-8-8-3 8-4 4-8ZM212 180l5 10 10 4-10 4-5 10-5-10-10-4 10-4 5-10Z"/></g>`;
}

function renderBackItem(spec: LajukanAvatarSpec): string {
  if (spec.backItem === 'cape') {
    return `<path class="avatar-cape" d="M89 148c18 16 60 16 78 0l24 88c-34 15-88 15-126 0l24-88Z" fill="#ef4444" opacity=".86"/><path d="M91 154c17 12 56 12 74 0l4 18c-24 10-55 10-82 0l4-18Z" fill="#fecaca" opacity=".38"/>`;
  }
  if (spec.backItem === 'sword') {
    return `<g transform="rotate(38 174 151)" opacity=".94"><path d="M171 45h12v151h-12z" fill="#cbd5e1" stroke="#334155" stroke-width="3"/><path d="M159 184h37v11h-37z" fill="#334155"/><path d="M177 25l17 25h-34l17-25Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/></g>`;
  }
  if (spec.backItem === 'shield') {
    return `<path d="M190 140c24 9 34 13 34 13-1 39-14 60-34 75-20-15-33-36-34-75 0 0 10-4 34-13Z" fill="#38bdf8" stroke="#0f172a" stroke-width="4" opacity=".9"/><path d="M190 153v55M169 163h42" stroke="#e0f2fe" stroke-width="5" stroke-linecap="round" opacity=".9"/>`;
  }
  if (spec.backItem === 'jetpack') {
    return `<g><rect x="72" y="139" width="25" height="69" rx="10" fill="#64748b" stroke="#334155" stroke-width="3"/><rect x="159" y="139" width="25" height="69" rx="10" fill="#64748b" stroke="#334155" stroke-width="3"/><path class="avatar-jet-flame" d="M78 207l7 26 8-26" fill="#fb923c"/><path class="avatar-jet-flame" d="M165 207l7 26 8-26" fill="#fb923c"/></g>`;
  }
  if (spec.backItem === 'banner') {
    return `<g opacity=".94"><path d="M63 67v153" stroke="#334155" stroke-width="7" stroke-linecap="round"/><path d="M66 72h74l-12 24 12 24H66V72Z" fill="#10b981" stroke="#0f172a" stroke-width="4"/><path d="M82 91h36" stroke="#dcfce7" stroke-width="6" stroke-linecap="round"/></g>`;
  }
  if (spec.backItem === 'backpack') {
    return `<g opacity=".94"><rect x="75" y="132" width="106" height="82" rx="26" fill="#92400e" stroke="#0f172a" stroke-width="4"/><path d="M91 149h74M98 132c5-23 55-23 60 0" fill="none" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/><path d="M92 172h72v30H92z" fill="#b45309" opacity=".82"/></g>`;
  }
  if (spec.backItem === 'toolbox') {
    return `<g opacity=".94"><rect x="57" y="164" width="142" height="52" rx="13" fill="#ef4444" stroke="#0f172a" stroke-width="4"/><path d="M103 164v-13h50v13" fill="none" stroke="#0f172a" stroke-width="5"/><path d="M67 181h122" stroke="#fecaca" stroke-width="5"/><rect x="118" y="176" width="20" height="16" rx="4" fill="#fef3c7" stroke="#0f172a" stroke-width="3"/></g>`;
  }
  if (spec.backItem === 'drone') {
    return `<g class="avatar-hand-item" opacity=".92"><rect x="92" y="61" width="72" height="28" rx="14" fill="#64748b" stroke="#0f172a" stroke-width="4"/><circle cx="72" cy="75" r="16" fill="none" stroke="#94a3b8" stroke-width="5"/><circle cx="184" cy="75" r="16" fill="none" stroke="#94a3b8" stroke-width="5"/><path d="M88 75H72M168 75h16" stroke="#0f172a" stroke-width="4"/><circle cx="128" cy="75" r="6" fill="#67e8f9"/></g>`;
  }
  if (spec.backItem === 'guitar') {
    return `<g transform="rotate(-26 76 155)" opacity=".94"><path d="M66 79h11v93H66z" fill="#92400e" stroke="#0f172a" stroke-width="3"/><ellipse cx="72" cy="184" rx="25" ry="34" fill="#b45309" stroke="#0f172a" stroke-width="4"/><circle cx="72" cy="184" r="9" fill="#451a03"/><path d="M72 89v103" stroke="#fef3c7" stroke-width="2"/></g>`;
  }
  if (spec.backItem === 'ledger') {
    return `<g opacity=".94"><rect x="163" y="135" width="51" height="72" rx="10" fill="#0f766e" stroke="#0f172a" stroke-width="4"/><path d="M176 153h25M176 169h20M176 185h25" stroke="#ccfbf1" stroke-width="4" stroke-linecap="round"/><path d="M163 147c-18 10-18 46 0 56" fill="none" stroke="#99f6e4" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  return '';
}

function renderWings(wing: AvatarWingId): string {
  if (wing === 'none') return '';
  if (wing === 'crystal') {
    return `<g opacity=".95"><g class="avatar-wing-left"><path d="M30 141l58-73 37 72-52 50Z" fill="#67e8f9" stroke="#0891b2" stroke-width="4"/><path d="M63 94l-2 83M88 68l-11 122M110 118l-37 72" stroke="#cffafe" stroke-width="4" opacity=".72"/><path d="M49 139l32-38 17 39-27 26Z" fill="#ecfeff" opacity=".72"/></g><g class="avatar-wing-right"><path d="M226 141l-58-73-37 72 52 50Z" fill="#67e8f9" stroke="#0891b2" stroke-width="4"/><path d="M193 94l2 83M168 68l11 122M146 118l37 72" stroke="#cffafe" stroke-width="4" opacity=".72"/><path d="M207 139l-32-38-17 39 27 26Z" fill="#ecfeff" opacity=".72"/></g></g>`;
  }
  if (wing === 'flame') {
    return `<g opacity=".94"><path class="avatar-wing-left" d="M42 180c-26-44 0-81 35-118 0 31 28 37 35 68 6 30-18 64-70 50Z" fill="#fb923c" stroke="#ea580c" stroke-width="4"/><path d="M62 167c-10-25 11-48 30-68 2 24 20 35 20 58-11-11-28-9-50 10Z" fill="#fde68a" opacity=".8"/><path class="avatar-wing-right" d="M214 180c26-44 0-81-35-118 0 31-28 37-35 68-6 30 18 64 70 50Z" fill="#fb923c" stroke="#ea580c" stroke-width="4"/><path d="M194 167c10-25-11-48-30-68-2 24-20 35-20 58 11-11 28-9 50 10Z" fill="#fde68a" opacity=".8"/></g>`;
  }
  if (wing === 'leaf') {
    return `<g opacity=".94"><g class="avatar-wing-left"><path d="M34 146c38-65 83-63 103-11-42-5-65 20-87 49-14-7-20-21-16-38Z" fill="#86efac" stroke="#16a34a" stroke-width="4"/><path d="M51 163c28-15 53-29 80-32M75 142c-8 17-13 30-20 43M103 134c-2 18-6 32-13 48" stroke="#15803d" stroke-width="4" stroke-linecap="round"/></g><g class="avatar-wing-right"><path d="M222 146c-38-65-83-63-103-11 42-5 65 20 87 49 14-7 20-21 16-38Z" fill="#86efac" stroke="#16a34a" stroke-width="4"/><path d="M205 163c-28-15-53-29-80-32M181 142c8 17 13 30 20 43M153 134c2 18 6 32 13 48" stroke="#15803d" stroke-width="4" stroke-linecap="round"/></g></g>`;
  }
  if (wing === 'shadow') {
    return `<g opacity=".9"><path class="avatar-wing-left" d="M30 128c28-55 72-57 104 4-37 3-52 28-70 62-25-5-47-29-34-66Z" fill="#475569" stroke="#1e293b" stroke-width="4"/><path d="M52 142c21 0 41 8 63 26M44 168c18 1 35 7 52 18" stroke="#0f172a" stroke-width="5" stroke-linecap="round" opacity=".55"/><path class="avatar-wing-right" d="M226 128c-28-55-72-57-104 4 37 3 52 28 70 62 25-5 47-29 34-66Z" fill="#475569" stroke="#1e293b" stroke-width="4"/><path d="M204 142c-21 0-41 8-63 26M212 168c-18 1-35 7-52 18" stroke="#0f172a" stroke-width="5" stroke-linecap="round" opacity=".55"/></g>`;
  }
  if (wing === 'mechanical') {
    return `<g opacity=".95" stroke="#334155" stroke-width="4" stroke-linejoin="round"><g class="avatar-wing-left"><path d="M35 130l67-50 28 60-70 47Z" fill="#94a3b8"/><path d="M54 132l45-27M66 160l52-31M40 131l21-42 41-9" fill="none" stroke="#e2e8f0" stroke-width="4"/><circle cx="91" cy="118" r="7" fill="#38bdf8"/></g><g class="avatar-wing-right"><path d="M221 130l-67-50-28 60 70 47Z" fill="#94a3b8"/><path d="M202 132l-45-27M190 160l-52-31M216 131l-21-42-41-9" fill="none" stroke="#e2e8f0" stroke-width="4"/><circle cx="165" cy="118" r="7" fill="#38bdf8"/></g></g>`;
  }
  if (wing === 'royal') {
    return `<g opacity=".97"><g class="avatar-wing-left"><path d="M22 150c30-58 76-71 115-32-28 10-48 31-62 66-22 2-41-9-53-34Z" fill="#facc15" stroke="#92400e" stroke-width="4"/><path d="M34 148c24-15 52-24 85-28M57 171c14-22 32-38 54-49" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/><circle cx="66" cy="134" r="7" fill="#38bdf8"/></g><g class="avatar-wing-right"><path d="M234 150c-30-58-76-71-115-32 28 10 48 31 62 66 22 2 41-9 53-34Z" fill="#facc15" stroke="#92400e" stroke-width="4"/><path d="M222 148c-24-15-52-24-85-28M199 171c-14-22-32-38-54-49" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/><circle cx="190" cy="134" r="7" fill="#38bdf8"/></g></g>`;
  }
  if (wing === 'celestial') {
    return `<g opacity=".94"><g class="avatar-wing-left"><path d="M25 145c42-79 91-82 112-26-42-5-69 20-86 67-17-8-28-21-26-41Z" fill="#a78bfa" stroke="#4c1d95" stroke-width="4"/><path d="M45 151c31-29 58-43 83-43" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/><path d="M71 92l5 11 12 4-12 5-5 11-5-11-12-5 12-4 5-11Z" fill="#fef3c7"/></g><g class="avatar-wing-right"><path d="M231 145c-42-79-91-82-112-26 42-5 69 20 86 67 17-8 28-21 26-41Z" fill="#a78bfa" stroke="#4c1d95" stroke-width="4"/><path d="M211 151c-31-29-58-43-83-43" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/><path d="M185 92l5 11 12 4-12 5-5 11-5-11-12-5 12-4 5-11Z" fill="#fef3c7"/></g></g>`;
  }
  if (wing === 'phoenix') {
    return `<g opacity=".96"><g class="avatar-wing-left"><path d="M27 184c-12-62 29-101 95-123-15 31-4 51 21 61-46 10-70 34-79 78-14-1-27-6-37-16Z" fill="#f97316" stroke="#7c2d12" stroke-width="4"/><path d="M47 176c16-40 42-70 78-90M75 195c8-28 25-50 51-67" stroke="#fde68a" stroke-width="5" stroke-linecap="round"/></g><g class="avatar-wing-right"><path d="M229 184c12-62-29-101-95-123 15 31 4 51-21 61 46 10 70 34 79 78 14-1 27-6 37-16Z" fill="#f97316" stroke="#7c2d12" stroke-width="4"/><path d="M209 176c-16-40-42-70-78-90M181 195c-8-28-25-50-51-67" stroke="#fde68a" stroke-width="5" stroke-linecap="round"/></g></g>`;
  }
  if (wing === 'dragon') {
    return `<g opacity=".94"><g class="avatar-wing-left"><path d="M29 149c20-56 65-70 107-30l-37 12 31 20-39 9 24 25c-34 2-65-9-86-36Z" fill="#22c55e" stroke="#14532d" stroke-width="4" stroke-linejoin="round"/><path d="M52 146c23-12 48-21 75-28" stroke="#bbf7d0" stroke-width="5" stroke-linecap="round"/></g><g class="avatar-wing-right"><path d="M227 149c-20-56-65-70-107-30l37 12-31 20 39 9-24 25c34 2 65-9 86-36Z" fill="#22c55e" stroke="#14532d" stroke-width="4" stroke-linejoin="round"/><path d="M204 146c-23-12-48-21-75-28" stroke="#bbf7d0" stroke-width="5" stroke-linecap="round"/></g></g>`;
  }
  if (wing === 'prism') {
    return `<g opacity=".95"><g class="avatar-wing-left"><path d="M32 145l31-60 31 51-13 57Z" fill="#67e8f9" stroke="#0e7490" stroke-width="4"/><path d="M82 83l38 54-40 55 13-56Z" fill="#f0abfc" stroke="#86198f" stroke-width="4"/><path d="M55 139l30-3M77 104l15 32" stroke="#ffffff" stroke-width="4" opacity=".72"/></g><g class="avatar-wing-right"><path d="M224 145l-31-60-31 51 13 57Z" fill="#67e8f9" stroke="#0e7490" stroke-width="4"/><path d="M174 83l-38 54 40 55-13-56Z" fill="#f0abfc" stroke="#86198f" stroke-width="4"/><path d="M201 139l-30-3M179 104l-15 32" stroke="#ffffff" stroke-width="4" opacity=".72"/></g></g>`;
  }
  if (wing === 'butterfly') {
    return `<g opacity=".94"><g class="avatar-wing-left"><path d="M28 121c19-54 66-60 98-12-30 8-43 28-45 58-28-1-50-15-53-46Z" fill="#f0abfc" stroke="#86198f" stroke-width="4"/><path d="M42 186c-2-35 18-58 54-65 8 35-7 60-54 65Z" fill="#67e8f9" stroke="#0e7490" stroke-width="4"/><circle cx="70" cy="126" r="8" fill="#fef3c7"/></g><g class="avatar-wing-right"><path d="M228 121c-19-54-66-60-98-12 30 8 43 28 45 58 28-1 50-15 53-46Z" fill="#f0abfc" stroke="#86198f" stroke-width="4"/><path d="M214 186c2-35-18-58-54-65-8 35 7 60 54 65Z" fill="#67e8f9" stroke="#0e7490" stroke-width="4"/><circle cx="186" cy="126" r="8" fill="#fef3c7"/></g></g>`;
  }
  if (wing === 'techno') {
    return `<g opacity=".95" stroke-linejoin="round"><g class="avatar-wing-left"><path d="M31 139l75-66 30 45-53 82-18-39-34 6Z" fill="#38bdf8" stroke="#0f172a" stroke-width="4"/><path d="M67 143l47-47M82 172l43-55" stroke="#e0f2fe" stroke-width="4"/><circle cx="94" cy="121" r="7" fill="#22d3ee"/></g><g class="avatar-wing-right"><path d="M225 139l-75-66-30 45 53 82 18-39 34 6Z" fill="#38bdf8" stroke="#0f172a" stroke-width="4"/><path d="M189 143l-47-47M174 172l-43-55" stroke="#e0f2fe" stroke-width="4"/><circle cx="162" cy="121" r="7" fill="#22d3ee"/></g></g>`;
  }
  if (wing === 'renaissance') {
    return `<g opacity=".96"><g class="avatar-wing-left"><path d="M24 146c29-64 83-75 116-25-38 8-62 30-78 67-18-2-31-16-38-42Z" fill="#fef3c7" stroke="#92400e" stroke-width="4"/><path d="M41 145c28-18 58-27 90-27M57 172c18-25 40-42 66-52" stroke="#d97706" stroke-width="5" stroke-linecap="round"/><path d="M47 120c18-24 43-37 78-39" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".7"/></g><g class="avatar-wing-right"><path d="M232 146c-29-64-83-75-116-25 38 8 62 30 78 67 18-2 31-16 38-42Z" fill="#fef3c7" stroke="#92400e" stroke-width="4"/><path d="M215 145c-28-18-58-27-90-27M199 172c-18-25-40-42-66-52" stroke="#d97706" stroke-width="5" stroke-linecap="round"/><path d="M209 120c-18-24-43-37-78-39" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".7"/></g></g>`;
  }
  return `<g opacity=".96"><g class="avatar-wing-left"><path d="M30 126c28-48 68-51 99 2-34 5-54 26-71 62-18 2-34-8-42-23-8-16-1-30 14-41Z" fill="#ffffff" stroke="#e0f2fe" stroke-width="4"/><path d="M45 136c25 2 48 11 68 30M35 162c23-1 43 7 61 24M71 110c12 21 22 44 27 70" stroke="#bfdbfe" stroke-width="5" stroke-linecap="round"/></g><g class="avatar-wing-right"><path d="M226 126c-28-48-68-51-99 2 34 5 54 26 71 62 18 2 34-8 42-23 8-16 1-30-14-41Z" fill="#ffffff" stroke="#e0f2fe" stroke-width="4"/><path d="M211 136c-25 2-48 11-68 30M221 162c-23-1-43 7-61 24M185 110c-12 21-22 44-27 70" stroke="#bfdbfe" stroke-width="5" stroke-linecap="round"/></g></g>`;
}

function renderLegs(spec: LajukanAvatarSpec, skin: string): string {
  const wide = isWideBody(spec);
  const tall = isTallBody(spec);
  const rounded = spec.body === 'rounded';
  const leftX = wide ? 98 : rounded ? 102 : 103;
  const rightX = wide ? 137 : rounded ? 134 : 134;
  const legY = tall ? 192 : 198;
  const legHeight = tall ? 36 : 30;
  return `<g><rect x="${leftX}" y="${legY}" width="20" height="${legHeight}" rx="9" fill="${skin}"/><rect x="${rightX}" y="${legY}" width="20" height="${legHeight}" rx="9" fill="${skin}"/><path d="M91 226c13-8 27-8 39 0v9H91v-9ZM126 226c13-8 27-8 39 0v9h-39v-9Z" fill="#0f172a" opacity=".9"/></g>`;
}

function renderTorso(spec: LajukanAvatarSpec, outfit: string): string {
  const wide = isWideBody(spec);
  const tall = isTallBody(spec);
  const torso =
    spec.body === 'rounded'
      ? 'M80 158c20-23 76-23 96 0l-6 56H86l-6-56Z'
      : tall
        ? 'M84 150c19-21 69-21 88 0l-8 66H92l-8-66Z'
        : wide
          ? 'M78 155c21-21 81-21 101 0l-12 58H90l-12-58Z'
          : 'M83 156c18-20 72-20 90 0l-10 58H93l-10-58Z';
  const base = `<path class="avatar-breath" d="${torso}" fill="${outfit}" stroke="#0f172a" stroke-width="4" stroke-linejoin="round" opacity=".96"/>`;
  if (spec.outfit === 'hoodie') {
    return `${base}<path d="M101 159c9 15 45 15 54 0" fill="none" stroke="#e0f2fe" stroke-width="5" stroke-linecap="round" opacity=".65"/><path d="M112 177v31M144 177v31" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round" opacity=".75"/><path d="M107 180c13 8 29 8 42 0" fill="none" stroke="#0f172a" stroke-width="3" opacity=".35"/>`;
  }
  if (spec.outfit === 'batik') {
    return `${base}<path d="M95 173c16 7 28 7 44 0s24-7 35 0M90 195c17-8 30-8 46 0s25 8 34 0" fill="none" stroke="#fde68a" stroke-width="5" stroke-linecap="round" opacity=".8"/><circle cx="115" cy="184" r="4" fill="#fde68a"/><circle cx="146" cy="197" r="4" fill="#fde68a"/>`;
  }
  if (spec.outfit === 'apron') {
    return `${base}<path d="M101 159h54l8 54H93l8-54Z" fill="#f8fafc" opacity=".86"/><path d="M111 185h34v18h-34z" fill="${outfit}" opacity=".72"/><path d="M101 160l-16 20M155 160l16 20" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (spec.outfit === 'jacket') {
    return `${base}<path d="M92 159l27 53M164 159l-27 53" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round" opacity=".75"/><path d="M122 163h12v48h-12z" fill="#f8fafc" opacity=".7"/><path d="M101 185h18M138 185h18" stroke="#0f172a" stroke-width="3" opacity=".38"/>`;
  }
  if (spec.outfit === 'driver') {
    return `${base}<path d="M96 174h64v16H96z" fill="#fef3c7" opacity=".85"/><path d="M107 164l-11 49M149 164l11 49" stroke="#0f172a" stroke-width="4" opacity=".35"/><path d="M112 197h32" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (spec.outfit === 'suit') {
    return `${base}<path d="M95 158l27 56M161 158l-27 56" stroke="#f8fafc" stroke-width="6" stroke-linecap="round" opacity=".9"/><path d="M119 164h18l-5 18 8 32h-24l8-32-5-18Z" fill="#0f172a" opacity=".9"/><path d="M111 164c9 10 25 10 34 0" fill="none" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (spec.outfit === 'uniform') {
    return `${base}<path d="M96 174h64" stroke="#f8fafc" stroke-width="6" opacity=".82"/><path d="M108 162h17v19h-17zM132 162h17v19h-17z" fill="#e0f2fe" opacity=".72"/><circle cx="128" cy="195" r="8" fill="#facc15" stroke="#0f172a" stroke-width="3"/>`;
  }
  if (spec.outfit === 'overalls') {
    return `${base}<path d="M102 159v54M154 159v54" stroke="#fef3c7" stroke-width="7" stroke-linecap="round"/><path d="M98 181h60v33H98z" fill="#1d4ed8" opacity=".74"/><path d="M116 194h24" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (spec.outfit === 'kebaya') {
    return `${base}<path d="M95 164c16 20 50 20 66 0M104 184c11 8 37 8 48 0" fill="none" stroke="#f9a8d4" stroke-width="5" stroke-linecap="round"/><path d="M112 161l16 52 16-52" fill="none" stroke="#fef3c7" stroke-width="4"/><circle cx="111" cy="193" r="4" fill="#fef3c7"/><circle cx="145" cy="193" r="4" fill="#fef3c7"/>`;
  }
  if (spec.outfit === 'chefcoat') {
    return `${base}<path d="M96 160h64v54H96z" fill="#f8fafc" opacity=".88"/><path d="M128 161v53M109 174h13M109 190h13M134 174h13M134 190h13" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><path d="M104 160c9 13 39 13 48 0" fill="none" stroke="#e2e8f0" stroke-width="5"/>`;
  }
  if (spec.outfit === 'vest') {
    return `${base}<path d="M96 160l25 54M160 160l-25 54" stroke="#fef3c7" stroke-width="7" stroke-linecap="round"/><path d="M109 185h15M133 185h15" stroke="#0f172a" stroke-width="4" opacity=".38"/><path d="M122 164h12v49h-12z" fill="#f8fafc" opacity=".72"/>`;
  }
  return `${base}<path d="M101 165c13 13 41 13 54 0" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".46"/><path d="M112 191h31" stroke="#0f172a" stroke-width="3" stroke-linecap="round" opacity=".24"/>`;
}

function renderArms(spec: LajukanAvatarSpec, skin: string): string {
  if (spec.pose === 'hero') {
    return `<g fill="${skin}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M89 164c-23 2-38 18-37 38 1 15 18 18 29 7 10-10 15-25 14-43"/><path d="M167 164c23 2 38 18 37 38-1 15-18 18-29 7-10-10-15-25-14-43"/></g>`;
  }
  if (spec.pose === 'hold') {
    return `<g fill="${skin}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M91 166c-20 13-24 29-13 39 9 8 23 3 30-10 5-9 1-21-10-31"/><path d="M165 166c21 8 29 22 21 35-8 12-25 10-34-2-7-10-2-25 8-35"/></g>`;
  }
  if (spec.pose === 'wave') {
    return `<g fill="${skin}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M88 166c-23-4-35-17-31-33 6-22 22-25 31-9 6 11 8 23 7 38"/><path d="M168 166c20 10 30 25 20 41-8 12-24 8-30-5-5-11-4-23 3-37"/></g>`;
  }
  if (spec.pose === 'ready') {
    return `<g fill="${skin}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M90 164c-24 11-33 29-22 41 10 10 25 3 31-12 4-10 4-20-1-30"/><path d="M166 164c24 11 33 29 22 41-10 10-25 3-31-12-4-10-4-20 1-30"/></g>`;
  }
  return `<g fill="${skin}" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M91 165c-22 10-29 29-17 41 10 9 24 1 29-14 4-11 2-20-5-30"/><path d="M165 165c22 10 29 29 17 41-10 9-24 1-29-14-4-11-2-20 5-30"/></g>`;
}

function renderHeadBase(skin: string): string {
  return `<ellipse cx="83" cy="111" rx="12" ry="17" fill="${skin}" stroke="#0f172a" stroke-width="3" opacity=".96"/><ellipse cx="173" cy="111" rx="12" ry="17" fill="${skin}" stroke="#0f172a" stroke-width="3" opacity=".96"/><rect x="109" y="139" width="38" height="28" rx="15" fill="${skin}"/><circle cx="128" cy="105" r="47" fill="${skin}" stroke="#0f172a" stroke-width="4"/>`;
}

function renderHair(spec: LajukanAvatarSpec, hair: string): string {
  if (spec.headwear === 'hijab' || spec.headwear === 'helmet') return '';
  if (spec.hair === 'fade') {
    return `<g class="avatar-hair"><path d="M79 92c8-34 35-51 66-42 26 8 37 29 35 55-27-20-60-23-101-13Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M84 111c7 19 82 18 91-3-28 7-62 7-91 3Z" fill="#0f172a" opacity=".28"/><path d="M96 82c20-11 43-12 65-2" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".14"/></g>`;
  }
  if (spec.hair === 'sidepart') {
    return `<g class="avatar-hair"><path d="M76 99c5-35 31-57 66-52 29 4 44 26 45 59-28-19-61-24-111-7Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M116 54c-9 18-19 32-36 42" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".18"/><path d="M118 55c17 9 34 19 54 41" fill="none" stroke="#0f172a" stroke-width="4" opacity=".22"/></g>`;
  }
  if (spec.hair === 'ponytail') {
    return `<g class="avatar-hair"><path d="M77 99c6-35 32-55 64-50 30 5 45 29 44 62-30-25-67-27-108-12Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M165 91c33 12 34 55 2 69-11-17-15-43-2-69Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M93 84c23-18 48-21 75-8" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".15"/></g>`;
  }
  if (spec.hair === 'braids') {
    return `<g class="avatar-hair" fill="${hair}" stroke="#0f172a" stroke-width="4"><path d="M78 96c8-33 34-51 65-45 27 5 41 26 42 58-30-21-66-25-107-13Z"/><circle cx="83" cy="122" r="10"/><circle cx="77" cy="143" r="9"/><circle cx="73" cy="162" r="8"/><circle cx="174" cy="122" r="10"/><circle cx="180" cy="143" r="9"/><circle cx="184" cy="162" r="8"/></g>`;
  }
  if (spec.hair === 'spiky') {
    return `<g class="avatar-hair"><path d="M75 96l18-40 18 20 19-31 15 30 23-21 10 45c-31-19-66-20-103-3Z" fill="${hair}" stroke="#0f172a" stroke-width="4" stroke-linejoin="round"/><path d="M93 88c22-13 48-14 76-2" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".14"/></g>`;
  }
  if (spec.hair === 'curly') {
    return `<g class="avatar-hair" fill="${hair}" stroke="#0f172a" stroke-width="3"><circle cx="91" cy="84" r="18"/><circle cx="112" cy="65" r="18"/><circle cx="139" cy="62" r="20"/><circle cx="164" cy="79" r="19"/><circle cx="174" cy="105" r="18"/><circle cx="78" cy="108" r="17"/></g>`;
  }
  if (spec.hair === 'long') {
    return `<g class="avatar-hair"><path d="M75 101c-1-36 22-59 55-59 35 0 58 24 58 62 0 44-21 78-57 78-38 0-57-34-56-81Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M89 86c13-25 55-38 80 0-15 18-30 25-47 25-15 0-25-8-33-25Z" fill="#ffffff" opacity=".14"/></g>`;
  }
  if (spec.hair === 'bun') {
    return `<g class="avatar-hair"><path d="M81 96c7-34 32-52 61-46 29 6 43 30 41 60-26-25-63-25-102-14Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><circle cx="150" cy="43" r="19" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M100 78c19-14 44-17 66-3" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".12"/></g>`;
  }
  if (spec.hair === 'wave') {
    return `<g class="avatar-hair"><path d="M75 102c5-39 32-61 67-54 32 6 46 33 43 67-18-22-37-33-59-30-21 2-35 9-51 17Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M84 90c18-29 59-36 88-8-23-8-45-6-66 7-8 5-15 5-22 1Z" fill="#ffffff" opacity=".16"/></g>`;
  }
  return `<g class="avatar-hair"><path d="M80 91c8-32 32-48 61-40 25 7 37 26 38 51-29-21-63-23-99-11Z" fill="${hair}" stroke="#0f172a" stroke-width="4"/><path d="M93 83c20-12 42-14 66-4" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".14"/></g>`;
}

function renderHeadwear(spec: LajukanAvatarSpec): string {
  if (spec.headwear === 'cap') {
    return `<g><path d="M86 65c15-25 72-29 91 1l-6 24H91l-5-25Z" fill="#0f766e" stroke="#0f172a" stroke-width="4"/><path d="M111 78c34-2 61 3 80 13-18 8-51 8-84 2l4-15Z" fill="#115e59" stroke="#0f172a" stroke-width="4"/><path d="M103 68c18-8 42-9 61-1" stroke="#99f6e4" stroke-width="4" stroke-linecap="round" opacity=".55"/></g>`;
  }
  if (spec.headwear === 'beanie') {
    return `<g><path d="M87 70c11-31 76-33 91 0v23H87V70Z" fill="#be123c" stroke="#0f172a" stroke-width="4"/><path d="M91 87h83v15H91z" fill="#9f1239" stroke="#0f172a" stroke-width="3"/><path d="M104 75v25M121 68v32M139 68v32M157 75v25" stroke="#fecdd3" stroke-width="3" opacity=".62"/></g>`;
  }
  if (spec.headwear === 'hijab') {
    return `<g><path d="M78 118c2-46 23-77 52-77s52 32 54 77c3 43-15 70-53 70-39 0-56-28-53-70Z" fill="#334155" stroke="#0f172a" stroke-width="4"/><path d="M98 88c13-21 51-29 68 0-7 18-19 27-34 27s-27-9-34-27Z" fill="#64748b"/><path d="M92 137c18 18 55 20 74 0" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" opacity=".45"/></g>`;
  }
  if (spec.headwear === 'chef') {
    return `<g><path d="M84 68c-8-24 19-41 37-25 12-23 47-14 48 11 22-1 31 28 10 41H84V68Z" fill="#f8fafc" stroke="#0f172a" stroke-width="4"/><path d="M92 91h75v18H92z" fill="#e2e8f0" stroke="#0f172a" stroke-width="4"/><path d="M112 55v38M137 49v43M160 63v31" stroke="#cbd5e1" stroke-width="4" opacity=".75"/></g>`;
  }
  if (spec.headwear === 'helmet') {
    return `<g><path d="M80 82c7-35 34-55 67-46 29 8 43 31 42 65-34-22-70-25-109-19Z" fill="#f59e0b" stroke="#0f172a" stroke-width="4"/><path d="M92 78c23-12 50-13 80-2" stroke="#fef3c7" stroke-width="5" stroke-linecap="round" opacity=".75"/><path d="M169 92h22c4 0 7 3 7 7v6h-29z" fill="#0f172a"/></g>`;
  }
  if (spec.headwear === 'snapback') {
    return `<g><path d="M84 65c16-26 72-28 92 2l-7 25H90l-6-27Z" fill="#0ea5e9" stroke="#0f172a" stroke-width="4"/><path d="M101 79c-24 5-38 12-45 23 22 3 50-1 72-10l-27-13Z" fill="#0369a1" stroke="#0f172a" stroke-width="4"/><path d="M119 66l7 25" stroke="#bae6fd" stroke-width="4" opacity=".7"/></g>`;
  }
  if (spec.headwear === 'bucket') {
    return `<g><path d="M84 67c15-24 72-24 88 0l7 27H77l7-27Z" fill="#84cc16" stroke="#0f172a" stroke-width="4"/><path d="M70 91c38 12 78 12 116 0l8 14c-45 12-87 12-132 0l8-14Z" fill="#65a30d" stroke="#0f172a" stroke-width="4"/><path d="M101 74c18-7 37-7 55 0" stroke="#ecfccb" stroke-width="4" stroke-linecap="round" opacity=".65"/></g>`;
  }
  if (spec.headwear === 'fedora') {
    return `<g><path d="M91 62c18-17 57-17 74 0l8 30H83l8-30Z" fill="#92400e" stroke="#0f172a" stroke-width="4"/><path d="M65 87c38 10 87 10 126 0l9 13c-46 12-98 12-144 0l9-13Z" fill="#78350f" stroke="#0f172a" stroke-width="4"/><path d="M89 81h80" stroke="#fbbf24" stroke-width="6" opacity=".8"/></g>`;
  }
  if (spec.headwear === 'visor') {
    return `<g><path d="M82 74c20-18 69-18 91 0v15H82V74Z" fill="#14b8a6" stroke="#0f172a" stroke-width="4"/><path d="M106 87c37-1 66 5 88 16-22 8-58 8-91 1l3-17Z" fill="#99f6e4" stroke="#0f172a" stroke-width="4" opacity=".95"/><path d="M98 77h60" stroke="#ccfbf1" stroke-width="4" stroke-linecap="round"/></g>`;
  }
  if (spec.headwear === 'crown') {
    return `<g><path d="M83 92l10-42 25 28 11-35 14 35 24-28 8 42H83Z" fill="#facc15" stroke="#0f172a" stroke-width="4" stroke-linejoin="round"/><circle cx="94" cy="54" r="5" fill="#38bdf8"/><circle cx="129" cy="43" r="5" fill="#ef4444"/><circle cx="166" cy="54" r="5" fill="#22c55e"/><path d="M93 84h73" stroke="#fef3c7" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  if (spec.headwear === 'turban') {
    return `<g><path d="M82 82c9-31 35-45 66-39 27 5 43 23 45 52-32-20-73-25-111-13Z" fill="#7c3aed" stroke="#0f172a" stroke-width="4"/><path d="M90 78c21 13 50 17 88 13M102 61c12 18 32 27 62 30M128 48c0 23 7 37 23 44" fill="none" stroke="#ddd6fe" stroke-width="5" stroke-linecap="round" opacity=".72"/><circle cx="128" cy="86" r="10" fill="#facc15" stroke="#0f172a" stroke-width="3"/></g>`;
  }
  return '';
}

function renderFace(spec: LajukanAvatarSpec): string {
  const blush = spec.faceAccessory === 'blush';
  const freckles = spec.faceAccessory === 'freckle';
  const cheeks = blush
    ? '<ellipse cx="103" cy="119" rx="9" ry="5" fill="#fda4af" opacity=".72"/><ellipse cx="153" cy="119" rx="9" ry="5" fill="#fda4af" opacity=".72"/>'
    : '';
  const dots = freckles
    ? '<g fill="#92400e" opacity=".62"><circle cx="103" cy="116" r="2"/><circle cx="111" cy="120" r="1.8"/><circle cx="151" cy="116" r="2"/><circle cx="144" cy="120" r="1.8"/></g>'
    : '';
  if (spec.mood === 'cool') {
    return `${cheeks}${dots}<path d="M118 128c8 6 20 6 28 0" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'wink') {
    return `${cheeks}${dots}<circle class="avatar-eye" cx="111" cy="105" r="4.5" fill="#111827"/><path d="M140 104h15" stroke="#111827" stroke-width="4" stroke-linecap="round"/><path d="M119 127c8 8 20 8 29 0" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'determined') {
    return `${cheeks}${dots}<path d="M104 100l15 4M152 100l-15 4" stroke="#111827" stroke-width="4" stroke-linecap="round"/><circle class="avatar-eye" cx="112" cy="108" r="3.8" fill="#111827"/><circle class="avatar-eye" cx="146" cy="108" r="3.8" fill="#111827"/><path d="M120 128h25" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'happy') {
    return `${cheeks}${dots}<path d="M104 104c5 6 12 6 17 0M136 104c5 6 12 6 17 0" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round"/><path d="M116 126c8 12 24 12 32 0" fill="none" stroke="#7f1d1d" stroke-width="5" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'serious') {
    return `${cheeks}${dots}<path d="M103 99h17M137 99h17" stroke="#111827" stroke-width="4" stroke-linecap="round"/><circle class="avatar-eye" cx="112" cy="108" r="3.8" fill="#111827"/><circle class="avatar-eye" cx="146" cy="108" r="3.8" fill="#111827"/><path d="M119 129h29" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'surprised') {
    return `${cheeks}${dots}<circle class="avatar-eye" cx="112" cy="105" r="5.5" fill="#111827"/><circle class="avatar-eye" cx="146" cy="105" r="5.5" fill="#111827"/><ellipse cx="132" cy="129" rx="8" ry="10" fill="#7f1d1d"/>${renderFaceAccessory(spec)}`;
  }
  if (spec.mood === 'proud') {
    return `${cheeks}${dots}<circle class="avatar-eye" cx="112" cy="105" r="4.5" fill="#111827"/><circle class="avatar-eye" cx="146" cy="105" r="4.5" fill="#111827"/><path d="M117 128c10 7 23 5 31-3" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/><path d="M103 96c6-4 13-4 20 0M136 96c8-5 16-5 23 0" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
  }
  return `${cheeks}${dots}<circle class="avatar-eye" cx="112" cy="105" r="4.5" fill="#111827"/><circle class="avatar-eye" cx="146" cy="105" r="4.5" fill="#111827"/><path d="M121 126c7 7 17 7 24 0" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>${renderFaceAccessory(spec)}`;
}

function renderFaceAccessory(spec: LajukanAvatarSpec): string {
  const nose = `<path d="M129 108l-4 12h10" fill="none" stroke="#9a5c3b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>`;
  if (spec.faceAccessory === 'mask') {
    return `<path d="M104 120c13 10 36 10 49 0v22c-13 10-36 10-49 0v-22Z" fill="#bae6fd" stroke="#0f172a" stroke-width="3" opacity=".94"/><path d="M107 127h43M110 136h37" stroke="#e0f2fe" stroke-width="2" opacity=".9"/>`;
  }
  if (spec.faceAccessory === 'mustache') {
    return `${nose}<path d="M110 124c9-9 17-9 23 0 7-9 16-9 25 0-10 8-18 8-25 1-6 7-14 7-23-1Z" fill="#312218" opacity=".92"/>`;
  }
  if (spec.faceAccessory === 'beard') {
    return `${nose}<path d="M103 124c11 27 43 31 59 0-13 21-47 21-59 0Z" fill="#312218" opacity=".9"/><path d="M116 140c8 8 22 8 30 0" fill="none" stroke="#f8fafc" stroke-width="3" opacity=".3"/>`;
  }
  if (spec.faceAccessory === 'scar') {
    return `${nose}<path d="M151 93l-15 25M144 99l10 4M138 109l10 4" stroke="#ef4444" stroke-width="3" stroke-linecap="round" opacity=".82"/>`;
  }
  if (spec.faceAccessory === 'bandage') {
    return `${nose}<rect x="99" y="116" width="24" height="11" rx="5" fill="#fde68a" stroke="#92400e" stroke-width="2" opacity=".92"/><path d="M108 118v7M115 118v7" stroke="#fef3c7" stroke-width="2"/>`;
  }
  return nose;
}

function renderEyewear(spec: LajukanAvatarSpec): string {
  if (spec.eyewear === 'glasses') {
    return `<g class="avatar-eyewear" fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round"><circle cx="112" cy="104" r="15"/><circle cx="151" cy="104" r="15"/><path d="M127 104h9"/><path d="M98 100l-10-4M165 100l10-4" opacity=".7"/></g>`;
  }
  if (spec.eyewear === 'shades') {
    return `<g class="avatar-eyewear"><path d="M96 98h31v16H96zM137 98h31v16h-31z" fill="#0f172a" stroke="#0f172a" stroke-width="4" stroke-linejoin="round"/><path d="M127 105h10" stroke="#0f172a" stroke-width="4"/><path d="M102 101h17M143 101h17" stroke="#ffffff" stroke-width="2" opacity=".42"/></g>`;
  }
  if (spec.eyewear === 'round') {
    return `<g class="avatar-eyewear" fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round"><circle cx="112" cy="104" r="13"/><circle cx="151" cy="104" r="13"/><path d="M125 104h13"/><path d="M101 98l-12-5M162 98l12-5" opacity=".65"/><path d="M106 98h8M145 98h8" stroke="#ffffff" stroke-width="2" opacity=".6"/></g>`;
  }
  if (spec.eyewear === 'goggles') {
    return `<g class="avatar-eyewear"><path d="M93 95h72v22H93z" fill="#bae6fd" stroke="#0f172a" stroke-width="4" opacity=".88"/><path d="M126 95v22" stroke="#0f172a" stroke-width="4"/><path d="M100 100h20M136 100h20" stroke="#ffffff" stroke-width="3" opacity=".7"/><path d="M88 104h-11M168 104h11" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/></g>`;
  }
  return '';
}

function renderGrip(x: number, y: number, skin: string): string {
  return `<ellipse cx="${x}" cy="${y}" rx="8" ry="7" fill="${skin}" stroke="#0f172a" stroke-width="3"/><path d="M${x - 6} ${y - 1}h12" stroke="#9a5c3b" stroke-width="2" stroke-linecap="round" opacity=".45"/>`;
}

function renderHandItem(spec: LajukanAvatarSpec, skin: string): string {
  const x = spec.pose === 'wave' ? 53 : spec.pose === 'hold' ? 164 : 178;
  const gripX = spec.pose === 'wave' ? x + 24 : x + 4;
  if (spec.handItem === 'phone') {
    return `<g class="avatar-hand-item"><rect x="${x}" y="169" width="20" height="34" rx="5" fill="#0f172a" stroke="#f8fafc" stroke-width="3"/><circle cx="${x + 10}" cy="196" r="2" fill="#f8fafc"/>${renderGrip(gripX, 187, skin)}</g>`;
  }
  if (spec.handItem === 'package') {
    const boxX = spec.pose === 'hold' ? 111 : x - 3;
    const grip =
      spec.pose === 'hold'
        ? `${renderGrip(112, 189, skin)}${renderGrip(144, 189, skin)}`
        : renderGrip(gripX, 190, skin);
    return `<g class="avatar-hand-item"><path d="M${boxX} 172h35v31h-35z" fill="#d97706" stroke="#0f172a" stroke-width="3"/><path d="M${boxX} 182h35M${boxX + 17} 172v31" stroke="#fef3c7" stroke-width="3"/>${grip}</g>`;
  }
  if (spec.handItem === 'wrench') {
    return `<g class="avatar-hand-item" stroke="#0f172a" stroke-width="4" stroke-linecap="round"><path d="M${x + 3} 197l28-30" stroke="#64748b"/><path d="M${x + 28} 166c-6 1-10 4-11 10l7 7c7-1 10-5 11-11" fill="none"/>${renderGrip(gripX, 190, skin)}</g>`;
  }
  if (spec.handItem === 'camera') {
    return `<g class="avatar-hand-item"><rect x="${x - 5}" y="174" width="35" height="25" rx="6" fill="#111827" stroke="#f8fafc" stroke-width="3"/><circle cx="${x + 13}" cy="187" r="7" fill="#38bdf8"/><path d="M${x + 2} 171h10" stroke="#111827" stroke-width="5"/>${renderGrip(gripX, 190, skin)}</g>`;
  }
  if (spec.handItem === 'coffee') {
    return `<g class="avatar-hand-item"><path d="M${x} 176h24v25a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8v-25Z" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/><path d="M${x + 24} 184h8a7 7 0 0 1 0 14h-8" fill="none" stroke="#0f172a" stroke-width="3"/><path d="M${x + 4} 181h16" stroke="#92400e" stroke-width="5"/>${renderGrip(gripX, 191, skin)}</g>`;
  }
  if (spec.handItem === 'tablet') {
    return `<g class="avatar-hand-item"><rect x="${x - 8}" y="166" width="34" height="45" rx="7" fill="#0f172a" stroke="#f8fafc" stroke-width="3"/><rect x="${x - 3}" y="173" width="24" height="28" rx="3" fill="#38bdf8" opacity=".75"/>${renderGrip(gripX, 190, skin)}</g>`;
  }
  if (spec.handItem === 'microphone') {
    return `<g class="avatar-hand-item"><rect x="${x + 5}" y="166" width="14" height="24" rx="7" fill="#334155" stroke="#0f172a" stroke-width="3"/><path d="M${x + 12} 190v22M${x + 2} 212h22" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/><path d="M${x + 5} 174h14" stroke="#cbd5e1" stroke-width="2"/>${renderGrip(gripX, 195, skin)}</g>`;
  }
  if (spec.handItem === 'megaphone') {
    return `<g class="avatar-hand-item"><path d="M${x - 3} 178l35-13v37l-35-12z" fill="#ef4444" stroke="#0f172a" stroke-width="3"/><path d="M${x + 32} 165h10v37h-10z" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/><path d="M${x + 4} 190l6 18" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>${renderGrip(gripX, 192, skin)}</g>`;
  }
  if (spec.handItem === 'spatula') {
    return `<g class="avatar-hand-item"><path d="M${x + 6} 206l18-43" stroke="#64748b" stroke-width="5" stroke-linecap="round"/><rect x="${x + 19}" y="154" width="17" height="20" rx="4" fill="#cbd5e1" stroke="#0f172a" stroke-width="3" transform="rotate(22 ${x + 27} 164)"/>${renderGrip(gripX, 193, skin)}</g>`;
  }
  if (spec.handItem === 'shoppingBag') {
    return `<g class="avatar-hand-item"><path d="M${x - 2} 178h31l4 34h-39l4-34Z" fill="#14b8a6" stroke="#0f172a" stroke-width="3"/><path d="M${x + 6} 178c0-14 18-14 18 0" fill="none" stroke="#f0fdfa" stroke-width="4" stroke-linecap="round"/><path d="M${x + 9} 193h12" stroke="#ccfbf1" stroke-width="4" stroke-linecap="round"/>${renderGrip(gripX, 184, skin)}</g>`;
  }
  if (spec.handItem === 'paintbrush') {
    return `<g class="avatar-hand-item"><path d="M${x + 3} 203l26-35" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M${x + 26} 166l10-13 9 7-12 12Z" fill="#f97316" stroke="#0f172a" stroke-width="3"/><path d="M${x + 33} 154c5-8 16-9 21-4-3 8-11 13-21 10Z" fill="#fb7185" stroke="#0f172a" stroke-width="3"/>${renderGrip(gripX, 193, skin)}</g>`;
  }
  if (spec.handItem === 'laptop') {
    const laptopX = spec.pose === 'hold' ? 93 : x - 18;
    const grip =
      spec.pose === 'hold'
        ? `${renderGrip(100, 188, skin)}${renderGrip(156, 188, skin)}`
        : renderGrip(gripX, 190, skin);
    return `<g class="avatar-hand-item"><path d="M${laptopX} 175h70v35h-70z" fill="#475569" stroke="#0f172a" stroke-width="3"/><path d="M${laptopX - 7} 210h84l-8 12h-68z" fill="#0f172a"/><rect x="${laptopX + 8}" y="184" width="54" height="17" rx="3" fill="#38bdf8" opacity=".72"/>${grip}</g>`;
  }
  return '';
}

function renderForegroundParticles(spec: LajukanAvatarSpec): string {
  if (
    spec.aura !== 'spark' &&
    spec.aura !== 'stars' &&
    spec.aura !== 'coins' &&
    spec.wing !== 'crystal' &&
    spec.wing !== 'prism' &&
    spec.wing !== 'celestial' &&
    spec.handItem !== 'camera'
  ) {
    return '';
  }
  return `<g class="avatar-spark" fill="#fef3c7" opacity=".86"><circle cx="59" cy="71" r="3.5"/><circle cx="202" cy="89" r="3"/><circle cx="49" cy="175" r="3"/><circle cx="213" cy="181" r="4"/></g>`;
}

export function renderChibiAvatar(spec: LajukanAvatarSpec): string {
  const skin = SKIN_COLOR[spec.skin];
  const hair = HAIR_COLOR[spec.hairColor];
  const outfit = OUTFIT_COLOR[spec.outfitColor];
  return `${avatarCss(spec.motion)}<g class="avatar2d motion-${spec.motion}" clip-path="url(#avatarClip)">${renderBackground(spec)}${renderAura(spec.aura)}${renderBackItem(spec)}${renderWings(spec.wing)}<ellipse cx="128" cy="228" rx="58" ry="14" fill="#0f172a" opacity=".18"/><g class="avatar-body" filter="url(#softShadow)">${renderLegs(spec, skin)}${renderTorso(spec, outfit)}${renderArms(spec, skin)}${renderHeadBase(skin)}${renderHair(spec, hair)}${renderHeadwear(spec)}${renderFace(spec)}${renderEyewear(spec)}${renderHandItem(spec, skin)}</g>${renderForegroundParticles(spec)}</g>`;
}
