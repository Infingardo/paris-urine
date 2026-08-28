"""Genera icon-192.png e icon-512.png: quadrato arrotondato teal con testo 'TPS'.
Uso: python3 tools/make-icons.py   (richiede Pillow)"""
from PIL import Image, ImageDraw, ImageFont

BG = (14, 124, 123, 255)   # #0e7c7b
FG = (255, 255, 255, 255)

def make(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.18)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    txt = "TPS"
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), txt, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), txt, font=font, fill=FG)
    img.convert("RGB").save(path, "PNG")
    print("scritto", path)

make(192, "icon-192.png")
make(512, "icon-512.png")
