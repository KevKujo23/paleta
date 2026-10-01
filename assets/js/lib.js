// Paleta maths: colour conversion, bit depth, quantization. No DOM, so check.mjs can run it in Node.
(function (root) {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hex2 = (v) => v.toString(16).padStart(2, '0').toUpperCase();

  function rgbToHex(r, g, b) {
    return '#' + hex2(r) + hex2(g) + hex2(b);
  }

  function hexToRgb(str) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(str).trim());
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Returns unrounded [h 0–360, s 0–100, l 0–100] so the caller decides how to display it.
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s * 100, l * 100];
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }

  // HSV (also called HSB) from HSL and back. Hue is shared, so only S and the third value change.
  function hslToHsv(h, s, l) {
    s /= 100; l /= 100;
    const v = l + s * Math.min(l, 1 - l);
    return [h, v ? 200 * (1 - l / v) : 0, v * 100];
  }

  function hsvToHsl(h, s, v) {
    s /= 100; v /= 100;
    const l = v * (1 - s / 2);
    const m = Math.min(l, 1 - l);
    return [h, m ? ((v - l) / m) * 100 : 0, l * 100];
  }

  // Naive device-independent CMYK: close enough to teach, not a print profile.
  function rgbToCmyk(r, g, b) {
    const k = 1 - Math.max(r, g, b) / 255;
    if (k >= 1) return [0, 0, 0, 100];
    const f = (v) => Math.round(((1 - v / 255 - k) / (1 - k)) * 100);
    return [f(r), f(g), f(b), Math.round(k * 100)];
  }

  function cmykToRgb(c, m, y, k) {
    const f = (v) => Math.round(255 * (1 - v / 100) * (1 - k / 100));
    return [f(c), f(m), f(y)];
  }

  // Colour at position t (0–1) on a black → base strip, stored at the given bit depth.
  // 24 means 8 bits per channel; 1–8 means that many bits for the whole ramp.
  function depthColour(t, bits, base) {
    if (bits >= 24) return base.map((c) => Math.round(t * c));
    const levels = 2 ** bits;
    const q = Math.round(t * (levels - 1)) / (levels - 1);
    return base.map((c) => Math.round(q * c));
  }

  // Mid-rise quantizer for an audio sample in [-1, 1]; 1 bit gives a square wave at ±0.5.
  function crush(x, bits) {
    const levels = 2 ** bits;
    const i = Math.min(levels - 1, Math.floor(((clamp(x, -1, 1) + 1) / 2) * levels));
    return ((i + 0.5) / levels) * 2 - 1;
  }

  // Uniform quantization needs a whole grid of levels, so it picks r × g × b ≤ n
  // (green gets the extra level first because the eye is most sensitive to it).
  function uniformLevels(n) {
    const k = Math.max(1, Math.floor(Math.cbrt(n) + 1e-9));
    const lv = [k, k, k];
    if (lv[0] * (lv[1] + 1) * lv[2] <= n) lv[1]++;
    if ((lv[0] + 1) * lv[1] * lv[2] <= n) lv[0]++;
    return lv;
  }

  const levelValue = (count, i) => (count === 1 ? 128 : Math.round((i * 255) / (count - 1)));
  const levelIndex = (v, count) => (count === 1 ? 0 : Math.round((v / 255) * (count - 1)));

  // Median cut on a sample of the pixels: keep splitting the box with the widest
  // spread × population at its median until there are n boxes; each box's mean is a palette entry.
  function medianCut(data, n) {
    const px = data.length / 4;
    const step = Math.max(1, Math.floor(px / 65536));
    const all = new Uint32Array(Math.ceil(px / step));
    let m = 0;
    for (let i = 0; i < px; i += step) {
      const p = i * 4;
      all[m++] = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
    }
    const cols = all.subarray(0, m);

    const box = (s, e) => {
      const lo = [255, 255, 255], hi = [0, 0, 0];
      for (let i = s; i < e; i++) {
        const c = cols[i];
        for (let ch = 0; ch < 3; ch++) {
          const v = (c >> (16 - 8 * ch)) & 255;
          if (v < lo[ch]) lo[ch] = v;
          if (v > hi[ch]) hi[ch] = v;
        }
      }
      const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      const axis = ranges.indexOf(Math.max(...ranges));
      return { s, e, axis, range: ranges[axis] };
    };

    const boxes = [box(0, m)];
    while (boxes.length < n) {
      let best = -1, score = 0;
      boxes.forEach((b, i) => {
        const sc = b.range * (b.e - b.s);
        if (sc > score) { score = sc; best = i; }
      });
      if (best < 0) break; // every box is a single colour: the image has fewer than n colours
      const b = boxes[best];
      const sh = 16 - 8 * b.axis;
      cols.subarray(b.s, b.e).sort((x, y) => ((x >> sh) & 255) - ((y >> sh) & 255));
      // cut at the value boundary nearest the median, so one colour never ends up in two boxes
      const key = (i) => (cols[i] >> sh) & 255;
      const half = b.s + ((b.e - b.s) >> 1);
      let up = half, dn = half;
      while (up < b.e && key(up) === key(up - 1)) up++;
      while (dn > b.s && key(dn) === key(dn - 1)) dn--;
      const mid = up < b.e && (dn === b.s || up - half <= half - dn) ? up : dn;
      boxes.splice(best, 1, box(b.s, mid), box(mid, b.e));
    }

    return boxes.map((b) => {
      let r = 0, g = 0, bl = 0;
      for (let i = b.s; i < b.e; i++) {
        const c = cols[i];
        r += (c >> 16) & 255; g += (c >> 8) & 255; bl += c & 255;
      }
      const cnt = b.e - b.s;
      return [Math.round(r / cnt), Math.round(g / cnt), Math.round(bl / cnt)];
    });
  }

  // src: {data: RGBA bytes, width, height}. Returns the quantized RGBA, the palette (LUT)
  // and how many palette entries the image actually used.
  function quantize(src, n, method, dither) {
    const { data, width: w, height: h } = src;
    let palette, nearest, levels = null;

    if (method === 'uniform') {
      levels = uniformLevels(n);
      const [lr, lg, lb] = levels;
      palette = [];
      for (let r = 0; r < lr; r++)
        for (let g = 0; g < lg; g++)
          for (let b = 0; b < lb; b++)
            palette.push([levelValue(lr, r), levelValue(lg, g), levelValue(lb, b)]);
      nearest = (r, g, b) => (levelIndex(r, lr) * lg + levelIndex(g, lg)) * lb + levelIndex(b, lb);
    } else {
      palette = medianCut(data, n);
      const len = palette.length;
      const pr = palette.map((c) => c[0]), pg = palette.map((c) => c[1]), pb = palette.map((c) => c[2]);
      // ponytail: nearest-colour cache keyed on 6 bits per channel (error ≤ 2 levels), exact search if it ever matters
      const cache = new Int16Array(1 << 18).fill(-1);
      nearest = (r, g, b) => {
        const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
        let k = cache[key];
        if (k < 0) {
          let bd = Infinity;
          for (let i = 0; i < len; i++) {
            const dr = r - pr[i], dg = g - pg[i], db = b - pb[i];
            const d = dr * dr + dg * dg + db * db;
            if (d < bd) { bd = d; k = i; }
          }
          cache[key] = k;
        }
        return k;
      };
    }

    const out = new Uint8ClampedArray(data.length);
    const usedMask = new Uint8Array(palette.length);
    const err = dither ? new Float32Array(w * h * 3) : null;
    const spread = (x, y, er, eg, eb, f) => {
      if (x < 0 || x >= w || y >= h) return;
      const j = (y * w + x) * 3;
      err[j] += er * f; err[j + 1] += eg * f; err[j + 2] += eb * f;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, p = i * 4;
        let r = data[p], g = data[p + 1], b = data[p + 2];
        if (err) {
          r = clamp(Math.round(r + err[i * 3]), 0, 255);
          g = clamp(Math.round(g + err[i * 3 + 1]), 0, 255);
          b = clamp(Math.round(b + err[i * 3 + 2]), 0, 255);
        }
        const k = nearest(r, g, b);
        const c = palette[k];
        usedMask[k] = 1;
        out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = 255;
        if (err) {
          // Floyd–Steinberg: push this pixel's rounding error onto the neighbours not yet visited
          const er = r - c[0], eg = g - c[1], eb = b - c[2];
          spread(x + 1, y, er, eg, eb, 7 / 16);
          spread(x - 1, y + 1, er, eg, eb, 3 / 16);
          spread(x, y + 1, er, eg, eb, 5 / 16);
          spread(x + 1, y + 1, er, eg, eb, 1 / 16);
        }
      }
    }

    let used = 0;
    for (const u of usedMask) used += u;
    return { data: out, palette, used, levels };
  }

  const bitsFor = (colours) => Math.max(1, Math.ceil(Math.log2(colours)));

  // Raw indexed size: every pixel stores a palette index, plus 3 bytes per palette entry.
  function estimateBytes(w, h, colours) {
    return Math.ceil((w * h * bitsFor(colours)) / 8) + colours * 3;
  }

  const api = {
    clamp, rgbToHex, hexToRgb, rgbToHsl, hslToRgb, hslToHsv, hsvToHsl, rgbToCmyk, cmykToRgb,
    depthColour, crush, uniformLevels, medianCut, quantize, bitsFor, estimateBytes,
  };
  root.PaletaLib = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
