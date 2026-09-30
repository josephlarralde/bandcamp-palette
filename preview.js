// Renders a static, self-contained HTML mockup of a Bandcamp album page
// using the suggested colors and the source image as banner and cover art.
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' }

export function renderPreview({ background, text, link }, imagePath) {
  const src = `data:${MIME[extname(imagePath).toLowerCase()] ?? 'image/jpeg'};base64,${readFileSync(imagePath).toString('base64')}`
  const tracks = ['Untitled I', 'Undergrowth', 'Slow Canopy', 'Night Bloom', 'Untitled II']
  const times = ['3:12', '5:47', '4:20', '6:03', '2:38']
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bandcamp preview</title>
<style>
  :root { --bg: ${background}; --text: ${text}; --link: ${link}; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 "Helvetica Neue", Arial, sans-serif; }
  a { color: var(--link); text-decoration: none; }
  .page { max-width: 975px; margin: 0 auto; padding: 0 16px 48px; }
  .banner { height: 180px; background: url(${src}) center / cover; }
  .head { padding: 24px 0 16px; }
  h1 { margin: 0; font-size: 28px; font-weight: 400; }
  .by { margin-top: 4px; }
  .cols { display: flex; align-items: flex-start; gap: 32px; flex-wrap: wrap; }
  .cover { width: 350px; max-width: 100%; aspect-ratio: 1; background: url(${src}) center / cover; }
  .main { flex: 1; min-width: 280px; }
  .play { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .btn { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--link); display: grid; place-items: center; }
  .btn::after { content: ""; border-left: 14px solid var(--link); border-top: 8px solid transparent; border-bottom: 8px solid transparent; margin-left: 4px; }
  .bar { flex: 1; height: 4px; background: color-mix(in srgb, var(--text) 25%, var(--bg)); }
  .bar i { display: block; width: 30%; height: 100%; background: var(--link); }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--text) 20%, var(--bg)); }
  td:first-child { width: 28px; opacity: .7; }
  td:last-child { text-align: right; opacity: .7; }
  .buy { margin: 20px 0; }
  .credits { margin-top: 20px; opacity: .85; }
  .meta { margin-top: 24px; font-size: 12px; opacity: .7; }
</style></head><body>
<div class="banner"></div>
<div class="page">
  <div class="head"><h1>Album Title</h1><div class="by">by <a href="#">Artist Name</a></div></div>
  <div class="cols">
    <div class="cover"></div>
    <div class="main">
      <div class="play"><span class="btn"></span><div><div>Untitled I</div><div style="opacity:.7">00:57 / 03:12</div></div><div class="bar"><i></i></div></div>
      <table>${tracks.map((t, i) => `<tr><td>${i + 1}.</td><td><a href="#">${t}</a></td><td>${times[i]}</td></tr>`).join('')}</table>
      <div class="buy"><a href="#">Buy Digital Album</a> &nbsp;·&nbsp; <a href="#">Buy Digital Track</a></div>
      <div class="credits">Recorded somewhere quiet. Lorem ipsum dolor sit amet, <a href="#">consectetur</a> adipiscing elit, sed do eiusmod tempor incididunt ut labore.</div>
      <div class="meta">background ${background} · text ${text} · link ${link}</div>
    </div>
  </div>
</div>
</body></html>
`
}
