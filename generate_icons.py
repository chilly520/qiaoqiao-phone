from PIL import Image
import os

source_path = "e:/乔篱/小手机/qiaqiao-phone/public/icon-source.jpg"
output_dir = "e:/乔篱/小手机/qiaqiao-phone/public"

try:
    img = Image.open(source_path)
    
    # 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save(os.path.join(output_dir, "pwa-192x192.png"))
    
    # 512x512
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(os.path.join(output_dir, "pwa-512x512.png"))
    
    # Apple Touch Icon (180x180)
    img_apple = img.resize((180, 180), Image.Resampling.LANCZOS)
    img_apple.save(os.path.join(output_dir, "apple-touch-icon.png"))

    # Favicon (64x64)
    img_fav = img.resize((64, 64), Image.Resampling.LANCZOS)
    img_fav.save(os.path.join(output_dir, "favicon.ico"))

    print("Icons generated successfully.")
except Exception as e:
    print(f"Error generating icons: {e}")
