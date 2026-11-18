"""Build a temporary macOS icon from the existing Happy PNG (no new artwork)."""
import importlib.util
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('png', ROOT / 'scripts/prepare-walking.py')
png = importlib.util.module_from_spec(spec)
spec.loader.exec_module(png)
width, height, source = png.read_rgba(ROOT / 'assets/mascot/state-happy.png')
output = ROOT / 'build/icon.icns'
output.parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='pixel-buddy-icon-') as temporary:
    iconset = Path(temporary) / 'PixelBreakBuddy.iconset'
    iconset.mkdir()
    for name, size in [('16x16', 16), ('16x16@2x', 32), ('32x32', 32), ('32x32@2x', 64),
                       ('128x128', 128), ('128x128@2x', 256), ('256x256', 256),
                       ('256x256@2x', 512), ('512x512', 512), ('512x512@2x', 1024)]:
        scaled_height = round(size * height / width)
        top = (size - scaled_height) // 2
        rows = [bytearray(size * 4) for _ in range(size)]
        for y in range(scaled_height):
            src = source[min(height - 1, y * height // scaled_height)]
            for x in range(size):
                sx = min(width - 1, x * width // size)
                rows[y + top][x * 4:x * 4 + 4] = src[sx * 4:sx * 4 + 4]
        png.write_rgba(iconset / f'icon_{name}.png', size, size, rows)
    subprocess.run(['iconutil', '--convert', 'icns', '--output', str(output), str(iconset)], check=True)
print('Created', output)
