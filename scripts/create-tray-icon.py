"""Hand-drawn monochrome pixel girl/headphone template at native 1x and 2x."""
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('png', ROOT / 'scripts/prepare-walking.py')
png = importlib.util.module_from_spec(spec)
spec.loader.exec_module(png)
# Headphones, fringe, eyes and braids: black ink on transparent pixels.
ART = [
'..................',
'......######......',
'....##......##....',
'...#..######..#...',
'..#..########..#..',
'..#.##########.#..',
'.##.##.##.####.##.',
'.##.#......###.##.',
'.##.#.#..#..##.##.',
'.##.#.......##.##.',
'..#.#..##...##.#..',
'....##.....###....',
'...###.####.###...',
'..###...##...###..',
'...##........##...',
'....#........#....',
'..................',
'..................',
]
assert len(ART) == 18 and all(len(row) == 18 for row in ART)
folder = ROOT / 'assets/tray'
folder.mkdir(parents=True, exist_ok=True)
for scale, suffix in ((1, ''), (2, '@2x')):
    rows = []
    for y in range(18 * scale):
        row = bytearray()
        for x in range(18 * scale):
            row.extend((0, 0, 0, 255 if ART[y // scale][x // scale] == '#' else 0))
        rows.append(row)
    png.write_rgba(folder / f'buddyTemplate{suffix}.png', 18 * scale, 18 * scale, rows)
print('Created monochrome 18pt and Retina template icons.')
