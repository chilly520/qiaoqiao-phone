# Chilly Phone 原生 Android APP — 技术决策

> 创建时间：2026-07-22
> 目的：把现有的 PWA (qiaqiao-phone.pages.dev) 打包成真正的 Android 原生 APP
> 用户痛点：vivo/华为/小米的 WebView/X5 内核会冻结后台 JS, 导致 PWA 在后台时角色无法主动发消息

## 1. 总体架构

```
┌──────────────────────────────────────────┐
│ Chilly Phone 原生 APP (Kotlin)            │
│ ┌──────────────────────────────────────┐ │
│ │ MainActivity (打开 = 加载 WebView)     │ │
│ │   ↓                                   │ │
│ │ WebView ← 加载 PWA 页面               │ │
│ │   ↓ 桥接                              │ │
│ │ JSBridge (原生 ↔ WebView)             │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ProactiveMessageService (前台服务)     │ │  ← 即使 APP 在后台/锁屏也常驻
│ │  - 定时调度 (WorkManager 兜底)         │ │
│ │  - 拉取角色配置 (从 SharedPrefs)       │ │
│ │  - 调用云端 LLM 生成消息               │ │
│ │  - 创建真通知 (NotificationCompat)     │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ BootReceiver (开机自启)                │ │
│ │  - 启动 ProactiveMessageService        │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

## 2. 技术栈

| 组件 | 选型 | 理由 |
|---|---|---|
| 语言 | Kotlin | Google 官方推荐 |
| UI | WebView (包 PWA) | 复用现有 Vue 代码, 不重写 |
| 后台服务 | Foreground Service + WorkManager | vivo 上唯一靠谱的后台保活方式 |
| HTTP | OkHttp 4.12 | 老牌稳定, 文件小 |
| JSON | kotlinx.serialization | 跟 Kotlin 集成好 |
| 通知 | NotificationCompat | 标准 API, 兼容 Android 8+ |
| 编译 | Gradle 8.5 + AGP 8.2 | 当前主流稳定版 |
| minSdk | 24 (Android 7.0) | 覆盖 99% 国内用户 |
| targetSdk | 34 (Android 14) | Play Store 要求 |
| 包名 | `dev.qiaoqiao.phone` | 跟 TWA 一致, 用户数据不丢 |

## 3. 与 PWA 关系

- **PWA 不动**, 继续走 Cloudflare Pages 部署
- 原生 APP 用 WebView 加载 `https://qiaqiao-phone.pages.dev`
- 数据仍由 PWA 自己管 (IndexedDB / localStorage), 原生不参与
- **唯一要做的**: 引导用户首次启动时把 PWA 的数据 (通过 GitHub Backup) 同步到云, 然后原生 WebView 加载同样的 PWA 就能看到全部数据

## 4. 后台角色主动发消息的实现

1. 用户在原生 APP 设置页配置: API Key / Base URL / Model / 启用开关
2. 同样的配置也保存到 PWA 那边 (通过 JS Bridge 同步)
3. `ProactiveMessageService` (前台服务) 每 60s 检查一次
4. 到时间 → 调云端 LLM (OpenAI 兼容协议) → 拿消息文本
5. 用 `NotificationCompat` 创建通知, 头像/角色名/消息预览
6. 用户点通知 → 打开 MainActivity → WebView 加载 → 在聊天列表显示这条消息

## 5. 通知样式 (用户选 1B: 仿微信式)

- 折叠通知: 显示 "你有一条新消息" 
- 展开后: 角色头像 (圆角) + 角色名 + 消息预览 + 时间
- 点击通知: 打开 APP, 跳到对应聊天
- 通知分类: `CATEGORY_MESSAGE`
- 优先级: `PRIORITY_HIGH` (锁屏显示)
- 渠道: "角色消息" (用户在系统设置可改声音/震动)

## 6. 关键文件清单 (待写)

```
android-native/
├── settings.gradle.kts
├── build.gradle.kts                    # 根
├── gradle.properties
├── gradle/wrapper/...
├── .github/workflows/build-apk.yml     # 自动构建
├── README.md                            # 怎么在 Android Studio 打开
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── assets/index.html            # 占位, 实际加载远程 PWA
        ├── res/values/
        │   ├── strings.xml
        │   ├── colors.xml
        │   └── themes.xml
        ├── res/drawable/
        │   └── ic_notification.xml      # 通知小图标
        ├── res/mipmap-*/ic_launcher.png  # 启动图
        ├── res/xml/
        │   ├── network_security_config.xml
        │   └── data_extraction_rules.xml
        └── java/dev/qiaoqiao/phone/
            ├── MainActivity.kt           # WebView 入口
            ├── ProactiveMessageService.kt # 前台服务
            ├── BootReceiver.kt           # 开机启动
            ├── llm/
            │   ├── LlmClient.kt         # OkHttp 调 OpenAI 兼容 API
            │   └── MessageGenerator.kt  # 提示词 + 消息生成
            ├── notif/
            │   └── Notifier.kt          # 通知封装
            ├── prefs/
            │   └── AppPrefs.kt          # SharedPreferences 包装
            ├── bridge/
            │   └── WebAppInterface.kt   # JS Bridge
            └── work/
                └── ProactiveWorker.kt   # WorkManager 兜底
```

## 7. 权限

```xml
INTERNET                              - 联网
POST_NOTIFICATIONS                    - Android 13+ 通知
FOREGROUND_SERVICE                    - 前台服务
FOREGROUND_SERVICE_SPECIAL_USE        - 角色消息是 "特殊用途"
WAKE_LOCK                             - 防止 CPU 休眠
RECEIVE_BOOT_COMPLETED                - 开机自启
REQUEST_IGNORE_BATTERY_OPTIMIZATIONS  - 引导用户加白名单
SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM- 精确定时
```

## 8. 构建分发

- GitHub Actions 自动构建 release APK
- 固定签名密钥 (放 GitHub Secrets, 不每次生成新的)
- 发到 GitHub Releases, 用户下载安装
- 不上 Google Play (个人项目, 省 25 刀注册费)

## 9. 与现有 TWA (android-app/) 关系

- `android-app/` (TWA 那个) 暂时保留不删, 但不再用
- 原生项目在 `android-native/`
- 两个都构建时互不干扰
- 以后如果原生方案跑通, 可以删 `android-app/`
