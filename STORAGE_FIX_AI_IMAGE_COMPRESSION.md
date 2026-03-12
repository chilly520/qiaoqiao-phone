# 存储空间修复：AI 生图压缩功能

## 问题描述

用户反馈存储空间一满就报错，具体表现：
- "其他配置"占用 4.62 MB（主要是 AI 生成的图片）
- 点击"压缩所有聊天图片"无效
- 点击"清理所有图片"也无效
- 空间使用率达到 100% (5.02 MB / ~5 MB)

## 根本原因

原有的压缩和清理功能**只处理聊天中的 `[图片:data:image...]` 格式**，但 AI 生成的图片还存储在以下位置：

1. **朋友圈** - `momentsStore.momentsData[].posts[].images[]`
2. **论坛帖子** - `forumStore.forumData[].posts[].image`
3. **相册照片** - `phoneData.apps.photos.photos[].url`
4. **壁纸** - `phoneData.wallpaper.url`

这些地方的图片都没有被压缩或清理，导致空间爆满。

## 解决方案

### 1. 新增"压缩所有 AI 生图"功能

在设置 > 存储空间页面新增一个紫色按钮：**"压缩所有 AI 生图 (朋友圈/论坛/相册)"**

### 2. 压缩范围

该功能会压缩以下所有 AI 生成的图片：

- ✅ **朋友圈动态的图片**（支持多张图片）
- ✅ **论坛帖子的配图**
- ✅ **查手机相册中的照片**
- ✅ **聊天中的 Base64 图片**（已有功能，现在支持 URL 格式）

### 3. 技术实现

#### 核心函数：`compressAIImages()`

```javascript
// 压缩 AI 生图（包括朋友圈、论坛、相册等）
const compressAIImages = async () => {
    // 1. 压缩朋友圈图片
    for (const charId in momentsStore.momentsData.value) {
        const posts = momentsStore.momentsData.value[charId]?.posts || []
        for (const post of posts) {
            if (post.images && Array.isArray(post.images)) {
                for (let i = 0; i < post.images.length; i++) {
                    const imgUrl = post.images[i]
                    // 只压缩 AI 生成的图片（pollinations 或 base64）
                    if (imgUrl.includes('pollinations') || imgUrl.startsWith('data:image')) {
                        const compressed = await reCompressBase64FromUrl(imgUrl, quality)
                        // 只有当压缩后更小时才替换
                        if (compressed.length < imgUrl.length) {
                            post.images[i] = compressed
                            count++
                            savedSize += (imgUrl.length - compressed.length)
                        }
                    }
                }
            }
        }
    }
    
    // 2. 压缩论坛帖子图片（同上逻辑）
    // 3. 压缩相册照片（同上逻辑）
    
    // 保存所有更改
    await momentsStore.saveMoments()
    await forumStore.saveForum()
    await chatStore.saveChats()
}
```

#### 辅助函数：`reCompressBase64FromUrl()`

```javascript
// 支持从 URL 或 Base64 压缩图片
const reCompressBase64FromUrl = async (url, quality) => {
    // 如果已经是 base64，直接压缩
    if (url.startsWith('data:image')) {
        return await reCompressBase64(url, quality)
    }
    
    // 从 URL 获取图片并转换为 base64 后压缩
    const response = await fetch(url)
    const blob = await response.blob()
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
    
    return await reCompressBase64(base64, quality)
}
```

### 4. 压缩策略

- **智能判断**：只压缩 AI 生成的图片（URL 包含 `pollinations` 或 `data:image` 前缀）
- **节省空间优先**：只有当压缩后数据更小时才替换原图
- **保留文字记录**：清理功能只替换图片为 `[图片已清理]` 占位符，不删除消息
- **可调压缩质量**：通过滑块设置压缩质量（默认 50%）

## 使用方法

1. 打开 **设置** > **存储空间**
2. 在"图片压缩设置"区域，调整压缩质量滑块（推荐 30%-50%）
3. 点击 **"压缩所有 AI 生图 (朋友圈/论坛/相册)"** 按钮
4. 等待压缩完成，查看释放的空间大小

## 预期效果

- ✅ 可以压缩所有 AI 生成的图片（不只是聊天图片）
- ✅ 大幅减少"其他配置"占用的空间（预计从 4.62 MB 降至 1-2 MB）
- ✅ 解决存储空间爆满报错的问题
- ✅ 保留所有文字记录和历史数据

## 注意事项

⚠️ **压缩不可逆**：压缩后会略微降低图片清晰度，建议先备份重要数据

⚠️ **网络依赖**：压缩 AI 图片需要先 fetch URL 图片，确保网络连接正常

⚠️ **性能影响**：大量图片压缩可能需要较长时间（10-30 秒），请耐心等待

## 后续优化建议

1. **增加"仅清理 AI 生图"按钮**：专门删除 AI 生成的图片，保留用户上传的图片
2. **增加图片预览功能**：清理前可以预览要删除的图片
3. **增加自动压缩选项**：当空间使用率超过 80% 时自动提醒压缩
4. **支持外部存储**：将 AI 图片存储到 IndexedDB 或云端，减轻 LocalStorage 压力

## 修改文件

- `src/views/Settings/StorageSettings.vue` - 新增 `compressAIImages()` 函数和 UI 按钮

## 测试建议

1. 创建多个 AI 生成的朋友圈动态和论坛帖子
2. 查看存储空间，确认"其他配置"占用较大
3. 点击"压缩所有 AI 生图"按钮
4. 验证空间使用率下降，文字记录保留

## 版本

- **修复日期**：2026-03-11
- **适用版本**：v1.3.70+
- **修复类型**：功能增强 + Bug 修复
