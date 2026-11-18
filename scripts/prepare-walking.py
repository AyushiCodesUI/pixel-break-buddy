"""Align the supplied RGBA sprite sheet without resizing or altering its pixels.
Run from the project root: python3 scripts/prepare-walking.py
Uses only the Python standard library.
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/mascot/walking.png'
TARGET = ROOT / 'assets/mascot/walking-aligned.png'


def read_rgba(file):
    data = file.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Expected a PNG')
    position, chunks = 8, []
    while position < len(data):
        length = struct.unpack('>I', data[position:position + 4])[0]
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + length]
        position += length + 12
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError('Expected an 8-bit non-interlaced RGBA PNG')
        if kind == b'IDAT':
            chunks.append(payload)
    raw = zlib.decompress(b''.join(chunks))
    stride = width * 4
    previous, rows = bytearray(stride), []
    for y in range(height):
        mode = raw[y * (stride + 1)]
        row = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            a = row[x - 4] if x >= 4 else 0
            b = previous[x]
            c = previous[x - 4] if x >= 4 else 0
            if mode == 0:
                prediction = 0
            elif mode == 1:
                prediction = a
            elif mode == 2:
                prediction = b
            elif mode == 3:
                prediction = (a + b) // 2
            elif mode == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                prediction = a if pa <= pb and pa <= pc else b if pb <= pc else c
            else:
                raise ValueError('Unknown PNG filter')
            row[x] = (row[x] + prediction) & 255
        rows.append(row)
        previous = row
    return width, height, rows


def write_rgba(file, width, height, rows):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    pixels = b''.join(b'\0' + row for row in rows)
    file.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(pixels, 9)) + chunk(b'IEND', b''))


def prepare():
    width, height, rows = read_rgba(SOURCE)
    if (width, height) != (1536, 1024):
        raise ValueError('Source dimensions changed; inspect alignment before preparing')
    # Head centers are approximately x=278, 758, 1238 (480px apart rather
    # than the nominal 512px grid). These 512px crops center each at x=256.
    # Both source rows share the same baseline (within one artwork pixel).
    offsets = [22, 502, 982]
    frames = [(x, y) for y in (0, 512) for x in offsets]
    result = []
    for y in range(512):
        result.append(b''.join(rows[top + y][left * 4:(left + 512) * 4] for left, top in frames))
    write_rgba(TARGET, 3072, 512, result)
    print('Prepared 6 aligned 512 x 512 frames, top row first, in', TARGET)


if __name__ == '__main__':
    prepare()
