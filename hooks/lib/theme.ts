// The Matrix look shared by the bar, the panel and the strip.

export const PALETTE = {
  green: '#00FF41',
  green2: '#00B32C',
  faint: '#0D3B1A',
  surface: '#06120A',
  warn: '#E2A94E',
  alert: '#FF5F56',
  done: '#3BFF6E',
  lightGreen: '#00802A',
} as const

export const MONO_FONT = "ui-monospace,'Cascadia Mono',Consolas,monospace"

// Half-width katakana and digits, as on the Nebuchadnezzar's screens.
export const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789'

// Deterministic noise so the rain does not reshuffle between redraws.
export const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

export const glyphAt = (col: number, row: number): string => GLYPHS.charAt(Math.floor(noise(col, row) * GLYPHS.length))

// Classes every drawing uses: .t text, .m muted text, .k track, .tk ticks, .acc accent, .dn done, .pt text on an accent.
// Dark is the Matrix itself; in light mode the greens darken and nothing is filled black.
export const themeCss = (): string => `<style>
.t{fill:#C8FFD4}.m{fill:#3F9A58}.k{fill:${PALETTE.surface}}.tk{fill:${PALETTE.faint}}.acc{fill:${PALETTE.green}}.dn{fill:${PALETTE.done}}.pt{fill:${PALETTE.surface}}
@media (prefers-color-scheme: light){.t{fill:#1F2A22}.m{fill:#5A7A62}.k{fill:#E6ECE7}.tk{fill:#B9C9BD}.acc{fill:${PALETTE.lightGreen}}.dn{fill:${PALETTE.lightGreen}}.pt{fill:#FFFFFF}}
</style>`

// For drawings that colour with attributes: in light mode each of `greens` darkens to the light-mode green.
export const lightGreensCss = (greens: readonly string[]): string => {
  const list = [...new Set(greens)]
  return `<style>@media (prefers-color-scheme: light){${list.map(g => `[fill="${g}"]`).join(',')}{fill:${PALETTE.lightGreen}}${list.map(g => `[stroke="${g}"]`).join(',')}{stroke:${PALETTE.lightGreen}}}</style>`
}

export const GREENS = [PALETTE.green, PALETTE.done, PALETTE.green2]
// The strip's icons.
export const LIGHT_ACCENTS_CSS = lightGreensCss(GREENS)
