#!/bin/bash

# Process all JPG images in the current directory
# Creates optimized web versions with -web.JPG suffix

for img in *.JPG *.jpg *.JPEG *.jpeg; do
    # Skip if no matching files (handles the case when glob doesn't match)
    [ -e "$img" ] || continue
    
    # Skip if it's already a -web version
    if [[ "$img" == *"-web."* ]]; then
        continue
    fi
    
    # Get the base name without extension
    base="${img%.*}"
    ext="${img##*.}"
    
    # Output filename
    output="${base}-web.${ext}"
    
    echo "Processing: $img -> $output"
    
    magick "$img" \
        -auto-orient \
        -resize 1000x1000\> \
        -sampling-factor 4:2:0 \
        -colorspace sRGB \
        -quality 85 \
        -interlace Plane \
        -define jpeg:dct-method=float \
        "$output"
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully created: $output"
    else
        echo "✗ Failed to process: $img"
    fi
    echo ""
done

echo "Done processing all images!"
