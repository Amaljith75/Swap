# Swap mark: two curved swap arrows chasing each other (rotationally symmetric).
import math, json, sys
C = 500.0
OFF, R, W = 100.0, 150.0, 164.0          # each piece's arc centre is offset from the middle
T1, T2 = 118.0, 312.0                   # arc span (y-down degrees): a bold "C" bean
TILT = 8.0

def arrow(rot):
    """One bean-shaped swap piece: a thick arc with round ends, rotated rot degrees about the centre."""
    cx, cy = C - OFF, C - OFF
    p = lambda t: (cx + R * math.cos(math.radians(t)), cy + R * math.sin(math.radians(t)))
    (x1, y1), (x2, y2) = p(T1), p(T2)
    large = 1 if (T2 - T1) % 360 > 180 else 0
    arc = f'M{x1:.1f} {y1:.1f} A{R} {R} 0 {large} 1 {x2:.1f} {y2:.1f}'
    return (f'<g transform="rotate({rot + TILT} {C} {C})">'
            f'<path d="{arc}" fill="none" stroke="currentColor" stroke-width="{W}" stroke-linecap="round"/></g>')

GRAD = ('<defs><linearGradient id="pastel" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#F1F2A8"/><stop offset="0.5" stop-color="#C9D4F0"/>'
        '<stop offset="1" stop-color="#EBD3EE"/></linearGradient></defs>')
LIME, PASTEL, INK = '#B7F34A', 'url(#pastel)', '#0E0E10'

def svg(which='both', color=(LIME, PASTEL), size=1000, scale=1.0, bg=None, tile=None):
    """which: 'a', 'b' or 'both'. color: one colour, or (piece A, piece B).
    scale shrinks the mark around the centre (for icon safe zones)."""
    ca, cb = (color, color) if isinstance(color, str) else color
    def piece(rot, c):
        return arrow(rot).replace('stroke="currentColor"', f'stroke="{c}"')
    parts = ([piece(0, ca)] if which in ('a', 'both') else []) + ([piece(180, cb)] if which in ('b', 'both') else [])
    k = scale
    g = f'<g transform="translate({C*(1-k)} {C*(1-k)}) scale({k})">{"".join(parts)}</g>'
    back = ''
    if bg: back += f'<rect width="1000" height="1000" fill="{bg}"/>'
    if tile: back += f'<rect x="{tile[0]}" y="{tile[0]}" width="{1000-2*tile[0]}" height="{1000-2*tile[0]}" rx="{tile[1]}" fill="{tile[2]}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="{size}" height="{size}">{GRAD}{back}{g}</svg>'

if __name__ == '__main__':
    out = sys.argv[1]
    jobs = {
      # app icon (iOS / legacy Android): app-dark square, lime + pastel mark
      'icon.png':                     (1024, svg('both', (LIME, PASTEL), 1024, 0.86, bg=INK)),
      # Android adaptive icon: dark background, coloured mark inside the safe zone
      'android-icon-background.png':  (1024, f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="{INK}"/></svg>'),
      'android-icon-foreground.png':  (1024, svg('both', (LIME, PASTEL), 1024, 0.62)),
      # monochrome and notification icons must be single-colour silhouettes (Android tints them)
      'android-icon-monochrome.png':  (1024, svg('both', '#FFFFFF', 1024, 0.62)),
      'notification-icon.png':        (96,   svg('both', '#FFFFFF', 96, 1.0)),
      'favicon.png':                  (48,   svg('both', (LIME, PASTEL), 48, 0.84, tile=(40, 210, INK))),
      # in-app: coloured pieces for the opening animation, and the combined mark
      'mark-a.png':                   (512,  svg('a', (LIME, PASTEL), 512, 1.0)),
      'mark-b.png':                   (512,  svg('b', (LIME, PASTEL), 512, 1.0)),
      'mark.png':                     (512,  svg('both', (LIME, PASTEL), 512, 1.0)),
      'tile.png':                     (512,  svg('both', (LIME, PASTEL), 512, 0.84, tile=(0, 230, INK))),
    }
    json.dump({k: v[1] for k, v in jobs.items()}, open(out, 'w'))
