// App icon drawn procedurally: a gold "!" on a violet disc over the app's blue-black. The disc stays inside the
// maskable safe zone (radius 0.4), so the same image works as "any" and "maskable".
import { encodePng, type Rgb } from './png.ts';

const NIGHT: Rgb = [13, 15, 30];
const VIOLET: Rgb = [91, 42, 158];
const GOLD: Rgb = [253, 185, 39];
const SAMPLES = 4;

const inCircle = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Rounded bar of the "!" as a capsule between two points. */
function inCapsule(x: number, y: number) {
  const r = 0.05;
  const cy = Math.min(Math.max(y, 0.28), 0.55);
  return inCircle(x, y, 0.5, cy, r);
}

function shade(x: number, y: number): Rgb {
  if (inCapsule(x, y) || inCircle(x, y, 0.5, 0.68, 0.055)) return GOLD;
  if (inCircle(x, y, 0.5, 0.5, 0.38)) return VIOLET;
  return NIGHT;
}

export function iconPng(size: number): Buffer {
  return encodePng(size, size, (px, py) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < SAMPLES; i++) {
      for (let j = 0; j < SAMPLES; j++) {
        const c = shade((px + (i + 0.5) / SAMPLES) / size, (py + (j + 0.5) / SAMPLES) / size);
        acc[0]! += c[0];
        acc[1]! += c[1];
        acc[2]! += c[2];
      }
    }
    const n = SAMPLES * SAMPLES;
    return [Math.round(acc[0]! / n), Math.round(acc[1]! / n), Math.round(acc[2]! / n)];
  });
}
