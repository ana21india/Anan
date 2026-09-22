const PLATFORM_STYLES = {
  Netflix: { bg: '#E50914', text: 'white', short: 'N' },
  'Amazon Prime Video': { bg: '#00A8E0', text: 'white', short: 'Prime' },
  'Prime Video': { bg: '#00A8E0', text: 'white', short: 'Prime' },
  'Disney+': { bg: '#113CCF', text: 'white', short: 'D+' },
  'Disney+ Hotstar': { bg: '#113CCF', text: 'white', short: 'Hotstar' },
  Hotstar: { bg: '#113CCF', text: 'white', short: 'Hotstar' },
  'Apple TV+': { bg: '#1d1d1f', text: 'white', short: 'Apple' },
  'Jio Cinema': { bg: '#6C2BD9', text: 'white', short: 'Jio' },
  JioCinema: { bg: '#6C2BD9', text: 'white', short: 'Jio' },
  SonyLIV: { bg: '#003087', text: 'white', short: 'Sony' },
  ZEE5: { bg: '#6B2D8E', text: 'white', short: 'ZEE5' },
  MUBI: { bg: '#000', text: 'white', short: 'MUBI' },
  YouTube: { bg: '#FF0000', text: 'white', short: 'YT' },
}

const DEFAULT_STYLE = { bg: '#252548', text: 'white' }

export default function OTTPlatformBadge({ platform, link, compact = false }) {
  const style = PLATFORM_STYLES[platform] || DEFAULT_STYLE
  const label = compact ? (style.short || platform.slice(0, 4)) : platform

  const content = (
    <span
      className="platform-badge font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    )
  }

  return content
}

export function OTTPlatformList({ platforms, compact = false, max = 5 }) {
  if (!platforms?.length) {
    return <span className="text-white/30 text-xs">Not on streaming right now</span>
  }

  const shown = platforms.slice(0, max)

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-white/40 text-xs">Watch on</span>
      {shown.map((p, i) => (
        <OTTPlatformBadge key={i} platform={p.platform} link={p.link} compact={compact} />
      ))}
    </div>
  )
}
