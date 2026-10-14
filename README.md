# PocketSci

A pocket scientific calculator that runs in the browser, built mobile-first for your phone and comfortable on a computer. It follows the key layout and behaviour of the TI-30 eco RS, so the same keystrokes give the same results.

## Features

- **Classic AOS order of operations**: up to 4 pending operations (2 while statistics data is stored) and 15 open parentheses
- **10-digit display** with a 2-digit exponent, plus floating, scientific (SCI), engineering (ENG) and fixed-decimal (FIX 0–9) notation
- **Fractions**: simple and mixed fractions, mixed ⇄ improper (d/c), fraction ⇄ decimal (F◂▸D)
- **Angles**: DEG, RAD and GRAD, unit conversion (DRG▸), degrees-minutes-seconds (DMS▸DD, DD▸DMS)
- **Trigonometry and hyperbolic functions**, including inverses
- **Powers, roots and logs**: x², x³, √x, ∛x, yˣ, ˣ√y, 1/x, LOG, LN, 10ˣ, eˣ
- **Coordinates**: rectangular ⇄ polar (R▸P, P▸R) with the x⇌y register
- **One-variable statistics**: Σ+, Σ−, frequencies (FRQ), n, Σx, Σx², x̄, σxn, σxn−1
- **Probability**: nCr, nPr, x!
- **Percentages**, **constant operations (K)** and **3 memories** (STO, RCL, SUM, EXC)
- **Calculation history**: each calculation you finish with = is listed with its expression; tap one to reuse the result
- **Physical keyboard support** on desktop

Like the real calculator, everything starts fresh when you open the app: memories, statistics, history and settings are not kept between sessions.

## Using it

Keys work exactly as printed: press **2nd** to reach the function written above a key. When 2nd is active, those labels light up.

| Key | Main | 2nd |
|---|---|---|
| DRG | Cycle DEG / RAD / GRAD | DRG▸ convert the displayed value |
| LOG / LN | log, ln | 10ˣ, eˣ |
| HYP | Hyperbolic prefix for SIN/COS/TAN | K (constant) |
| yˣ | Power | ˣ√y (x-th root of y) |
| π | Pi | x⇌y |
| 1/x | Reciprocal | FRQ (frequency) |
| x² / √x | Square, square root | x̄, σxn−1 |
| Σ+ | Add data point | Σ− remove data point |
| EE | Exponent | n |
| ( / ) | Parentheses | Σx, Σx² |
| STO / RCL | Store, recall (then 1–3) | EXC, SUM |
| 7 8 9 | Digits | CSR (clear stats), nCr, nPr |
| 4 5 6 | Digits | FLO, SCI, ENG |
| 1 2 3 | Digits | x³, %, x! |
| 0 / . | Digit, decimal point | ∛x, FIX (then 0–9, or . to cancel) |
| a b/c | Enter a fraction | d/c |
| ← | Delete last digit | F◂▸D |
| ÷ × − + = | Operations | σxn, P▸R, R▸P, DMS▸DD, DD▸DMS |
| CE/C | Clear entry (press twice to clear all) | |
| ON/AC | Reset everything | |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `0`–`9`, `.` | Digits, decimal point |
| `+` `-` `*` `/` `^` | Operations |
| `(` `)` | Parentheses |
| `Enter` or `=` | Equals |
| `Backspace` | ← |
| `Escape` | CE/C (or close the history) |
| `Delete` | ON/AC |
| `Shift` (tap alone) | 2nd |
| `s` `c` `t` | SIN, COS, TAN |
| `l` `n` | LOG, LN |
| `h` `d` `p` | HYP, DRG, π |
| `q` `r` `i` | x², √x, 1/x |
| `e` `f` | EE, a b/c |
| `%` `!` | Percent, factorial |

## Run it locally

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Deploy on GitHub Pages

1. Push all the files (including `manifest.webmanifest` and the three icons) to the root of the repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. After a minute, the app is live at the address shown at the top of the Pages settings.

On iPhone, open the link in Safari and use **Share → Add to Home Screen**: PocketSci then opens full screen, like a regular app.

## Project structure

```
PocketSci/
├── index.html   # page layout: display, keypad, history panel
├── style.css    # visual design and responsive layout
├── script.js    # calculator engine (AOS, formatting, functions) and UI
├── manifest.webmanifest  # home screen app settings (full screen, name, icons)
├── apple-touch-icon.png  # iPhone home screen icon
├── icon-192.png          # app icons
├── icon-512.png
└── README.md
```

## Disclaimer

PocketSci is an independent project. It is not affiliated with, endorsed by or sponsored by Texas Instruments. TI-30 is a trademark of Texas Instruments Incorporated.
