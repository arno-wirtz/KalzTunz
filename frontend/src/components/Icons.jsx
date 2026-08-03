/**
 * KalzTunz Icons — small hand-built SVG line icons.
 * Consistent 24x24 viewBox, stroke-based, currentColor.
 * No emoji anywhere in the app should be needed once this is wired in.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 18, className, style, children, ...rest }) {
  return (
    <svg width={size} height={size} className={className} style={style} {...base} {...rest}>
      {children}
    </svg>
  )
}

export const IconBolt = (p) => (
  <Svg {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6z" strokeLinejoin="round" fill="currentColor" stroke="none" /></Svg>
)

export const IconTarget = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" strokeLinejoin="round" />
    <path d="M19 3.5l.6 1.7L21.3 6l-1.7.6-.6 1.7-.6-1.7L16.7 6l1.7-.6z" strokeLinejoin="round" />
  </Svg>
)

export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Svg>
)

export const IconDownload = (p) => (
  <Svg {...p}>
    <path d="M12 4v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
)

export const IconGear = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i * 45 * Math.PI) / 180
      const x1 = 12 + Math.cos(a) * 7.2, y1 = 12 + Math.sin(a) * 7.2
      const x2 = 12 + Math.cos(a) * 9.4, y2 = 12 + Math.sin(a) * 9.4
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
    })}
  </Svg>
)

export const IconBarChart = (p) => (
  <Svg {...p}>
    <path d="M5 20V11" />
    <path d="M12 20V4" />
    <path d="M19 20v-7" />
  </Svg>
)

export const IconMusicNote = (p) => (
  <Svg {...p}>
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
    <path d="M9 18V5l10-2v13" />
  </Svg>
)

export const IconMic = (p) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v4" />
    <path d="M8 22h8" />
  </Svg>
)

export const IconPlay = (p) => (
  <Svg {...p}><path d="M7 4.5v15l13-7.5z" strokeLinejoin="round" fill="currentColor" stroke="none" /></Svg>
)

export const IconPause = (p) => (
  <Svg {...p}>
    <rect x="6" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.5" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconReplay = (p) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 2.7 6" />
    <path d="M4 17v-5h5" />
  </Svg>
)

export const IconLoop = (p) => (
  <Svg {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}><path d="M4 12.5l5.5 5.5L20 6.5" /></Svg>
)

export const IconClose = (p) => (
  <Svg {...p}><path d="M5 5l14 14M19 5 5 19" /></Svg>
)

export const IconMusicDisc = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconFilm = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
  </Svg>
)

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
  </Svg>
)

export const IconMoon = (p) => (
  <Svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" strokeLinejoin="round" /></Svg>
)

export const IconVolume = (p) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 5V4L8 9z" />
    <path d="M16.5 9.5a4.5 4.5 0 0 1 0 5" />
  </Svg>
)

export const IconFileText = (p) => (
  <Svg {...p}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    <path d="M14 3v5h5" />
    <path d="M8 13h8M8 17h8" />
  </Svg>
)

export const IconShare = (p) => (
  <Svg {...p}>
    <circle cx="18" cy="5" r="2.3" /><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="19" r="2.3" />
    <path d="M8.1 10.8l7.8-4.4M8.1 13.2l7.8 4.4" />
  </Svg>
)

export const IconKey = (p) => (
  <Svg {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M11 12l9-9" />
    <path d="M17 6l3 3" />
    <path d="M14 9l2.5 2.5" />
  </Svg>
)

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
)

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
)

/* ── Genre / instrument icons ─────────────────────────────── */

export const IconGuitar = (p) => (
  <Svg {...p}>
    <path d="M14 3l3 3" />
    <path d="M11 6l6 6" strokeWidth={2.4} />
    <circle cx="8.5" cy="15.5" r="5" />
    <circle cx="8.5" cy="15.5" r="1.8" />
    <path d="M15.5 4.5l1.2-1.2M17.5 6.5l1.2-1.2" />
  </Svg>
)

export const IconHorn = (p) => (
  <Svg {...p}>
    <path d="M4 5c4 0 8 3 8 8v6" />
    <circle cx="17" cy="17.5" r="3.5" />
    <path d="M8 7l2-2M8 11l3-1" />
  </Svg>
)

export const IconSliders = (p) => (
  <Svg {...p}>
    <path d="M5 21V10M5 6V3" /><circle cx="5" cy="8" r="2" />
    <path d="M12 21v-7M12 10V3" /><circle cx="12" cy="12" r="2" />
    <path d="M19 21v-4M19 13V3" /><circle cx="19" cy="15" r="2" />
  </Svg>
)

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.2" />
    <rect x="13" y="4" width="7" height="7" rx="1.2" />
    <rect x="4" y="13" width="7" height="7" rx="1.2" />
    <rect x="13" y="13" width="7" height="7" rx="1.2" />
  </Svg>
)

export const IconStrings = (p) => (
  <Svg {...p}>
    <path d="M8 3l9 9" strokeWidth={2.2}/>
    <circle cx="7" cy="17" r="4.2" />
    <path d="M9.7 14.3c-.6.6-.6 1.6 0 2.2M11 13c-1 1-1 2.6 0 3.6" />
  </Svg>
)

export const IconHat = (p) => (
  <Svg {...p}>
    <path d="M4 17h16" />
    <path d="M7 17c0-5 2-10 5-10s5 5 5 10" strokeLinejoin="round" />
  </Svg>
)

export const IconHeart = (p) => (
  <Svg {...p}><path d="M12 20s-7-4.5-9.3-9C1 7.7 2.3 4.5 5.5 4c2-.3 3.7.8 4.5 2.3.8-1.5 2.5-2.6 4.5-2.3 3.2.5 4.5 3.7 2.8 7-2.3 4.5-9.3 9-9.3 9z" strokeLinejoin="round" /></Svg>
)

export const IconCloud = (p) => (
  <Svg {...p}><path d="M7 18a4 4 0 1 1 .7-7.9A5 5 0 0 1 17 11a3.5 3.5 0 0 1-.5 7z" strokeLinejoin="round" /></Svg>
)

export const IconLeaf = (p) => (
  <Svg {...p}><path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" strokeLinejoin="round" /><path d="M5 19c3-5 6-8 11-10.5" /></Svg>
)

export const IconPiano = (p) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <path d="M7 6v7.5M11 6v7.5M13.5 6v7.5M17 6v7.5" />
  </Svg>
)

export const IconDrum = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="8" rx="8" ry="3.2" />
    <path d="M4 8v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V8" />
    <path d="M6 3l4 4M18 3l-4 4" />
  </Svg>
)

/* ── Mood icons ───────────────────────────────────────────── */

export const IconSmile = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14c1.2 1.5 2.6 2.2 4 2.2s2.8-.7 4-2.2" />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconFrown = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 16.2c1.2-1.5 2.6-2.2 4-2.2s2.8.7 4 2.2" />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconWave = (p) => (
  <Svg {...p}><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></Svg>
)

export const IconFlame = (p) => (
  <Svg {...p}><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-4.6 2.3-7.2C8 9.5 9 10.5 9.5 9c.6-2 0-4 1-6.5 3 2 6 6 6 10.5.7-1 1-2 1-3.3 1.5 2 2 4 2 5.8 0 3.8-3 6.5-7 6.5z" strokeLinejoin="round" /></Svg>
)

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
)

export const IconSunrise = (p) => (
  <Svg {...p}>
    <path d="M17 15a5 5 0 0 0-10 0" />
    <path d="M2 15h20" />
    <path d="M12 6V3M5.6 8.6 4 7M18.4 8.6 20 7" />
  </Svg>
)

/* ── Voice-type icons ─────────────────────────────────────── */

export const IconPerson = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" />
  </Svg>
)

export const IconBaby = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="10" r="5" />
    <circle cx="12" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    <path d="M9 8.5c0-.8.6-1.2 1.4-1M15 8.5c0-.8-.6-1.2-1.4-1" />
  </Svg>
)

export const IconAngel = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="4" ry="2" />
    <circle cx="12" cy="9.5" r="3.4" />
    <path d="M5.5 20c1-3.8 3.7-5.8 6.5-5.8s5.5 2 6.5 5.8" />
  </Svg>
)

export const IconGroup = (p) => (
  <Svg {...p}>
    <circle cx="7" cy="9" r="2.6" /><circle cx="17" cy="9" r="2.6" /><circle cx="12" cy="7.5" r="2.9" />
    <path d="M2.5 20c.7-3 3-4.6 5.4-4.2M21.5 20c-.7-3-3-4.6-5.4-4.2M7.2 20c1-3.6 3.2-5.4 4.8-5.4s3.8 1.8 4.8 5.4" />
  </Svg>
)

export const IconRobot = (p) => (
  <Svg {...p}>
    <rect x="5" y="8" width="14" height="10" rx="2.5" />
    <circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    <path d="M12 8V5M9 5h6" />
  </Svg>
)

export const IconMicUp = (p) => (
  <Svg {...p}>
    <rect x="9.5" y="2" width="5" height="9" rx="2.5" />
    <path d="M6 10.5a6 6 0 0 0 12 0" />
    <path d="M12 16.5V21" />
    <path d="M17 4l2-2 2 2" />
  </Svg>
)

export const IconMicSoft = (p) => (
  <Svg {...p}>
    <rect x="9.5" y="3" width="5" height="9" rx="2.5" />
    <path d="M6 11.5a6 6 0 0 0 12 0" />
    <path d="M12 17.5V21" />
    <path d="M17 6c.8.5 1.3 1 1.3 2M18.7 5c1.3.8 2 1.8 2 3.2" strokeDasharray="1.5 2" />
  </Svg>
)

export const IconFolder = (p) => (
  <Svg {...p}>
    <path d="M3 6a1 1 0 0 1 1-1h4.5l2 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
  </Svg>
)
