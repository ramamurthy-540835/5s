"""Convert an approved industrial photograph into PNG solely for XLSX embedding."""
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    # Core Pillow formats continue to work. HEIF returns a precise conversion error.
    pass


def main():
    source, destination = map(Path, sys.argv[1:3])
    try:
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            image.save(destination, format="PNG", optimize=True)
    except Exception as error:
        raise SystemExit(f"Image conversion for XLSX failed: {error}")


if __name__ == "__main__":
    main()
