"""Render the existing paper mark for browser tabs (development requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def generate():
    image = Image.new('RGBA', (256, 256))
    draw = ImageDraw.Draw(image)
    red = '#b73530'
    draw.rounded_rectangle((0, 0, 255, 255), radius=59, fill=red)
    draw.rectangle((0, 128, 128, 235), fill=red)
    draw.rectangle((20, 215, 128, 255), fill=red)
    draw.pieslice((0, 215, 40, 255), 90, 180, fill=red)
    font = ImageFont.truetype(str(ROOT / 'fonts/KaiTiGB2312.ttf'), 196)
    left, top, right, bottom = draw.textbbox((0, 0), '纸', font=font)
    draw.text(((256 - right - left) / 2, (256 - bottom - top) / 2), '纸', font=font, fill='white')
    image.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / 'favicon.png')
    image.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])


if __name__ == '__main__':
    generate()
