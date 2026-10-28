interface BrandMarkProps { compact?: boolean }

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`} aria-label="CampusPulse">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="15" fill="currentColor" />
          <path d="M10 28.5h6.5l3.5-10 5 17 4.5-13 2.5 6H38" stroke="#F4FFF9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="38" cy="28.5" r="2.4" fill="#D3F3E2" />
        </svg>
      </span>
      {!compact && <span className="brand-name">Campus<span>Pulse</span></span>}
    </div>
  );
}
