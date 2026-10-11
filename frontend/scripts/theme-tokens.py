"""Build the colour tokens for the four age themes and check their contrast.

    python3 frontend/scripts/theme-tokens.py          # writes src/theme/tokens.css
    python3 frontend/scripts/theme-tokens.py --check  # only checks contrast

Each theme (html[data-age="13-15" | "16-18" | "18+" | "teacher"]) has a light and
a dark set of semantic colours (page, surface, ink, rules, one brand accent, four
status colours) plus 11-step scales. The scales back the old Tailwind palette
names (bg-emerald-600, text-gray-700 ...) so any class a component still uses
lands on the theme instead of a random hue. See frontend/DESIGN.md.

Edit the hex values here, never tokens.css. The script exits 1 if any pair the
components rely on drops below WCAG AA.
"""
import math
import os
import sys

STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

# Shared reasoning states: Holds, Unsure, Breaks here, Given / Hint.
STATUS = {
    'light': {'success': '#1D7444', 'warning': '#855C00', 'danger': '#B3261E', 'info': '#1F627A'},
    'dark': {'success': '#62C98F', 'warning': '#E2B04A', 'danger': '#E16D60', 'info': '#75B9D1'},
}

THEMES = {
    # Field notebook: phenolphthalein pink fill with dark text.
    '13-15': {
        'light': dict(bg='#F4F5F8', surface='#FCFCFD', ink='#16181D', muted='#596070', rule='#D3D7DF', rule_strong='#7D8494',
                      brand='#D45490', on_brand='#1E0814', brand_ink='#9C2C61'),
        'dark': dict(bg='#14161B', surface='#1D2027', ink='#ECEEF2', muted='#A2A8B4', rule='#343944', rule_strong='#737A88',
                     brand='#EAA4C5', on_brand='#22091A', brand_ink='#EAA4C5'),
        'brand': ['#FAF5F7', '#F5E5ED', '#F1CBDD', '#EAA4C5', '#DD7EAA', '#D45490', '#C13376', '#9C2C61', '#79204A', '#541C36', '#351223'],
    },
    # Engineering pad: ink blue. Also the brand and logged-out theme.
    '16-18': {
        'light': dict(bg='#F2F5F7', surface='#FBFCFD', ink='#111820', muted='#53606D', rule='#CAD3DC', rule_strong='#7A8693',
                      brand='#2C5696', on_brand='#F6F8FD', brand_ink='#2C5696'),
        'dark': dict(bg='#0F141A', surface='#172029', ink='#E5EBF1', muted='#98A4B2', rule='#2A3542', rule_strong='#667587',
                     brand='#8BADE4', on_brand='#0A1426', brand_ink='#8BADE4'),
        'brand': ['#F5F7FA', '#E5ECF5', '#C4D5EE', '#8BADE4', '#618ED1', '#386FC2', '#2C5696', '#24467B', '#1D3963', '#1A2C47', '#101C2D'],
    },
    # Journal and slate: verdigris.
    '18+': {
        'light': dict(bg='#F2F4F3', surface='#FAFBFA', ink='#191D1C', muted='#565F5C', rule='#D0D6D3', rule_strong='#7C8682',
                      brand='#2A6C65', on_brand='#F4FAF9', brand_ink='#2A6C65'),
        'dark': dict(bg='#1A201F', surface='#222A29', ink='#E3E8E6', muted='#9EA8A5', rule='#35403E', rule_strong='#717D7A',
                     brand='#74C4B8', on_brand='#0B1917', brand_ink='#74C4B8'),
        'brand': ['#F5F9F9', '#E7F3F2', '#CCEAE7', '#A4DAD4', '#74C4B8', '#47AEA2', '#327D74', '#2A6C65', '#22534E', '#1C3B37', '#122624'],
    },
    # Ledger: low-saturation slate blue, so attention goes to the data.
    'teacher': {
        'light': dict(bg='#F3F5F7', surface='#FCFDFD', ink='#131920', muted='#52606E', rule='#CDD5DE', rule_strong='#7B8794',
                      brand='#3A5876', on_brand='#F5F8FB', brand_ink='#3A5876'),
        'dark': dict(bg='#10151B', surface='#182029', ink='#E2E8EE', muted='#95A3B1', rule='#2B3846', rule_strong='#657385',
                     brand='#93B4D6', on_brand='#0B1520', brand_ink='#93B4D6'),
        'brand': ['#F6F7F9', '#E8EDF2', '#CBD9E7', '#93B4D6', '#789CBF', '#5985B1', '#466E95', '#3A5876', '#2E4761', '#253646', '#17212B'],
    },
}

# Misconception X-ray ramp (iodine to rust), steps 0-5, with the cell text colour for each step.
RAMP = {
    'light': (['#EEF1F4', '#F1DFD5', '#E1BAA8', '#CC8C75', '#A34C33', '#712F1E'], ['#131920'] * 4 + ['#F5F8FB'] * 2),
    'dark': (['#1A222B', '#412E25', '#684131', '#C07154', '#DB9176', '#EEC1AA'], ['#E2E8EE'] * 3 + ['#10151B'] * 3),
}

DEFAULT_THEME = '16-18'

# --- colour maths (OKLab) ---------------------------------------------------

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def rgb2hex(c):
    return '#' + ''.join(f'{max(0, min(255, round(x * 255))):02X}' for x in c)

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _delin(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

def to_oklab(c):
    r, g, b = (_lin(x) for x in c)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)

def from_oklab(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    return tuple(_delin(x) if x > 0 else 0 for x in rgb), all(-1e-4 <= x <= 1 + 1e-4 for x in rgb)

def mix(a, b, t):
    A, B = to_oklab(hex2rgb(a)), to_oklab(hex2rgb(b))
    rgb, _ = from_oklab(*(A[i] + (B[i] - A[i]) * t for i in range(3)))
    return rgb2hex(rgb)

def lch(hexc):
    L, a, b = to_oklab(hex2rgb(hexc))
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360

def from_lch(L, C, H):
    while True:  # pull chroma in until the colour fits sRGB
        rgb, ok = from_oklab(L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H)))
        if ok or C < 1e-4:
            return rgb2hex(rgb)
        C *= 0.97

def luminance(h):
    r, g, b = (_lin(x) for x in hex2rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

# --- scales ----------------------------------------------------------------

LADDER = [0.975, 0.945, 0.895, 0.825, 0.725, 0.615, 0.515, 0.475, 0.405, 0.345, 0.255]
CHROMA = [0.10, 0.20, 0.40, 0.65, 0.85, 1.0, 1.0, 0.95, 0.85, 0.72, 0.55]
# Dark mode flips light and dark steps, so "bg-amber-50 text-amber-800" stays a soft panel.
# Mid steps stay put: they are what filled buttons with white text use.
DARK_SWAP = dict(zip(STEPS, ['950', '900', '800', '700', '400', '500', '600', '300', '200', '100', '50']))

def status_scale(base):
    """11 steps around `base`, which lands exactly on 700."""
    L0, C0, H = lch(base)
    i0 = STEPS.index('700')
    peak = C0 / CHROMA[i0]
    return {s: base.upper() if i == i0 else
            from_lch(LADDER[i] + (L0 - LADDER[i0]) * (1 - abs(i - i0) / 10) * 0.6, peak * CHROMA[i], H)
            for i, s in enumerate(STEPS)}

def neutral_scale(t, mode):
    if mode == 'light':
        bg, rule, strong, muted, ink = t['bg'], t['rule'], t['rule_strong'], t['muted'], t['ink']
        return {'50': bg, '100': mix(bg, rule, 0.45), '200': rule, '300': mix(rule, strong, 0.4), '400': mix(rule, strong, 0.8),
                '500': strong, '600': muted, '700': mix(muted, ink, 0.45), '800': mix(muted, ink, 0.75), '900': ink,
                '950': mix(ink, '#000000', 0.35)}
    surface, rule, strong, muted, ink = t['surface'], t['rule'], t['rule_strong'], t['muted'], t['ink']
    return {'50': surface, '100': mix(surface, rule, 0.5), '200': rule, '300': mix(rule, strong, 0.45), '400': strong,
            '500': mix(strong, muted, 0.5), '600': muted, '700': mix(muted, ink, 0.45), '800': mix(muted, ink, 0.75), '900': ink,
            '950': mix(ink, '#FFFFFF', 0.5)}

def build():
    status_scales = {k: status_scale(v) for k, v in STATUS['light'].items()}
    out = {}
    for tid, th in THEMES.items():
        brand = dict(zip(STEPS, th['brand']))
        out[tid] = {}
        for mode in ('light', 'dark'):
            t = th[mode]
            sem = dict(t)
            for k, v in STATUS[mode].items():
                sem[k] = v
                ground = t['surface'] if mode == 'light' else t['bg']
                sem[k + '_tint'] = mix(ground, v, 0.08 if mode == 'light' else 0.09)
                sem[k + '_rule'] = mix(ground, v, 0.35 if mode == 'light' else 0.42)
            sem['brand_tint'] = brand['100'] if mode == 'light' else mix(t['surface'], t['brand'], 0.22)
            sem['brand_tint2'] = brand['50'] if mode == 'light' else mix(t['surface'], t['brand'], 0.12)
            sem['neutral_tint'] = mix(t['bg'], t['rule'], 0.35) if mode == 'light' else mix(t['surface'], t['rule'], 0.5)
            scales = {'neutral': neutral_scale(t, mode)}
            if mode == 'light':
                scales['brand'] = brand
                scales.update(status_scales)
            else:
                scales['brand'] = {s: brand[DARK_SWAP[s]] for s in STEPS}
                scales.update({k: {s: v[DARK_SWAP[s]] for s in STEPS} for k, v in status_scales.items()})
            out[tid][mode] = {'sem': sem, 'scales': scales}
    return out

def check(tokens):
    problems = []
    for tid, modes in tokens.items():
        for mode, data in modes.items():
            sem = data['sem']
            pairs = [('ink', 'bg', 4.5), ('ink', 'surface', 4.5), ('muted', 'bg', 4.5), ('muted', 'surface', 4.5),
                     ('brand_ink', 'bg', 4.5), ('brand_ink', 'surface', 4.5), ('on_brand', 'brand', 4.5),
                     ('rule_strong', 'surface', 3.0), ('rule_strong', 'bg', 3.0), ('brand', 'bg', 3.0),
                     ('ink', 'brand_tint', 4.5), ('brand_ink', 'brand_tint', 4.5), ('ink', 'neutral_tint', 4.5),
                     ('muted', 'neutral_tint', 4.5)]
            for k in STATUS[mode]:
                pairs += [(k, 'bg', 4.5), (k, 'surface', 4.5), (k, k + '_tint', 4.5), ('ink', k + '_tint', 4.5)]
            for a, b, need in pairs:
                c = contrast(sem[a], sem[b])
                if c < need:
                    problems.append(f'{tid} {mode}: {a} on {b} is {c:.2f}, needs {need}')
            if mode == 'light':  # the old palette classes, as components used them
                for name, sc in data['scales'].items():
                    for fg, bg in [('700', '50'), ('800', '100'), ('900', '50'), ('600', '50')]:
                        c = contrast(sc[fg], sc[bg])
                        if c < 4.5:
                            problems.append(f'{tid} {mode}: {name}-{fg} on {name}-{bg} is {c:.2f}')
                    if name != 'neutral' and contrast('#FFFFFF', sc['600']) < 4.5:
                        problems.append(f'{tid} {mode}: white on {name}-600 is {contrast("#FFFFFF", sc["600"]):.2f}')
    for mode, (cells, inks) in RAMP.items():
        for i, (c, ink) in enumerate(zip(cells, inks)):
            if contrast(c, ink) < 4.5:
                problems.append(f'ramp {mode} step {i}: {contrast(c, ink):.2f}')
    return problems

def trip(h):
    r, g, b = (round(x * 255) for x in hex2rgb(h))
    return f'{r} {g} {b}'

def css_block(selector, data):
    sem, scales = data['sem'], data['scales']
    lines = [f'{selector} {{']
    for k in ['bg', 'surface', 'ink', 'muted', 'rule', 'rule_strong', 'brand', 'on_brand', 'brand_ink', 'brand_tint',
              'brand_tint2', 'neutral_tint']:
        lines.append(f'  --{k.replace("_", "-")}: {trip(sem[k])};')
    for k in STATUS['light']:
        for suffix in ('', '_tint', '_rule'):
            lines.append(f'  --{k}{suffix.replace("_", "-")}: {trip(sem[k + suffix])};')
    for name, sc in scales.items():
        lines.append('  ' + ' '.join(f'--c-{name}-{s}: {trip(sc[s])};' for s in STEPS))
    lines.append('}')
    return '\n'.join(lines)

def write_css(tokens, path):
    parts = ['/* Generated by frontend/scripts/theme-tokens.py. Edit that script, not this file. */',
             '/* Values are "R G B" so Tailwind can add alpha: rgb(var(--ink) / 0.5). */', '']
    for tid, modes in tokens.items():
        light_sel = f':root[data-age="{tid}"]'
        dark_sel = f':root[data-age="{tid}"].dark'
        if tid == DEFAULT_THEME:
            light_sel = ':root, ' + light_sel
            dark_sel = ':root.dark, ' + dark_sel
        parts += [css_block(light_sel, modes['light']), css_block(dark_sel, modes['dark']), '']
    for mode, (cells, inks) in RAMP.items():
        sel = ':root' if mode == 'light' else ':root.dark'
        body = ' '.join(f'--ramp-{i}: {trip(c)}; --ramp-ink-{i}: {trip(ink)};' for i, (c, ink) in enumerate(zip(cells, inks)))
        parts.append(f'{sel} {{ {body} }}')
    with open(path, 'w') as f:
        f.write('\n'.join(parts) + '\n')

if __name__ == '__main__':
    tokens = build()
    problems = check(tokens)
    if problems:
        print('\n'.join(problems))
        sys.exit(1)
    print('contrast: all pairs pass')
    if '--check' not in sys.argv:
        here = os.path.dirname(os.path.abspath(__file__))
        target = os.path.join(here, '..', 'src', 'theme', 'tokens.css')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        write_css(tokens, target)
        print('wrote', os.path.normpath(target))
