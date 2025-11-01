#!/bin/bash

# Script to convert all PNG and JPEG files to progressive format
# Requires ImageMagick - install with: brew install imagemagick

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Install it with: brew install imagemagick"
    exit 1
fi

png_count=0
jpg_count=0

# Find and convert all PNG files to interlaced (progressive) format
while IFS= read -r -d '' file; do
    echo "Converting PNG: $file"
    # Convert to interlaced PNG (progressive)
    # -interlace PNG creates an interlaced/progressive PNG
    if convert "$file" -interlace PNG "$file.tmp" && mv "$file.tmp" "$file"; then
        ((png_count++))
    fi
done < <(find . -name "*.png" -type f -print0)

# Find and convert all JPEG files to progressive format
while IFS= read -r -d '' file; do
    echo "Converting JPEG: $file"
    # Convert to progressive JPEG
    # -interlace JPEG creates a progressive JPEG
    if convert "$file" -interlace JPEG "$file.tmp" && mv "$file.tmp" "$file"; then
        ((jpg_count++))
    fi
done < <(find . \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.JPG" -o -name "*.JPEG" \) -type f -print0)

echo ""
echo "Done! Converted files to progressive format:"
echo "  PNG files: $png_count"
echo "  JPEG files: $jpg_count"

