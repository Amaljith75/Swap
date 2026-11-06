# Swap brand images

`mark.py` draws the Swap mark (two interlocking swap pieces forming an S) and every
icon size from it; `render.js` turns the SVGs into PNGs with Playwright:

    python3 tools/brand/mark.py /tmp/jobs.json
    NODE_PATH=$(npm root -g) node tools/brand/render.js /tmp/jobs.json /tmp/out

Then copy the PNGs into `assets/` (app icons) and `assets/brand/` (mark pieces used by
the opening animation). The SWAP title (`assets/brand/wordmark.png`) is Archivo Black
Italic (SIL Open Font License), rendered white on transparent and tinted in the app.
