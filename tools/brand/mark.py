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

def svg(which='both', color='#000', size=1000, scale=1.0, bg=None, tile=None):
    """which: 'a', 'b' or 'both'. scale shrinks the mark around the centre (for icon safe zones)."""
    parts = ([arrow(0)] if which in ('a', 'both') else []) + ([arrow(180)] if which in ('b', 'both') else [])
    inner = ''.join(parts)
    k = scale
    g = f'<g style="color:{color}" transform="translate({C*(1-k)} {C*(1-k)}) scale({k})">{inner}</g>'
    back = ''
    if bg: back += f'<rect width="1000" height="1000" fill="{bg}"/>'
    if tile: back += f'<rect x="{tile[0]}" y="{tile[0]}" width="{1000-2*tile[0]}" height="{1000-2*tile[0]}" rx="{tile[1]}" fill="{tile[2]}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="{size}" height="{size}">{back}{g}</svg>'

if __name__ == '__main__':
    out = sys.argv[1]
    jobs = {
      # app icon (iOS / legacy Android): full white square, black mark
      'icon.png':                     (1024, svg('both', '#0E0E10', 1024, 0.86, bg='#FFFFFF')),
      # Android adaptive icon: white background, black mark inside the safe zone
      'android-icon-background.png':  (1024, f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#FFFFFF"/></svg>'),
      'android-icon-foreground.png':  (1024, svg('both', '#0E0E10', 1024, 0.62)),
      'android-icon-monochrome.png':  (1024, svg('both', '#FFFFFF', 1024, 0.62)),
      'notification-icon.png':        (96,   svg('both', '#FFFFFF', 96, 1.0)),
      'favicon.png':                  (48,   svg('both', '#0E0E10', 48, 0.84, tile=(40, 210, '#FFFFFF'))),
      # in-app: white pieces for the intro animation, and the combined mark
      'mark-a.png':                   (512,  svg('a', '#FFFFFF', 512, 1.0)),
      'mark-b.png':                   (512,  svg('b', '#FFFFFF', 512, 1.0)),
      'mark.png':                     (512,  svg('both', '#FFFFFF', 512, 1.0)),
      'tile.png':                     (512,  svg('both', '#0E0E10', 512, 0.84, tile=(0, 230, '#FFFFFF'))),
    }
    json.dump({k: v[1] for k, v in jobs.items()}, open(out, 'w'))
