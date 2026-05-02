#!/usr/bin/env python3
"""Generate Pelorus Inspector icons - grayscale with network diagram."""

from PIL import Image, ImageDraw, ImageFont

# Colors
BG_COLOR = (20, 20, 20)
GRAY = (160, 160, 160)
LINE_GRAY = (120, 120, 120)
RED_TINT = (180, 100, 100)

# Output sizes
SIZES = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    '256x256.png': 256,
    '512x512.png': 512,
    'icon.png': 256,
}


def create_icon(size):
    """Create icon at given size using 4x supersampling for smooth edges."""
    scale = 4
    s = size * scale

    img = Image.new('RGBA', (s, s), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)

    # Text
    font_size = int(s * 0.4)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
    except:
        font = ImageFont.load_default()

    bbox = font.getbbox("CAN")
    text_x = (s - bbox[2] + bbox[0]) // 2
    text_y = int(s * 0.08)
    draw.text((text_x, text_y), "CAN", font=font, fill=GRAY)

    # Bus line - moved up for larger sizes
    offset = 0.05 if size > 32 else 0
    bus_y = int(s * (0.75 - offset))
    bus_width = max(8, int(16 * s / 512))
    draw.line([(int(s * 0.12), bus_y), (int(s * 0.88), bus_y)], fill=LINE_GRAY, width=bus_width)

    # Node dimensions
    node_w = max(54, int(120 * s / 512))
    node_h = max(30, int(66 * s / 512))
    outline = max(6, int(14 * s / 512))
    radius = max(4, int(8 * s / 512))
    line_w = max(2, int(4 * s / 512))

    # Node positions
    nodes = [
        (int(s * 0.28), int(s * (0.62 - offset)), 'above'),
        (int(s * 0.72), int(s * (0.62 - offset)), 'above'),
        (s // 2, int(s * (0.88 - offset)), 'below'),
    ]

    for x, y, pos in nodes:
        # Connection line
        if pos == 'above':
            draw.line([(x, y + node_h // 2), (x, bus_y - bus_width // 2)], fill=LINE_GRAY, width=line_w)
        else:
            draw.line([(x, bus_y + bus_width // 2), (x, y - node_h // 2)], fill=LINE_GRAY, width=line_w)

        # Node rectangle - bottom node gets red tint
        color = RED_TINT if pos == 'below' else GRAY
        draw.rounded_rectangle(
            [x - node_w // 2, y - node_h // 2, x + node_w // 2, y + node_h // 2],
            radius=radius, outline=color, width=outline
        )

    return img.resize((size, size), Image.LANCZOS)


def main():
    for filename, size in SIZES.items():
        create_icon(size).save(f'/home/rene/Source/Workspace/pelorus-inspector/src-tauri/icons/{filename}')
        print(f"Generated {filename}")
    print("Done!")


if __name__ == '__main__':
    main()
