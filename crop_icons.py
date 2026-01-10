from PIL import Image, ImageOps
import os

image_path = "C:/Users/22605/.gemini/antigravity/brain/7cf1a146-354c-4c50-a8a7-2c751d42b3c5/uploaded_image_1767979551969.png"
output_dir = "e:/乔篱/小手机/qiaqiao-phone/public/icons"

os.makedirs(output_dir, exist_ok=True)

try:
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    col_width = width // 3
    row_height = height // 3

    icons = [
        ("wechat.png", 0, 0),
        ("search.png", 0, 1),
        ("weibo.png", 0, 2),
        ("settings.png", 1, 0),
        ("worldbook.png", 1, 1),
        ("reset.png", 1, 2),
        ("syslog.png", 2, 0),
        ("couple.png", 2, 1),
        ("games.png", 2, 2)
    ]
    
    for filename, r, c in icons:
        left = c * col_width
        top = r * row_height
        right = left + col_width
        bottom = top + row_height
        
        # 1. Extract Cell
        cell = img.crop((left, top, right, bottom))
        
        # 2. Cut off bottom 30% to remove text ("微信", etc.)
        cw, ch = cell.size
        # The icon is usually in top 2/3. Text is at bottom.
        # Let's keep top 75% to be safe, assuming text is in bottom 25%.
        # Actually user said "misaligned", maybe text is higher or icon is huge.
        # Let's inspect the bounding box of non-white pixels in the top 80%.
        cell_no_text = cell.crop((0, 0, cw, int(ch * 0.75)))
        
        # 3. Find bounding box of the CONTENT (non-white)
        # Create a mask: convert to grayscale, invert. Background is white, so it becomes black.
        # Ensure we treat white as transparent/background.
        # Or just look for difference from white (255, 255, 255).
        
        # Simple method: getbbox() normally works on alpha or black background.
        # We need to make white transparent or check min/max.
        
        # Create a copy to find bbox
        temp = Image.new("RGB", cell_no_text.size, (255, 255, 255))
        temp.paste(cell_no_text, mask=cell_no_text.split()[3]) # paste using alpha if exists
        
        # Convert to grayscale and invert so white becomes black (0) and content is bright
        gray = temp.convert("L")
        inverted = ImageOps.invert(gray)
        
        # Threshold to clean up noise (optional, but good for "white" backgrounds that aren't pure 255)
        # applied threshold: pixels < 10 become 0
        bbox = inverted.getbbox()
        
        if bbox:
            # Crop to the icon
            icon_content = cell_no_text.crop(bbox)
            
            # 4. Square it up
            # Create a square new image with white background (or transparent? User wanted "cut out").
            # User said "cut down and put in". The UI has glass containers.
            # If the source icon has a blue/white background (rounded rect), we want to keep that rounded rect.
            # Bbox should have captured the rounded rect edges.
            
            iw, ih = icon_content.size
            size = max(iw, ih)
            
            # Add a little padding?
            # padding = int(size * 0.05)
            # new_size = size + padding * 2
            
            final_img = Image.new("RGBA", (size, size), (0, 0, 0, 0)) # Transparent background
            # Center the icon
            paste_x = (size - iw) // 2
            paste_y = (size - ih) // 2
            
            final_img.paste(icon_content, (paste_x, paste_y))
            
            # Save
            save_path = os.path.join(output_dir, filename)
            final_img.save(save_path)
            print(f"Saved refined {filename}")
        else:
            print(f"Warning: Empty cell for {filename}")

except Exception as e:
    print(f"Error: {e}")
