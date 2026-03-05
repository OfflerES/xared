export default function XaredLogo() {
  return (
    <svg width="160" height="36" viewBox="0 0 170 56" fill="none" overflow="visible" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="xg" x1="7" y1="7" x2="49" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F4600C"/>
          <stop offset="100%" stopColor="#FF7A2F"/>
        </linearGradient>
      </defs>
      <line x1="7" y1="7" x2="49" y2="49" stroke="url(#xg)" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="49" y1="7" x2="7" y2="49" stroke="url(#xg)" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="7"  cy="7"  r="4.5" fill="#F4600C"/>
      <circle cx="49" cy="7"  r="4.5" fill="#FF7A2F"/>
      <circle cx="7"  cy="49" r="4.5" fill="#FF7A2F"/>
      <circle cx="49" cy="49" r="4.5" fill="#F4600C"/>
      <circle cx="28" cy="28" r="6"   fill="#F4600C"/>
      <circle cx="28" cy="28" r="3"   fill="#FFFFFF"/>
      <circle cx="17" cy="17" r="2.8" fill="#F4600C" opacity="0.65"/>
      <circle cx="39" cy="39" r="2.8" fill="#F4600C" opacity="0.65"/>
      <circle cx="39" cy="17" r="2.8" fill="#FF7A2F" opacity="0.65"/>
      <circle cx="17" cy="39" r="2.8" fill="#FF7A2F" opacity="0.65"/>
      <text fontFamily="Syne,'Arial Black',sans-serif" fontWeight="800" fontSize="26" letterSpacing="-0.5">
        <tspan x="62" y="36" fill="#FFFFFF">XA</tspan><tspan fill="#F4600C">RED</tspan>
      </text>
      <text x="63" y="50" fontFamily="'DM Sans',Arial,sans-serif" fontSize="8.5" letterSpacing="2" fill="rgba(255,255,255,0.35)">B2B NETWORK</text>
    </svg>
  )
}
