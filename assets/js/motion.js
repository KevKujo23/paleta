// Scroll motion. Each section enters with the same reveal, then plays one move that shows its idea.
// Everything is skipped when the visitor asks for reduced motion, or if GSAP failed to load.
(() => {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ease = 'power3.out';

  // Draws an SVG stroke from nothing to full length.
  function drawStroke(el, duration = 1) {
    if (!el || !el.getTotalLength) return;
    const len = el.getTotalLength();
    if (!len) return;
    gsap.fromTo(el, { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration, ease: 'power2.inOut', onComplete: () => gsap.set(el, { clearProps: 'strokeDasharray,strokeDashoffset' }) });
  }

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    /* Hero: headline, line, button, then the photo unveils top to bottom. */
    gsap.timeline({ defaults: { ease } })
      .from('.hero h1', { y: 40, autoAlpha: 0, duration: 0.9 })
      .from('.hero .lede', { y: 24, autoAlpha: 0, duration: 0.7 }, '-=0.55')
      .from('.hero__cta', { y: 16, autoAlpha: 0, duration: 0.6 }, '-=0.45')
      .from('.hero__photo img', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'power3.inOut' }, '-=0.3')
      .from('.hero__photo figcaption', { autoAlpha: 0, duration: 0.5 }, '-=0.3');

    /* Every section: the number drifts as you pass (the hand-off between sections), copy and widget rise in. */
    $$('main > .lesson').forEach((sec) => {
      const num = $('.num', sec);
      if (num) {
        gsap.from(num, { y: 40, autoAlpha: 0, duration: 0.8, ease, scrollTrigger: { trigger: sec, start: 'top 80%', once: true } });
        gsap.fromTo(num, { yPercent: 30 }, { yPercent: -30, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
      const copy = $$(':scope > .wrap:first-child .copy > :not(.num), :scope > .wrap:first-child > h2, :scope > .wrap:first-child > .body, .qhead__text', sec);
      if (copy.length) gsap.from(copy, { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease, scrollTrigger: { trigger: sec, start: 'top 75%', once: true } });
      const widget = $('.widget', sec);
      if (widget) gsap.from(widget, { y: 48, autoAlpha: 0, duration: 0.9, ease, scrollTrigger: { trigger: sec, start: 'top 70%', once: true } });
    });

    /* 01 Pixel: the three lights start apart and slide together, so the overlaps light up as they meet. */
    gsap.timeline({ scrollTrigger: { trigger: '#rgb-svg', start: 'top 75%', once: true }, defaults: { duration: 1.3, ease: 'power2.inOut' } })
      .from('#c-r', { attr: { cx: 135, cy: 30 } }, 0.2)
      .from('#c-g', { attr: { cx: 40, cy: 210 } }, 0.2)
      .from('#c-b', { attr: { cx: 230, cy: 210 } }, 0.2)
      .from('.spectrum rect', { scaleX: 0, transformOrigin: '0 50%', duration: 1, ease }, 0.3);

    /* 02 Models: the wheel turns into place. */
    gsap.from('#models .wheel', { rotation: -120, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '#models .wheel', start: 'top 80%', once: true } });

    /* 03 Schemes: the shape draws itself between the hues, on entry and every time the scheme changes. */
    const schemeIn = () => {
      drawStroke($('#sc-shape'), 0.8);
      gsap.from('#sc-dots circle', { scale: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.08, ease: 'back.out(2)', delay: 0.15 });
      gsap.from('#sc-swatches li', { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease });
    };
    ScrollTrigger.create({ trigger: '#schemes .wheel', start: 'top 75%', once: true, onEnter: schemeIn });
    $$('#sc-seg button').forEach((b) => b.addEventListener('click', () => requestAnimationFrame(schemeIn)));

    /* 04 Depth: the banded strip wipes in and the table counts down row by row. */
    gsap.timeline({ scrollTrigger: { trigger: '#depth-strip', start: 'top 80%', once: true } })
      .from('#depth .strip-ref, #depth-strip', { clipPath: 'inset(0 100% 0 0)', duration: 1, stagger: 0.2, ease: 'power2.inOut' })
      .from('#depth .levels tbody tr', { x: -16, autoAlpha: 0, duration: 0.4, stagger: 0.07, ease }, '-=0.4');

    /* 05 Histogram: the bars grow up from the baseline, and settle again when the exposure changes. */
    gsap.from('#hist-graph', { scaleY: 0, transformOrigin: '50% 100%', duration: 1, ease, scrollTrigger: { trigger: '#hist-graph', start: 'top 85%', once: true } });
    $$('#hist-seg button').forEach((b) => b.addEventListener('click', () =>
      gsap.fromTo('#hist-graph', { scaleY: 0.4 }, { scaleY: 1, transformOrigin: '50% 100%', duration: 0.6, ease: 'back.out(1.6)' })));

    /* 06 Quantize: the divider sweeps from all-original to the middle, showing what survives. */
    if (window.PaletaUI && !matchMedia('(max-width: 767px)').matches) {
      const split = { p: 100 };
      window.PaletaUI.setSplit(100);
      ScrollTrigger.create({
        trigger: '#q-stage', start: 'top 60%', once: true,
        onEnter: () => gsap.to(split, { p: 50, duration: 1.6, ease: 'power2.inOut', onUpdate: () => window.PaletaUI.setSplit(split.p) }),
      });
    }
    gsap.from('#q-chips li', { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.03, ease, scrollTrigger: { trigger: '#q-chips', start: 'top 85%', once: true } });

    /* 07 Hear: the staircase wave draws across. */
    ScrollTrigger.create({ trigger: '#wave', start: 'top 80%', once: true, onEnter: () => { drawStroke($('#wave-smooth'), 1.2); drawStroke($('#wave-steps'), 1.6); } });

    /* 08 Check and the spec: questions and table rows arrive one after another. */
    gsap.from('#check .q', { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.1, ease, scrollTrigger: { trigger: '#check .quiz', start: 'top 80%', once: true } });
    gsap.from('#spec tbody tr', { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.1, ease, scrollTrigger: { trigger: '#spec table', start: 'top 80%', once: true } });
  });

  // Images and fonts change the page height after load; re-measure the trigger points.
  addEventListener('load', () => ScrollTrigger.refresh());
})();
