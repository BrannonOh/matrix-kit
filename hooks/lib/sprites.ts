// The characters as chibi pixel people on a 24 × 30 grid, one <rect> per pixel run.
// Body pixels sit in `bd` (it bobs or leans while working), the character's prop in
// `pr` (its own motion), extras in `fx`. Motion is CSS, run by the compositor:
// only `st-running` animates, and reduced motion stops everything.

import type { Character } from './crew.ts'

// The characters, plus Mouse, who only runs at the end of the progress bar.
export type Sprite = Character | 'mouse'
import { PALETTE } from './theme.ts'

// How sprites animate on the desktop: 'css' keyframes (the original crabs' way) or
// 'smil' inside an interactive Svg. Task 1's on-screen check decides; see spec 7.
export const MOTION: 'css' | 'smil' = 'css'

export const SPRITE_W = 24
export const SPRITE_H = 30

export type SpriteState = 'running' | 'done' | 'failed'

type Fill = (x: number, y: number, w: number, h: number, c: string, group?: 'bd' | 'pr' | 'fx') => void

const BK = '#0b0b0b'
const SHADES = '#000'
const GLINT = PALETTE.done
const LEGS = '#111'

// Head, ears, neck, legs, shoes, torso, arms, hands, mouth.
const person = (f: Fill, skin: string, coat: string, opts: { torsoX?: number; torsoW?: number } = {}): void => {
  const tx = opts.torsoX ?? 6
  const tw = opts.torsoW ?? 12
  f(8, 24, 3, 4, LEGS)
  f(13, 24, 3, 4, LEGS)
  f(7, 28, 4, 1, SHADES)
  f(13, 28, 4, 1, SHADES)
  f(tx, 15, tw, 9, coat)
  f(tx - 2, 15, 2, 7, coat)
  f(tx + tw, 15, 2, 7, coat)
  f(tx - 2, 22, 2, 1, skin)
  f(tx + tw, 22, 2, 1, skin)
  f(10, 14, 4, 1, skin)
  f(6, 3, 12, 11, skin)
  f(5, 8, 1, 2, skin)
  f(18, 8, 1, 2, skin)
  f(11, 12, 2, 1, '#8a4a3a')
}

const DRAW: Record<Sprite, (f: Fill) => void> = {
  // Long split coat, slick hair, small shades; leans back in bullet time with rain streaking behind.
  neo: f => {
    person(f, '#E8B894', '#121212')
    f(6, 24, 4, 3, '#121212')
    f(14, 24, 4, 3, '#121212')
    f(11, 15, 2, 6, '#2a2a2a')
    f(6, 2, 12, 3, BK)
    f(5, 3, 2, 5, BK)
    f(17, 3, 2, 5, BK)
    f(7, 5, 4, 1, BK)
    f(7, 8, 4, 2, SHADES)
    f(13, 8, 4, 2, SHADES)
    f(11, 8, 2, 1, SHADES)
    f(8, 8, 1, 1, GLINT)
    f(14, 8, 1, 1, GLINT)
    f(0, 4, 1, 6, PALETTE.green, 'fx')
    f(2, 9, 1, 8, PALETTE.green2, 'fx')
    f(22, 6, 1, 7, PALETTE.green2, 'fx')
  },
  // Bald, round pince-nez, burgundy coat and vest; the red and blue pills swap hands.
  morpheus: f => {
    person(f, '#7A4A2E', '#3a2420')
    f(10, 15, 4, 8, '#5a3a30')
    f(8, 4, 2, 1, '#9a6a4a')
    f(7, 8, 3, 2, SHADES)
    f(14, 8, 3, 2, SHADES)
    f(10, 8, 4, 1, SHADES)
    f(8, 8, 1, 1, GLINT)
    f(15, 8, 1, 1, GLINT)
    f(3, 21, 2, 2, '#E24B4A', 'pr')
    f(19, 21, 2, 2, '#378ADD', 'pr')
  },
  // Black bob, slim shades, glossy suit; hunched over a keyboard, typing fast.
  trinity: f => {
    person(f, '#F0CDB0', '#161616')
    f(8, 16, 1, 6, '#4a4a4a')
    f(5, 2, 14, 4, BK)
    f(4, 4, 3, 9, BK)
    f(17, 4, 3, 9, BK)
    f(7, 8, 10, 1, SHADES)
    f(7, 8, 3, 2, SHADES)
    f(14, 8, 3, 2, SHADES)
    f(8, 8, 1, 1, GLINT)
    f(4, 23, 16, 2, '#2a2a2a')
    f(5, 23, 1, 1, PALETTE.green, 'pr')
    f(9, 23, 1, 1, PALETTE.green, 'pr')
    f(13, 23, 1, 1, PALETTE.green, 'pr')
    f(17, 23, 1, 1, PALETTE.green, 'pr')
  },
  // Beanie and an oversized jumper; bounces at double pace.
  mouse: f => {
    person(f, '#F0C8A8', '#6E6E6E', { torsoX: 5, torsoW: 14 })
    f(6, 1, 12, 4, '#3A5A8A')
    f(6, 4, 12, 1, '#2E4A75')
    f(11, 0, 2, 1, '#3A5A8A')
    f(5, 5, 2, 3, '#B5833C')
    f(17, 5, 2, 3, '#B5833C')
    f(8, 8, 2, 2, '#2a1a10')
    f(14, 8, 2, 2, '#2a1a10')
    f(9, 16, 6, 3, '#5A5A5A')
  },
  // Head wrap, apron over a blue dress; stirs a bowl of cookies.
  oracle: f => {
    person(f, '#6B4A33', '#5A6B8C')
    f(8, 16, 8, 8, '#E8E2D0')
    f(5, 1, 14, 5, '#C9A227')
    f(16, 0, 4, 3, '#C9A227')
    f(5, 10, 1, 2, '#F5C542')
    f(18, 10, 1, 2, '#F5C542')
    f(8, 8, 2, 1, '#1a0f08')
    f(14, 8, 2, 1, '#1a0f08')
    f(14, 21, 8, 3, '#8A6A4A')
    f(15, 21, 2, 1, '#C08A50')
    f(19, 21, 2, 1, '#C08A50')
    f(18, 16, 1, 6, '#D9D2C0', 'pr')
  },
  // Suit, white shirt and tie, earpiece, rectangular shades; a clone flickers beside him.
  smith: f => {
    const body: Fill = (x, y, w, h, c, g) => {
      f(x, y, w, h, c, g)
      if (!g) f(x + 3, y, w, h, c, 'fx')
    }
    person(body, '#E8B894', '#1c1c1c')
    body(10, 15, 4, 4, '#f2f2f2')
    body(11, 15, 2, 7, BK)
    body(6, 2, 12, 3, '#4a3523')
    body(6, 3, 2, 3, '#4a3523')
    body(7, 7, 4, 3, SHADES)
    body(13, 7, 4, 3, SHADES)
    body(11, 8, 2, 1, SHADES)
    f(18, 9, 1, 5, '#cfcfcf')
  },
}

export const SPRITE_CSS = `<style>
.st-running .bd,.st-running .pr,.st-running .fx{transform-box:fill-box}
.st-running .bd{animation:bob .5s steps(1) infinite}
@keyframes bob{50%{transform:translateY(1px)}}
.ch-neo.st-running .bd{transform-origin:50% 100%;animation:lean 1.2s ease-in-out infinite}
.ch-neo.st-running .fx{animation:streak .4s steps(1) infinite}
@keyframes lean{40%,60%{transform:rotate(-10deg)}}
@keyframes streak{50%{transform:translateY(3px);opacity:.4}}
.ch-morpheus.st-running .pr{animation:swap 1s steps(1) infinite}
@keyframes swap{50%{transform:scaleX(-1)}}
.ch-trinity.st-running .bd{animation:bob .3s steps(1) infinite}
.ch-trinity.st-running .pr{animation:blink .15s steps(1) infinite}
.ch-mouse.st-running .bd{animation:hop .25s steps(1) infinite}
@keyframes hop{50%{transform:translateY(-2px)}}
.ch-oracle.st-running .pr{transform-origin:50% 100%;animation:stir .8s ease-in-out infinite}
@keyframes stir{50%{transform:rotate(25deg)}}
.ch-smith .fx{opacity:0}
.ch-smith.st-running .fx{animation:clone 1.4s steps(1) infinite}
@keyframes clone{30%,60%{opacity:.35}}
@keyframes blink{50%{opacity:.2}}
.glitch rect{animation:glitch .2s steps(2) 10 forwards}
@keyframes glitch{50%{transform:translateX(2px)}to{opacity:0}}
@media (prefers-reduced-motion: reduce){.st-running *{animation:none!important}.glitch{display:none}}
</style>`

// One sprite as a <g>, placed at (x, y) in its parent's units.
export const spriteSvg = (c: Sprite, state: SpriteState, at: { x: number; y: number; scale?: number }): string => {
  const groups: Record<'bd' | 'pr' | 'fx', string[]> = { bd: [], pr: [], fx: [] }
  const f: Fill = (x, y, w, h, color, group = 'bd') => {
    groups[group].push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`)
  }
  DRAW[c](f)
  // A failed run: three green slices jitter across it for two seconds, then it stands still.
  const glitch =
    state === 'failed'
      ? `<g class="glitch">${[7, 15, 23].map(y => `<rect x="3" y="${y}" width="18" height="2" fill="${PALETTE.green}" opacity="0.7"/>`).join('')}</g>`
      : ''
  return `<g transform="translate(${at.x},${at.y}) scale(${at.scale ?? 1})" shape-rendering="crispEdges"><g class="ch-${c} st-${state}"><g class="fx">${groups.fx.join('')}</g><g class="bd">${groups.bd.join('')}<g class="pr">${groups.pr.join('')}</g></g>${glitch}</g></g>`
}

// Each character's accent: the terminal badge colour and the panel's name colour.
// All greens, each its own shade; Neo keeps the phosphor green.
export const CHARACTER_COLOR: Record<Sprite, string> = {
  neo: PALETTE.green,
  morpheus: '#2E8B57',
  trinity: '#9AE6B4',
  mouse: '#4DD0B0',
  oracle: '#D8E86A',
  smith: '#7A8F7E',
}

// Each accent's light-mode shade: still a green of its own, readable on white (4.5:1 or more).
export const CHARACTER_LIGHT_COLOR: Record<Sprite, string> = {
  neo: PALETTE.lightGreen,
  morpheus: '#1B5E3B',
  trinity: '#2E7D61',
  mouse: '#00756A',
  oracle: '#6E7A00',
  smith: '#55665A',
}

const LETTER: Record<Sprite, string> = { neo: 'N', morpheus: 'M', trinity: 'T', mouse: 'm', oracle: 'O', smith: 'S' }

export const badgeOf = (c: Sprite): { letter: string; color: string } => ({ letter: LETTER[c], color: CHARACTER_COLOR[c] })
