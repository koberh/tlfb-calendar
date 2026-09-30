"""Reproducible calendar icon; requires Pillow only when regenerating artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

size = 512
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((12, 12, 500, 500), 105, fill='#285541')
draw.rounded_rectangle((105, 118, 407, 408), 32, fill='#f6f5ef')
draw.rectangle((105, 161, 407, 201), fill='#a5b692')
for x in (172, 340):
    draw.rounded_rectangle((x-12, 82, x+12, 152), 12, fill='#f6f5ef')
for x in (157, 233, 309):
    for y in (238, 312):
        draw.rounded_rectangle((x, y, x+44, y+40), 8, fill='#a5b692')
draw.line([(280, 320), (311, 349), (365, 281)], fill='#285541', width=19)
out = Path(__file__).parent
image.save(out / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
image.save(out / 'icon.png')
