# Paleta

A one-page interactive manual on Digital Color Systems & Quantization (Digital Media Midterm, Option B).
Plain HTML, CSS and JS: no build step, no dependencies. Fonts: Lexend and Atkinson Hyperlegible from Google Fonts.

## Run it

Any static server from this folder, for example:

```
python -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` straight from disk mostly works, but the quantizer can't read a real photo from `file://`.)

## Files

| File | What it is |
|---|---|
| `index.html` | The page: #top, #pixel, #models, #depth, #quantize, #hear, #check, #spec |
| `styles.css` | Greys-only interface, 12/8/4-column grid, 1200+/768/390 layouts |
| `lib.js` | Colour conversion, bit depth, uniform + median-cut quantization, Floyd–Steinberg, bit crush |
| `app.js` | Wires the widgets to the page |
| `colour-wheel.svg` | The HSL wheel in #models |
| `check.mjs` | `node check.mjs`: asserts the #F2C230 maths and the quantizers |

## Adding the real media

1. Put `jeepney-hero.webp` and `crusher-demo.mp3` next to `index.html`.
2. In `index.html`, change `<meta name="paleta-media" content="off">` to `content="on"`.
3. Replace the `[describe the jeepney photo]` alt text on `#hero-img`.

While the switch is `off`, the page never requests those files. It shows marked placeholders, and the quantizer runs on a colour ramp instead.

## Deploy (Vercel)

1. Push this repo to GitHub: `gh repo create paleta --public --source . --push`
2. On vercel.com/new, import the repo. Framework preset: **Other**. Leave the build command empty and set the output directory to the root.
3. Every later push redeploys.
