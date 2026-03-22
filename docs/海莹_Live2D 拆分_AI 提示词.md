# 海莹 Live2D 拆分图 - AI 绘图提示词集合

## 使用说明
1. 将以下提示词复制到 AI 绘图工具（Stable Diffusion / Midjourney / DALL-E 3 等）
2. 每个部件单独生成
3. 建议使用 `--no text, watermark` 等参数避免文字和水印
4. 分辨率建议：1024×1024 或更高

---

## 🎨 全局基础设定（添加到每个提示词前）

### 通用正向提示词：
```
masterpiece, best quality, ultra-detailed, 8k, anime style, cel shading, soft gradient, live2d sprite, white background, isolated on white, no shadow, clean lineart, professional illustration
```

### 通用负向提示词：
```
text, watermark, signature, blur, noise, low quality, worst quality, jpeg artifacts, cropped, out of frame, ugly, deformed, extra limbs, missing fingers, bad anatomy
```

### 风格关键词（可选）：
```
ocean fairy, elf girl, gradient blue and blonde hair, heterochromia (blue and gold eyes), lolita fashion, marine elements, coral decoration, seashell accessories, pearl details, magical girl
```

---

## 📍 一、头部区域

### 1. 头顶星星光环
```prompt
golden star halo above head, main large five-pointed star in center, 8 smaller stars orbiting, sparkling stardust effect, magical glow, radial gradient, translucent light rays, fantasy atmosphere, isolated on white background, no character
```

### 2. 精灵左耳（右耳镜像生成）
```prompt
single elf ear, pointed ear shape, slightly curved outward, pink inner ear gradient, translucent edge, delicate lineart, anime style, isolated on white background, left side view
```

### 3. 左眼
```prompt
single anime eye, blue iris, gradient pupil, two white highlights (one large 15px, one small 8px), long eyelashes (8-10 upper, 5-6 lower), detailed eye contour, blue eyeshadow, isolated on white background, front view
```

### 4. 右眼
```prompt
single anime eye, golden iris, gradient pupil, two white highlights, long eyelashes, detailed eye contour, golden eyeshadow, heterochromia, isolated on white background, front view
```

### 5. 左眉毛（右眉毛镜像生成）
```prompt
single anime eyebrow, light blue color, natural arch curve, delicate hair strokes, soft gradient, isolated on white background
```

### 6. 嘴巴
```prompt
anime mouth, open smile, visible upper teeth, pink tongue, upturned corners, cheerful expression, soft lip gradient, isolated on white background, front view
```

### 7. 鼻子
```prompt
anime nose, small and delicate, light pink shadow, minimal detail, soft shading, isolated on white background, front view
```

### 8. 脸颊鳞片装饰（单片）
```prompt
single fish scale decoration, iridescent pearl finish, blue and purple gradient, golden outline, translucent quality, oval shape, 15x10px size, isolated on white background
```

### 9. 刘海
```prompt
anime bangs, center part, slightly wavy, gradient blue to blonde hair color, clear hair strands, highlight streak, soft flow, isolated on white background, front view
```

### 10. 前侧长发（左右各一束）
```prompt
single side hair strand, long wavy curl, gradient blue and blonde, ocean wave pattern, pearl and seashell ornaments embedded, clear hair grouping, silk texture, glossy finish, isolated on white background
```

### 11. 后侧长发
```prompt
long flowing back hair, super long wavy curls, dramatic blue to blonde gradient, spiral curl ends, voluminous, multiple layers, highlighted strands, fantasy style, isolated on white background
```

### 12. 海马发饰
```prompt
golden seahorse hair accessory, detailed seahorse shape, curled tail, intricate texture, metallic gold finish, 60x40px size, isolated on white background
```

### 13. 贝壳发饰（单个）
```prompt
single seashell hair ornament, pink and white pearl finish, spiral shell shape, iridescent glow, delicate ridges, 20-30px size, isolated on white background
```

---

## 👗 二、上半身区域

### 14. 白色泡泡袖衬衫
```prompt
white puff sleeve shirt, peter pan collar, golden buttons on front (5-6 buttons), voluminous puff sleeves, gathered cuffs, fabric folds, delicate pleats, lolita style, isolated on white background, front view
```

### 15. 蓝色洛丽塔外裙
```prompt
sky blue lolita outer dress, strapless design, golden embroidery patterns, pearl trim, A-line skirt, fitted bodice, elegant draping, soft fabric texture, isolated on white background, front view
```

### 16. 胸前大蝴蝶结
```prompt
large sky blue ribbon bow, double layer bow, central pearl decoration, satin finish, glossy texture, 160x100px size, isolated on white background
```

### 17. 袖口蕾丝花边（单个）
```prompt
white lace cuff trim, wavy edge, intricate openwork pattern, translucent quality, delicate floral design, 80x50px size, isolated on white background
```

### 18. 裙身蕾丝荷叶边（单层）
```prompt
cream colored lace ruffle, layered frill, golden trim,荷叶边 pleats, delicate pattern, soft fabric, 80-100px height, isolated on white background
```

### 19. 珊瑚装饰（单个）
```prompt
pink coral decoration, natural branching pattern, three-dimensional, organic shape, orange to pink gradient, 30-50px size, isolated on white background
```

---

## 👖 三、下半身区域

### 20. 蓝色灯笼裤
```prompt
sky blue bloomer pants, puffy lantern style, gathered leg openings, lace trim, soft fabric folds, voluminous silhouette, isolated on white background, front view
```

### 21. 左腿丝袜
```prompt
left leg sheer stocking, transparent silk texture, golden leaf pattern, bubble decoration motifs, leg curve visible, delicate embroidery, isolated on white background, side view
```

### 22. 右腿丝袜
```prompt
right leg sheer stocking, transparent silk texture, golden leaf pattern (different from left), bubble motifs, leg curve, isolated on white background, side view
```

### 23. 脚踝珊瑚装饰（单个）
```prompt
ankle coral ornament, coral branch wrapping around ankle, pink gradient, organic shape, delicate details, 40x30px size, isolated on white background
```

### 24. 左脚玛丽珍鞋
```prompt
left foot sky blue mary jane shoes, patent leather finish, single strap with pearl button, round toe, low heel 3cm, glossy surface, isolated on white background, side view
```

### 25. 右脚玛丽珍鞋
```prompt
right foot sky blue mary jane shoes, mirror of left shoe, patent leather, strap and pearl detail, low heel, isolated on white background, side view
```

### 26. 裙尾拖尾纱
```prompt
long trailing overskirt, white translucent tulle, high-low hemline (short front, long back), golden embroidery patterns, lace edge, flowing layers, ethereal fabric, isolated on white background, back view
```

---

## ✨ 四、配饰区域

### 27. 魔法星杖 - 星头部分
```prompt
magical star wand top, five-pointed star shape, golden frame, transparent crystal interior, sparkling starlight effect inside, light blue aura, glowing edges, fantasy magic item, isolated on white background
```

### 28. 魔法星杖 - 杖身部分
```prompt
magical wand shaft, golden metal texture, intricate engraved patterns, gradient highlights, tapered bottom, elegant design, 250px length, isolated on white background
```

### 29. 魔法星杖 - 蝴蝶结装饰
```prompt
small sky blue ribbon bow on wand, satin finish, central pearl decoration, delicate folds, 160x50px size, isolated on white background
```

---

## 🎯 进阶提示词技巧

### 质量增强词（推荐添加）：
```
(masterpiece:1.3), (best quality:1.3), (ultra-detailed:1.2), (8k:1.2), professional, award-winning illustration
```

### 风格强化词：
```
by makoto shinkai, by wlop, by greg rutkowski, anime key visual, light novel illustration, fantasy art
```

### 渲染方式：
```
cel shading, soft airbrush, gradient mapping, subsurface scattering, volumetric lighting
```

### 构图控制（Stable Diffusion）：
```
centered composition, full body shot, character sheet, reference sheet, turnaround
```

---

## 🔧 不同 AI 工具推荐参数

### Stable Diffusion WebUI:
```
Steps: 30-40
Sampler: DPM++ 2M Karras
CFG scale: 7-9
Size: 1024x1024 or 512x768
Highres. fix: enabled
Denoising strength: 0.3-0.5
```

### Midjourney:
```
--ar 1:1 --v 5.2 --q 2 --style raw --no text watermark
```

### DALL-E 3:
```
使用详细模式，设置高质量渲染
```

---

## 💡 使用建议

1. **批量生成**: 将同一区域的部件提示词组合，一次性生成多个变体
2. **分层生成**: 先生成基础部件，再用 img2img 添加细节
3. **一致性控制**: 使用相同的 seed 值保持风格统一
4. **后期处理**: 用 Photoshop 去除背景，提取透明 PNG
5. **镜像对称**: 左右对称部件生成一个后镜像复制

---

## 📋 检查清单

生成后检查：
- [ ] 背景纯白无杂色
- [ ] 无文字水印
- [ ] 部件完整无缺失
- [ ] 比例准确
- [ ] 细节清晰
- [ ] 色彩符合设定
- [ ] 线条流畅
- [ ] 可用作 Live2D 拆分

---

**提示词版本**: v1.0  
**角色**: 海莹  
**用途**: Live2D 拆分图生成  
**更新日期**: 2026-03-23
