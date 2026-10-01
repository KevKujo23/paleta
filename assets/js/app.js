// Paleta widgets. Maths lives in lib.js (PaletaLib); this file only wires the page.
(() => {
  'use strict';
  const L = window.PaletaLib;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const mobile = matchMedia('(max-width: 767px)');

  // Range + number input pair: keeps both in step, clamps typed values, reports the value.
  function bindPair(range, num, onChange) {
    const min = +range.min, max = +range.max;
    const set = (v, fire = true) => {
      v = Math.round(L.clamp(+v, min, max));
      range.value = v;
      num.value = v;
      if (fire) onChange(v);
    };
    range.addEventListener('input', () => set(range.value));
    num.addEventListener('input', () => {
      if (num.value !== '' && +num.value >= min && +num.value <= max) set(num.value);
    });
    num.addEventListener('change', () => set(num.value === '' ? range.value : num.value));
    return set;
  }

  const pressOne = (buttons, active) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));

  /* ---------- nav: progress hairline, active link, mobile menu ---------- */
  const nav = $('#nav');
  const progress = $('.nav__progress span');
  const links = $$('.nav__links a');
  const targets = links.map((a) => $(a.hash));
  let navTick = false;
  function updateNav() {
    navTick = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    const line = nav.offsetHeight + 16;
    let cur = -1;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top <= line) cur = i; });
    if (max > 0 && scrollY >= max - 2) cur = targets.length - 1;
    links.forEach((a, i) => (i === cur ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  }
  addEventListener('scroll', () => { if (!navTick) { navTick = true; requestAnimationFrame(updateNav); } }, { passive: true });
  addEventListener('resize', updateNav);
  updateNav();

  const menuBtn = $('.nav__menu');
  const setMenu = (open) => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  links.forEach((a) => a.addEventListener('click', () => setMenu(false)));
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });
  mobile.addEventListener('change', () => setMenu(false));

  /* ---------- #pixel + #models: one shared colour ---------- */
  // HSL is kept alongside RGB so hue survives when saturation or lightness hits zero.
  const colour = { rgb: [242, 194, 48], hsl: L.rgbToHsl(242, 194, 48) };
  const fmt = {
    rgb: ([r, g, b]) => `rgb(${r},${g},${b})`,
    hex: (rgb) => L.rgbToHex(...rgb),
    hsl: ([h, s, l]) => `hsl(${Math.round(h) % 360},${Math.round(s)}%,${Math.round(l)}%)`,
    cmyk: (rgb) => L.rgbToCmyk(...rgb).join(','),
  };

  const pxSet = ['r', 'g', 'b'].map((c, i) =>
    bindPair($(`#px-${c}`), $(`#px-${c}-n`), (v) => {
      const rgb = colour.rgb.slice();
      rgb[i] = v;
      setRgb(rgb);
    }));
  const lightSet = bindPair($('#md-l'), $('#md-l-n'), (v) => setHsl([colour.hsl[0], colour.hsl[1], v]));

  function setRgb(rgb) { colour.rgb = rgb; colour.hsl = L.rgbToHsl(...rgb); renderColour(); }
  function setHsl(hsl) { colour.hsl = hsl; colour.rgb = L.hslToRgb(...hsl); renderColour(); }

  const wheel = $('#wheel'), handle = $('#wheel-handle'), shade = $('#wheel-shade');
  const valInputs = { rgb: $('#md-rgb'), hex: $('#md-hex'), hsl: $('#md-hsl'), cmyk: $('#md-cmyk') };

  function renderColour() {
    const [r, g, b] = colour.rgb;
    const [h, s, l] = colour.hsl;
    const hex = fmt.hex(colour.rgb);
    pxSet.forEach((set, i) => set(colour.rgb[i], false));
    $('#c-r').setAttribute('fill', `rgb(${r},0,0)`);
    $('#c-g').setAttribute('fill', `rgb(0,${g},0)`);
    $('#c-b').setAttribute('fill', `rgb(0,0,${b})`);
    $('#px-swatch').style.background = hex;
    $('#px-hex').textContent = hex;
    $('#px-rgb').textContent = fmt.rgb(colour.rgb);

    $('#md-swatch').style.background = hex;
    for (const k in valInputs) {
      valInputs[k].value = k === 'hsl' ? fmt.hsl(colour.hsl) : fmt[k](colour.rgb);
      valInputs[k].removeAttribute('aria-invalid');
    }
    // Wheel image is drawn at 50% lightness; mixing in black or white gives the exact HSL colour.
    shade.style.background = l < 50 ? '#000000' : '#FFFFFF';
    shade.style.opacity = String(Math.abs(l - 50) / 50);
    const a = (h * Math.PI) / 180;
    handle.style.left = `${50 + 50 * (s / 100) * Math.sin(a)}%`;
    handle.style.top = `${50 - 50 * (s / 100) * Math.cos(a)}%`;
    handle.style.background = hex;
    handle.setAttribute('aria-valuenow', String(Math.round(h) % 360));
    handle.setAttribute('aria-valuetext', `Hue ${Math.round(h) % 360}°, saturation ${Math.round(s)}%`);
    lightSet(Math.round(l), false);
  }

  function wheelFromPointer(e) {
    const box = wheel.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    let h = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (h < 0) h += 360;
    const s = Math.min(1, Math.hypot(dx, dy) / (box.width / 2)) * 100;
    setHsl([h, s, colour.hsl[2]]);
  }
  wheel.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    wheel.setPointerCapture(e.pointerId);
    handle.focus({ preventScroll: true });
    wheelFromPointer(e);
  });
  wheel.addEventListener('pointermove', (e) => { if (wheel.hasPointerCapture(e.pointerId)) wheelFromPointer(e); });
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    let [h, s, l] = colour.hsl;
    if (e.key === 'ArrowRight') h += step;
    else if (e.key === 'ArrowLeft') h -= step;
    else if (e.key === 'ArrowUp') s += step;
    else if (e.key === 'ArrowDown') s -= step;
    else return;
    e.preventDefault();
    setHsl([(h + 360) % 360, L.clamp(s, 0, 100), l]);
  });

  // Typed notations: parse loosely (any separators), commit on Enter or blur.
  const nums = (str) => (String(str).match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const inRange = (arr, n, max) => arr.length === n && arr.every((v, i) => v >= 0 && v <= (Array.isArray(max) ? max[i] : max));
  const parsers = {
    rgb: (v) => { const a = nums(v); return inRange(a, 3, 255) ? { rgb: a.map(Math.round) } : null; },
    hex: (v) => { const a = L.hexToRgb(v); return a ? { rgb: a } : null; },
    hsl: (v) => { const a = nums(v); return inRange(a, 3, [360, 100, 100]) ? { hsl: [a[0] % 360, a[1], a[2]] } : null; },
    cmyk: (v) => { const a = nums(v); return inRange(a, 4, 100) ? { rgb: L.cmykToRgb(...a) } : null; },
  };
  const examples = { rgb: 'rgb(242,194,48)', hex: '#F2C230', hsl: 'hsl(45,88%,57%)', cmyk: '0,20,80,5' };
  const mdErr = $('#md-err');
  for (const k in valInputs) {
    valInputs[k].addEventListener('change', () => {
      const res = parsers[k](valInputs[k].value);
      if (!res) {
        valInputs[k].setAttribute('aria-invalid', 'true');
        mdErr.textContent = `Couldn’t read that as ${k.toUpperCase()}. Try ${examples[k]}.`;
        return;
      }
      mdErr.textContent = '';
      res.rgb ? setRgb(res.rgb) : setHsl(res.hsl);
    });
  }
  renderColour();

  /* ---------- #depth ---------- */
  const strip = $('#depth-strip');
  const stripCtx = strip.getContext('2d');
  const depthBtns = $$('#depth-seg button');
  function drawDepth(bits) {
    const img = stripCtx.createImageData(strip.width, 1);
    for (let x = 0; x < strip.width; x++) {
      const [r, g, b] = L.depthColour(x / (strip.width - 1), bits, [242, 194, 48]);
      img.data.set([r, g, b, 255], x * 4);
    }
    stripCtx.putImageData(img, 0, 0);
    const levels = bits >= 24 ? 'over 16 million colours' : `${2 ** bits} levels`;
    $('#depth-label').textContent = `${bits}-bit · ${levels}`;
    strip.setAttribute('aria-label', bits >= 24
      ? 'Strip from black to jeepney yellow at 24 bits: smooth, no visible bands'
      : `Strip banded into ${2 ** bits} steps from black to jeepney yellow`);
    $$('.levels tbody tr').forEach((tr) => tr.classList.toggle('is-active', +tr.dataset.bits === bits));
    pressOne(depthBtns, depthBtns.find((b) => +b.dataset.bits === bits));
  }
  depthBtns.forEach((b) => b.addEventListener('click', () => drawDepth(+b.dataset.bits)));
  drawDepth(4);

  /* ---------- #quantize ---------- */
  const q = { n: 16, method: 'median', dither: false, split: 50, view: 'after', source: null, sourceName: '', jeepney: null };
  const stage = $('#q-stage');
  const before = $('#q-before'), after = $('#q-after');
  const bctx = before.getContext('2d', { willReadFrequently: true });
  const actx2 = after.getContext('2d');
  const qHandle = $('#q-handle'), qLine = $('#q-line'), qReadout = $('#q-readout');
  const heroImg = $('#hero-img');

  function sizeBuffers() {
    const [w, h] = mobile.matches ? [480, 480] : [960, 480];
    before.width = after.width = w;
    before.height = after.height = h;
  }

  // Fallback if the photo can't load: a colour ramp with a left-right light falloff,
  // so there is still two-dimensional detail to band and dither.
  function drawRamp(ctx, w, h) {
    const v = ctx.createLinearGradient(0, 0, 0, h);
    [['#2B5C9E', 0], ['#A9CBE6', 0.22], ['#F2C230', 0.4], ['#E0662B', 0.58], ['#B3262E', 0.74], ['#3B2B26', 0.88], ['#151413', 1]]
      .forEach(([c, t]) => v.addColorStop(t, c));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    const hz = ctx.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(0,0,0,0.35)');
    hz.addColorStop(0.5, 'rgba(0,0,0,0)');
    hz.addColorStop(1, 'rgba(255,255,255,0.25)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSource() {
    const { width: w, height: h } = before;
    bctx.clearRect(0, 0, w, h);
    if (q.source) {
      const img = q.source;
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      bctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      drawRamp(bctx, w, h);
    }
    const own = q.source && q.source !== q.jeepney;
    const src = $('#q-source');
    src.hidden = !own;
    src.innerHTML = '';
    if (own) {
      const tag = document.createElement('span');
      tag.className = 'lbl';
      tag.textContent = 'Your photo';
      src.append(tag, ` ${q.sourceName} · fitted to canvas`);
    }
    before.setAttribute('aria-label', `Before: ${describeSource()}, original colours`);
  }

  function describeSource() {
    if (!q.source) return 'a colour ramp';
    if (q.source !== q.jeepney) return 'your photo';
    return 'the jeepney photo';
  }

  const fmtBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const methodName = () => (q.method === 'median' ? 'median cut' : 'uniform');

  function renderQuant() {
    const { width: w, height: h } = before;
    const res = L.quantize(bctx.getImageData(0, 0, w, h), q.n, q.method, q.dither);
    actx2.putImageData(new ImageData(res.data, w, h), 0, 0);

    const size = res.palette.length;
    const afterText = `After · ${size} colours · ${methodName()}${q.dither ? ' · dithered' : ''}`;
    $('#q-after-chip').textContent = afterText;
    $('#q-view-after').textContent = `After · ${size} colours`;
    after.setAttribute('aria-label', `After: ${describeSource()} quantized to ${size} colours with ${methodName()}${q.dither ? ' and Floyd–Steinberg dithering' : ''}`);

    $('#q-lut-lbl').textContent = `Palette (LUT) · ${size} entries`;
    const chips = $('#q-chips');
    chips.classList.toggle('chips--dense', size > 32);
    chips.replaceChildren(...res.palette.map((c) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      const hx = document.createElement('span');
      sw.className = 'chip-sw';
      sw.style.background = L.rgbToHex(...c);
      hx.className = 'chip-hex';
      hx.textContent = L.rgbToHex(...c);
      li.append(sw, hx);
      return li;
    }));

    const [nw, nh] = q.source ? [q.source.naturalWidth, q.source.naturalHeight] : [w, h];
    const bpp = L.bitsFor(res.used);
    const grid = res.levels ? ` (uniform grid ${res.levels.join(' × ')})` : '';
    $('#q-stats').textContent =
      `${res.used} colours used${grid} · ${bpp} bit${bpp > 1 ? 's' : ''} per pixel · est. size ${fmtBytes(L.estimateBytes(nw, nh, res.used))} (24-bit: ${fmtBytes(nw * nh * 3)})`;
    $('#q-summary').textContent = `${q.n} · ${q.method === 'median' ? 'Median cut' : 'Uniform'} · Dither ${q.dither ? 'on' : 'off'}`;
  }

  let quantQueued = false;
  function queueQuant() {
    if (quantQueued) return;
    quantQueued = true;
    setTimeout(() => { quantQueued = false; renderQuant(); });
  }
  function refreshAll() { sizeBuffers(); drawSource(); renderQuant(); applyView(); }

  // Divider: left of it is the original, right of it the quantized result.
  function setSplit(p) {
    q.split = L.clamp(Math.round(p), 0, 100);
    applyView();
  }
  function applyView() {
    stage.dataset.view = q.view;
    if (mobile.matches) { after.style.clipPath = ''; return; }
    const p = q.split;
    after.style.clipPath = `inset(0 0 0 ${p}%)`;
    qLine.style.left = qHandle.style.left = qReadout.style.left = `${p}%`;
    qHandle.setAttribute('aria-valuenow', String(p));
    qHandle.setAttribute('aria-valuetext', `${p}% original, ${100 - p}% quantized`);
    qReadout.textContent = `${p}% original`;
  }
  const splitFromPointer = (e) => {
    const box = stage.getBoundingClientRect();
    setSplit(((e.clientX - box.left) / box.width) * 100);
  };
  stage.addEventListener('pointerdown', (e) => {
    if (mobile.matches || e.button !== 0 || e.target.closest('.chip')) return;
    stage.setPointerCapture(e.pointerId);
    qHandle.classList.add('on');
    qReadout.hidden = false;
    splitFromPointer(e);
  });
  stage.addEventListener('pointermove', (e) => { if (stage.hasPointerCapture(e.pointerId)) splitFromPointer(e); });
  const endDrag = () => { qHandle.classList.remove('on'); qReadout.hidden = true; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  qHandle.addEventListener('keydown', (e) => {
    const big = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: -big, ArrowDown: -big, ArrowRight: big, ArrowUp: big, PageDown: -10, PageUp: 10 };
    if (e.key in moves) setSplit(q.split + moves[e.key]);
    else if (e.key === 'Home') setSplit(0);
    else if (e.key === 'End') setSplit(100);
    else return;
    e.preventDefault();
  });

  const viewBtns = $$('#q-view button');
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    q.view = b.dataset.view;
    pressOne(viewBtns, b);
    applyView();
  }));

  const setQuantN = bindPair($('#q-n'), $('#q-n-n'), (v) => {
    q.n = v;
    queueQuant();
    if (linked) setSoundBits(L.bitsFor(v), false);
    updateLinkNote();
  });
  const methodBtns = $$('#q-method button');
  methodBtns.forEach((b) => b.addEventListener('click', () => {
    q.method = b.dataset.method;
    pressOne(methodBtns, b);
    queueQuant();
  }));
  const ditherBtn = $('#q-dither');
  ditherBtn.addEventListener('click', () => {
    q.dither = !q.dither;
    ditherBtn.setAttribute('aria-checked', String(q.dither));
    queueQuant();
  });

  // Own photo: read locally through a blob: URL and drawn to canvas. Nothing leaves the browser.
  const fileInput = $('#q-file'), uploadBtn = $('#q-upload'), resetBtn = $('#q-reset'), qErr = $('#q-err');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { qErr.textContent = 'That file isn’t an image. Try a JPG, PNG or WebP.'; return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      qErr.textContent = '';
      q.source = img;
      q.sourceName = file.name;
      uploadBtn.hidden = true;
      resetBtn.hidden = false;
      resetBtn.focus();
      $('#q-stats').textContent = 'Extracting from your photo…';
      setTimeout(() => { drawSource(); renderQuant(); });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      qErr.textContent = 'Couldn’t open that image. Try a JPG, PNG or WebP.';
    };
    img.src = url;
  });
  resetBtn.addEventListener('click', () => {
    q.source = q.jeepney;
    q.sourceName = '';
    qErr.textContent = '';
    resetBtn.hidden = true;
    uploadBtn.hidden = false;
    uploadBtn.focus();
    drawSource();
    renderQuant();
  });

  // Mobile: controls sit in a bottom drawer.
  const controls = $('#q-controls'), drawerBtn = $('#q-drawer-btn');
  function setDrawer(open, returnFocus = true) {
    controls.classList.toggle('open', open);
    drawerBtn.setAttribute('aria-expanded', String(open));
    if (open) $('#q-n').focus();
    else if (returnFocus && mobile.matches) drawerBtn.focus();
  }
  drawerBtn.addEventListener('click', () => setDrawer(!controls.classList.contains('open')));
  $('#q-done').addEventListener('click', () => setDrawer(false));
  controls.addEventListener('keydown', (e) => { if (e.key === 'Escape' && controls.classList.contains('open')) setDrawer(false); });

  mobile.addEventListener('change', () => { setDrawer(false, false); refreshAll(); });

  // The hero photo doubles as the quantizer's source once it has loaded.
  const useJeepney = () => {
    q.jeepney = heroImg;
    if (!q.source) { q.source = heroImg; drawSource(); renderQuant(); }
  };
  if (heroImg.complete && heroImg.naturalWidth) useJeepney();
  else heroImg.addEventListener('load', useJeepney, { once: true });

  /* ---------- #hear ---------- */
  let ctx = null, osc = null, shaper = null, soundBits = 4, linked = true;
  const toneStatus = $('#tone-status');
  function crushCurve(bits) {
    const n = 65536, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = L.crush((i / (n - 1)) * 2 - 1, bits);
    return c;
  }
  // The tone is only ever started by the Play button: no autoplay.
  $('#tone-play').addEventListener('click', () => {
    if (!ctx) ctx = new AudioContext();
    ctx.resume();
    if (osc) return;
    osc = ctx.createOscillator();
    osc.frequency.value = 440;
    shaper = ctx.createWaveShaper();
    shaper.curve = crushCurve(soundBits);
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    osc.connect(shaper).connect(gain).connect(ctx.destination);
    osc.start();
    toneStatus.textContent = `Playing · ${soundBits} bits`;
  });
  function stopTone() {
    if (!osc) return;
    osc.stop();
    osc.disconnect();
    osc = shaper = null;
    toneStatus.textContent = 'Stopped';
  }
  $('#tone-stop').addEventListener('click', stopTone);

  const wavePath = (bits) => {
    let smooth = '', steps = '';
    for (let x = 0; x <= 690; x += 2) {
      const s = Math.sin((2 * Math.PI * x) / 345);
      smooth += `${x ? 'L' : 'M'}${x},${(80 - 60 * s).toFixed(1)}`;
      const y = (80 - 60 * L.crush(s, bits)).toFixed(1);
      steps += x ? `H${x}V${y}` : `M0,${y}`;
    }
    return [smooth, steps];
  };
  function drawWave(bits) {
    const [smooth, steps] = wavePath(bits);
    $('#wave-smooth').setAttribute('d', smooth);
    $('#wave-steps').setAttribute('d', steps);
    const lv = (2 ** bits).toLocaleString('en');
    $('#wave-cap').textContent = `${bits} bit${bits > 1 ? 's' : ''} · ${lv} levels · ${bits >= 12 ? 'close to smooth' : 'staircase'}`;
    $('#wave').setAttribute('aria-label', `Waveform at ${bits} bits: ${bits >= 12 ? 'the steps are too small to see' : 'a staircase over the smooth original'}`);
  }

  const soundSet = bindPair($('#snd-bits'), $('#snd-bits-n'), (v) => setSoundBits(v, true));
  function setSoundBits(bits, fromSound) {
    soundBits = bits;
    soundSet(bits, false);
    drawWave(bits);
    if (shaper) { shaper.curve = crushCurve(bits); toneStatus.textContent = `Playing · ${bits} bits`; }
    if (fromSound && linked) {
      q.n = Math.min(256, 2 ** bits);
      setQuantN(q.n, false);
      queueQuant();
    }
    updateLinkNote();
  }

  const linkBtn = $('#snd-link');
  function updateLinkNote() {
    const b = L.bitsFor(q.n);
    const eq = 2 ** b === q.n ? `${q.n} colours = ${b} bits` : `${q.n} colours need ${b} bits`;
    const cap = linked && soundBits > 8 ? ' · image capped at 256 colours = 8 bits' : '';
    $('#snd-link-note').textContent = linked ? `Synced with 04 · Squeeze the jeepney (${eq})${cap}` : 'Not linked: the image and the tone move separately.';
  }
  linkBtn.addEventListener('click', () => {
    linked = !linked;
    linkBtn.setAttribute('aria-checked', String(linked));
    if (linked) setSoundBits(L.bitsFor(q.n), false);
    updateLinkNote();
  });

  /* ---------- #check ---------- */
  const icons = {
    right: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" fill="none"/></svg>',
    wrong: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" fill="none"/></svg>',
  };
  const questions = $$('.q');
  questions.forEach((qEl) => qEl.addEventListener('change', (e) => {
    const input = e.target;
    const right = input.hasAttribute('data-correct');
    const fb = qEl.querySelector('.fb');
    fb.classList.toggle('is-wrong', !right);
    fb.innerHTML = right ? icons.right : icons.wrong;
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = right ? 'Right.' : 'Not quite.';
    text.append(strong, ` ${input.dataset.fb}`);
    if (!right) {
      const a = document.createElement('a');
      a.href = qEl.dataset.link;
      a.textContent = qEl.dataset.linkText;
      text.append(document.createElement('br'), a);
    }
    fb.append(text);
  }));

  // Mobile: one question at a time.
  let current = 0;
  const bars = $$('.quiz-bars span');
  function showQuestion(i) {
    current = L.clamp(i, 0, questions.length - 1);
    questions.forEach((el, j) => el.classList.toggle('is-current', j === current));
    bars.forEach((el, j) => el.classList.toggle('on', j <= current));
    $('#quiz-count').textContent = `Question ${current + 1} of ${questions.length}`;
    $('#quiz-prev').disabled = current === 0;
    $('#quiz-next').disabled = current === questions.length - 1;
  }
  $('#quiz-prev').addEventListener('click', () => showQuestion(current - 1));
  $('#quiz-next').addEventListener('click', () => showQuestion(current + 1));
  showQuestion(0);

  refreshAll();
  drawWave(soundBits);
  updateLinkNote();
})();
