# 豆包/火山引擎语音 ID 参考指南

## 1. 官方标准发音人 (Standard Voices)

这些语音可以免费/付费直接通过 HTTP 接口调用，通常不需要复杂的 Cookie（只要有 API Key，或者像插件那样使用公共接口）。

**官方发音人列表文档：**
- [火山引擎语音合成 - 音色列表](https://www.volcengine.com/docs/6561/97465)

你可以在这个文档中找到各种类型的发音人 ID，例如：
- **通用场景**：`zh_male_m191_uranus_bigtts` (云周)
- **多情感**：`zh_male_lengkugege_emo_v2_mars_bigtts` (冷酷哥哥 - 多情感版)
- **方言**：`zh_female_sichuan` (四川话)

**如何使用：**
找到 ID 后，直接添加到 `VoiceSettings.vue` 的 `offline` 列表中即可：
```javascript
{ name: "新发音人名字", id: "这里填ID" }
```

## 2. 豆包克隆/自定义发音人 (Custom/Cloned Voices)

这些是你自己在豆包网页版 (doubao.com) 上创建或克隆的声音。它们的 ID 通常比较特殊（例如以 `ICL_` 开头），并且**必须**配合你的账号 Cookie 才能使用。

**获取方法：**
1. 登录 [豆包网页版](https://www.doubao.com/chat)。
2. 进入语音设置或创建新的克隆声音。
3. 打开浏览器开发者工具 (F12) -> Network (网络)。
4. 试听该声音。
5. 在网络请求中找到相关的 API 调用（通常是 WebSocket 或 `tts` 接口），查看到 `voice_id` 或 `speaker` 参数。

**注意：**
- 这类声音**不能**通过标准的 HTTP 接口调用（会报 400 错误）。
- 所以在本项目中，我为你写了专门的 WebSocket 代理逻辑来支持它们（必须填写 Cookie）。

## 3. 来源说明
你代码中目前的“离线列表”是来自于你项目根目录下的 `tts_豆包插件.json` 文件。这是一个开源社区整理的常用发音人列表。
