# Chilly Phone Push Server (Cloudflare Worker)

> 免费额度: 100,000 请求/天,远超推送用量。VAPID 密钥一次生成,无持续费用。

## ⚡ 一键部署(推荐)

### Windows (PowerShell)
```powershell
cd worker
.\deploy.ps1
```

### macOS / Linux
```bash
cd worker
chmod +x deploy.sh
./deploy.sh
```

脚本会自动:
1. 安装 npm 依赖
2. 引导 Cloudflare 登录(浏览器授权一次)
3. 创建两个 KV 命名空间
4. 把 KV id 写入 `wrangler.toml`
5. 生成 VAPID 密钥 + 写入 Cloudflare Secrets
6. 部署 Worker
7. 打印最终 URL,直接复制到前端 `.env.production`

---

## 手动部署步骤(如果脚本出问题)

### 1. 安装依赖
```bash
cd worker
npm install
```

### 2. 创建 KV 命名空间
```bash
npx wrangler kv:namespace create SUBSCRIPTIONS
npx wrangler kv:namespace create SCHEDULED
```
把返回的 `id` 填到 `wrangler.toml` 里的 `REPLACE_WITH_ACTUAL_ID` 位置。

### 3. 生成 VAPID 密钥
```bash
npx web-push generate-vapid-keys
```
会输出 `Public Key` 和 `Private Key`。

### 4. 写入密钥到 Cloudflare Secrets
```bash
npx wrangler secret put VAPID_PUBLIC_KEY       # 填公钥
npx wrangler secret put VAPID_PRIVATE_KEY      # 填私钥
npx wrangler secret put VAPID_SUBJECT          # 填 mailto:your@email.com
```

### 5. 部署
```bash
npx wrangler deploy
```
部署成功后会得到一个 URL,例如 `https://chilly-phone-push.your-account.workers.dev`

### 6. 前端配置
把这个 URL 填到前端 `VITE_PUSH_SERVER_URL` 环境变量(详见前端 pushService.js)。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/vapid-public-key` | 前端订阅时拉公钥 |
| POST | `/subscribe` | 存储 push 订阅 `{ subscription, userId, deviceName }` |
| POST | `/unsubscribe` | 移除订阅 `{ endpoint }` |
| POST | `/schedule` | 排程推送 `{ fireTime, title, body, tag, data, url }` |
| POST | `/trigger` | 立即广播 `{ title, body, tag, data, url }` |
| GET | `/health` | 健康检查 + 当前订阅数 |

## Cron 行为

Worker 的 `[triggers] crons = ["* * * * *"]` 表示每分钟跑一次,扫描 `SCHEDULED` KV 里 `fireTime <= now` 的条目,广播后删除。

## 测试

```bash
# 健康检查
curl https://your-worker.workers.dev/health

# 立即推送一条测试
curl -X POST https://your-worker.workers.dev/trigger \
  -H "Content-Type: application/json" \
  -d '{"title":"测试","body":"来自 Chilly Phone","tag":"test","url":"/wechat"}'
```
