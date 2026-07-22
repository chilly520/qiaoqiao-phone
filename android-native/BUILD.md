# Chilly Phone 原生 Android APP

真正的 Android 原生应用 — 解决 vivo/华为/小米 WebView 后台冻结 JS, 角色无法在后台主动发消息的问题。

## 相比 PWA 的优势

| 能力 | PWA / TWA | 这个原生 APP |
|---|---|---|
| 后台 JS 冻结 | ❌ 浏览器内核冻结 | ✅ 前台服务保活 |
| 后台真正通知 | ❌ | ✅ NotificationCompat |
| 锁屏发消息 | ❌ | ✅ |
| 开机自启 | ❌ | ✅ |
| 电池白名单 | ❌ | ✅ |

## 架构

```
MainActivity (WebView 加载 PWA) ← 用户看到的界面
       ↓
ProactiveMessageService (前台服务) ← 角色主动发消息核心
       ↓
LlmClient → 调云端 LLM (OpenAI 兼容, 支持 DeepSeek/自建中转)
       ↓
Notifier → 创建真系统通知
```

## 在 Android Studio 打开

1. 安装 Android Studio (推荐 Hedgehog 或更新)
2. File → Open → 选 `android-native/` 目录
3. 等待 Gradle sync 完成
4. 连接手机, 点 ▶️ Run

## 本地构建 APK

```bash
cd android-native
./gradlew assembleRelease
# 输出: app/build/outputs/apk/release/app-release.apk
```

## 配置角色主动发消息

1. 打开 APP
2. 在 PWA 设置页填好 LLM API Key (或用 JS Bridge 直接调 `ChillyNative.setLlmConfig(...)`)
3. 开启"角色主动消息"开关
4. 设置间隔 (默认 30 分钟) 和静默时段 (默认 23:00-07:00)
5. 锁屏, 等待通知

## 申请权限 (必须, 否则后台被杀)

第一次打开 APP 时会弹窗, 请允许:
- ✅ 通知权限
- ✅ 电池优化白名单

还需要手动:
- vivo/iQOO: 设置 → 电池 → 后台高耗电 → 允许 Chilly Phone
- 华为/荣耀: 设置 → 电池 → 启动管理 → 改为"手动管理" + 全开
- 小米/红米: 设置 → 应用设置 → 自启动 → 允许
- OPPO/一加: 设置 → 电池 → 更多设置 → 关闭"睡眠待机优化"

## 固定签名 (重要)

第一次构建用临时密钥 (每次 build 都不同, **不能覆盖安装**)。

要启用固定签名:
1. 本地用 `keytool -genkeypair -keystore android.keystore -alias android ...` 生成
2. 把 keystore base64 编码: `base64 android.keystore > keystore.b64`
3. 在 GitHub repo → Settings → Secrets, 添加:
   - `CHILLY_KEYSTORE_BASE64` = keystore.b64 内容
   - `CHILLY_KEYSTORE_PASSWORD` = 你设的密码
   - `CHILLY_KEY_ALIAS` = `android`
   - `CHILLY_KEY_PASSWORD` = 你设的密码
4. 下次构建就自动用这个密钥, 以后能直接覆盖装

## 与 PWA 关系

- PWA 继续在 Cloudflare Pages 上跑
- 原生 APP 用 WebView 加载 PWA (`https://qiaqiao-phone.pages.dev`)
- 用户数据仍由 PWA 自己的 IndexedDB/localStorage 管理
- 原生只负责"后台主动发消息"这一件事

## 文件结构

```
android-native/
├── app/                 # 主模块
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/dev/qiaoqiao/phone/
│       │   ├── ChillyApp.kt              # Application
│       │   ├── MainActivity.kt           # WebView 入口
│       │   ├── ProactiveMessageService.kt# 前台服务 (核心)
│       │   ├── ProactiveAlarmReceiver.kt # Alarm 接收器
│       │   ├── BootReceiver.kt           # 开机自启
│       │   ├── llm/                      # LLM 调用
│       │   ├── notif/                    # 通知
│       │   ├── prefs/                    # SharedPreferences
│       │   ├── bridge/                   # JS Bridge
│       │   └── work/                     # WorkManager 兜底
│       └── res/                          # 资源
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── README.md
└── .github/workflows/build-apk.yml
```
