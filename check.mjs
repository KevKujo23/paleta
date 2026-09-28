// Self-check for lib.js. Run: node check.mjs
import assert from 'node:assert/strict';
import L from './lib.js';

// The brief's worked colour, verbatim: #F2C230 = rgb(242,194,48) = hsl(45,88%,57%) = CMYK approx 0,20,80,5
assert.equal(L.rgbToHex(242, 194, 48), '#F2C230');
assert.deepEqual(L.hexToRgb('#F2C230'), [242, 194, 48]);
assert.deepEqual(L.hexToRgb('f2c230'), [242, 194, 48]);
assert.deepEqual(L.rgbToHsl(242, 194, 48).map(Math.round), [45, 88, 57]);
assert.deepEqual(L.rgbToCmyk(242, 194, 48), [0, 20, 80, 5]);
assert.deepEqual(L.cmykToRgb(0, 20, 80, 5), [242, 194, 48]);
L.hslToRgb(45, 88, 57).forEach((v, i) => assert.ok(Math.abs(v - [242, 194, 48][i]) <= 1, 'hsl round trip'));
assert.equal(L.hexToRgb('#12345'), null);

// Bit depth: n bits give 2^n levels (8 bits is skipped: black → 242 red has only 243 distinct values)
for (const bits of [1, 2, 4]) {
  const seen = new Set();
  for (let x = 0; x <= 1000; x++) seen.add(L.depthColour(x / 1000, bits, [242, 194, 48]).join());
  assert.equal(seen.size, 2 ** bits, `${bits}-bit strip has 2^${bits} bands`);
}
assert.deepEqual(L.depthColour(1, 1, [242, 194, 48]), [242, 194, 48]);
assert.deepEqual(L.depthColour(0, 24, [242, 194, 48]), [0, 0, 0]);

// Sound crush: 1 bit is a square wave, 16 bits is within one step of the input
assert.deepEqual([L.crush(-0.3, 1), L.crush(0.3, 1)], [-0.5, 0.5]);
for (let x = -1; x <= 1; x += 0.01) assert.ok(Math.abs(L.crush(x, 16) - x) <= 2 / 2 ** 16);

// Uniform grid never exceeds the requested count
for (let n = 2; n <= 256; n++) {
  const [r, g, b] = L.uniformLevels(n);
  assert.ok(r * g * b <= n && r * g * b >= 2, `uniform ${n}`);
}

// Quantizers on a noisy test image: output only uses palette colours, and never more than n
const w = 64, h = 32, data = new Uint8ClampedArray(w * h * 4);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) % 256;
for (let i = 0; i < w * h; i++) data.set([rnd(), rnd(), rnd(), 255], i * 4);
for (const method of ['uniform', 'median'])
  for (const dither of [false, true])
    for (const n of [2, 16, 256]) {
      const res = L.quantize({ data, width: w, height: h }, n, method, dither);
      assert.ok(res.palette.length <= n && res.used <= res.palette.length, `${method} ${n}`);
      const pal = new Set(res.palette.map((c) => c.join()));
      for (let i = 0; i < w * h; i++) assert.ok(pal.has([...res.data.subarray(i * 4, i * 4 + 3)].join()));
    }

// Median cut on a two-colour image keeps exactly those two colours, unchanged
const two = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) two.set(i % 3 ? [242, 194, 48, 255] : [17, 17, 17, 255], i * 4);
const res2 = L.quantize({ data: two, width: w, height: h }, 16, 'median', false);
assert.equal(res2.palette.length, 2);
assert.deepEqual([...res2.data], [...two]);

assert.equal(L.estimateBytes(100, 10, 16), 500 + 48);
console.log('check.mjs: all assertions passed');
