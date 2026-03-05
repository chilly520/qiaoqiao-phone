# 天气 API 说明

## 当前使用的 API
1. **Open-Meteo** - 完全免费的天气 API
2. **WAQI** - 世界空气质量指数项目（免费）

## 特点
- ✅ **完全免费** - 无需注册、无需 API Key
- ✅ 无使用限制 - 个人项目随便用
- ✅ 全球覆盖 - 支持任意城市
- ✅ 数据可靠 - 基于多个气象模型
- ✅ **包含 AQI** - 实时空气质量指数

## 数据来源
- **天气数据**：Open-Meteo（气象站和卫星数据）
- **AQI 数据**：WAQI（世界空气质量指数项目）
- 使用 WMO 天气代码标准

## 已实现的功能
- 实时温度显示
- 天气现象（晴、多云、雨、雪、雷阵雨等）
- 自动匹配天气图标
- 支持中文城市名查询
- **实时 AQI 空气质量指数**

## 支持的天气类型
| 代码 | 天气 | 图标 |
|------|------|------|
| 0 | 晴 | ☀️ fa-sun |
| 1-2 | 多云 | ☁️ fa-cloud |
| 3 | 阴 | ☁️ fa-cloud |
| 45-48 | 雾 | 🌫️ fa-smog |
| 51-65 | 雨 | 🌧️ fa-cloud-rain |
| 80-82 | 阵雨 | 🌧️ fa-cloud-rain |
| 95-99 | 雷雨 | ⚡ fa-bolt |

## API 文档
- **Open-Meteo**：
  - 官网：https://open-meteo.com/
  - 文档：https://open-meteo.com/en/docs
- **WAQI（空气质量）**：
  - 官网：https://aqicn.org/
  - API 文档：https://aqicn.org/api/
- GitHub: https://github.com/open-meteo/open-meteo

## 注意事项
- 不需要配置任何东西，开箱即用
- 如果显示 "--°" 或 "离线"，说明网络请求失败
- 支持缓存，不会频繁请求
- **AQI 数据**：使用 WAQI token，覆盖全球主要城市
