#!/usr/bin/env node
// Usage: node palette.js <image> [--tint] [--json] [--preview[=file.html]]
// Extracts the main colors of an image and proposes Bandcamp-ready colors:
// background, text, and link/accent (with WCAG contrast guaranteed).
import { extractColors } from 'extract-colors'
import getPixels from 'get-pixels'
import { promisify } from 'node:util'
import { writeFileSync } from 'node:fs'
import { renderPreview } from './preview.js'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const json = args.includes('--json')
const tint = args.includes('--tint')
const previewArg = args.find((a) => a === '--preview' || a.startsWith('--preview='))
const previewFile = previewArg && (previewArg.split('=')[1] || 'preview.html')
if (!file) {
  console.error('Usage: node palette.js <image> [--tint] [--json] [--preview[=file.html]]')
  process.exit(1)
}

const lum = ({ red, green, blue }) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(red) + 0.7152 * f(green) + 0.0722 * f(blue)
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const hex = ({ red, green, blue }) =>
  '#' + [red, green, blue].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const rgb = (h) => ({ red: h >> 16, green: (h >> 8) & 255, blue: h & 255 })

// Push a color toward white (or black) until it reaches the target contrast.
const ensureContrast = (c, bg, min, towardLight) => {
  const t = towardLight ? 255 : 0
  let out = { ...c }
  for (let i = 0; i <= 20 && contrast(out, bg) < min; i++) {
    const k = i / 20
    out = {
      red: c.red + (t - c.red) * k,
      green: c.green + (t - c.green) * k,
      blue: c.blue + (t - c.blue) * k,
    }
  }
  return out
}

const px = await promisify(getPixels)(file)
const [width, height] = px.shape
const colors = await extractColors(
  { data: Array.from(px.data), width, height },
  {
    pixels: 60000,
    colorValidator: () => true,
    // --tint keeps close shades apart so tinted darks/lights survive next to pure black/white
    ...(tint ? { distance: 0.04, lightnessDistance: 0.02, saturationDistance: 0.1 } : { distance: 0.15 }),
  }
)

// Background: the dominant color...
let bg = [...colors].sort((a, b) => b.area - a.area)[0]
const darkBg = lum(bg) < 0.4
// ...or with --tint, the most extreme (darkest / lightest) noticeably tinted color on the same side.
if (tint) {
  const tinted = colors.filter(
    (c) => c.saturation >= 0.15 && c.area >= 0.005 && lum(c) < 0.4 === darkBg && lum(c) > 0.002 * darkBg
  )
  tinted.sort((a, b) => (darkBg ? lum(a) - lum(b) : lum(b) - lum(a)))
  bg = tinted[0] ?? bg
}
const bgRgb = { red: bg.red, green: bg.green, blue: bg.blue }

// Text: the most "readable" palette color; else tint the lightest one.
const others = colors.filter((c) => c !== bg)
const bySat = [...others].sort((a, b) => b.saturation * b.area ** 0.3 - a.saturation * a.area ** 0.3)
const textBase = others.length
  ? [...others].sort((a, b) => contrast(b, bgRgb) - contrast(a, bgRgb))[0]
  : rgb(darkBg ? 0xeeeeee : 0x111111)
let text = ensureContrast(textBase, bgRgb, 7, darkBg)
// Link: candidates that already reach 4.5:1 come first, then the others adjusted to 4.5:1.
// Preference order: a clearly different hue from the text (>= 40 degrees, on a saturated color),
// then any visibly different color (RGB distance >= 45), then the first candidate.
const dist = (a, b) => Math.hypot(a.red - b.red, a.green - b.green, a.blue - b.blue)
const hsv = ({ red, green, blue }) => {
  const [r, g, b] = [red, green, blue].map((v) => v / 255)
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { hue: h * 60, sat: max === 0 ? 0 : d / max }
}
const hueGap = (a, b) => {
  const g = Math.abs(hsv(a).hue - hsv(b).hue)
  return Math.min(g, 360 - g)
}
const rest = bySat.filter((c) => c !== textBase)
const linkCandidates = [
  ...rest.filter((c) => contrast(c, bgRgb) >= 4.5),
  ...rest.filter((c) => contrast(c, bgRgb) < 4.5).map((c) => ensureContrast(c, bgRgb, 4.5, darkBg)),
]
let link =
  linkCandidates.find((c) => hsv(c).sat >= 0.25 && hueGap(c, text) >= 40) ??
  linkCandidates.find((c) => dist(c, text) >= 45) ??
  linkCandidates[0] ??
  ensureContrast(text, bgRgb, 4.5, darkBg)

// Keep the link less prominent than the text: text contrast should be at least MIN_GAP times the link's.
// First dim the link toward the background (never below 4.5:1), then push the text toward black/white.
const MIN_GAP = 1.8
const mix = (a, b, k) => ({
  red: a.red + (b.red - a.red) * k,
  green: a.green + (b.green - a.green) * k,
  blue: a.blue + (b.blue - a.blue) * k,
})
const gap = () => contrast(text, bgRgb) / contrast(link, bgRgb)
const link0 = link, text0 = text
for (let k = 0.02; gap() < MIN_GAP && k <= 1; k += 0.02) {
  const c = mix(link0, bgRgb, k)
  if (contrast(c, bgRgb) < 4.5) break
  link = c
}
const extreme = darkBg ? rgb(0xffffff) : rgb(0x000000)
for (let k = 0.02; gap() < MIN_GAP && k <= 1; k += 0.02) text = mix(text0, extreme, k)

const result = {
  bandcamp: {
    background: hex(bgRgb),
    text: hex(text),
    link: hex(link),
    contrast: {
      text: +contrast(text, bgRgb).toFixed(2),
      link: +contrast(link, bgRgb).toFixed(2),
    },
  },
  palette: [...colors].sort((a, b) => b.area - a.area).map((c) => ({ hex: c.hex, area: +(c.area * 100).toFixed(1) })),
}

if (previewFile) {
  writeFileSync(previewFile, renderPreview(result.bandcamp, file))
  console.error(`Preview written to ${previewFile}`)
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  const sw = (h) => {
    const { red, green, blue } = rgb(parseInt(h.slice(1), 16))
    return `\x1b[48;2;${red};${green};${blue}m    \x1b[0m`
  }
  const b = result.bandcamp
  console.log('Bandcamp')
  console.log(`  background ${sw(b.background)} ${b.background}`)
  console.log(`  text       ${sw(b.text)} ${b.text}  (contrast ${b.contrast.text}:1)`)
  console.log(`  link       ${sw(b.link)} ${b.link}  (contrast ${b.contrast.link}:1)`)
  console.log('\nMain palette (top 12 by area; use --json for all)')
  for (const c of result.palette.slice(0, 12)) console.log(`  ${sw(c.hex)} ${c.hex}  ${c.area}%`)
}
