#!/usr/bin/env bash
# Chilly Phone Push Server 一键部署脚本
# 用法: ./deploy.sh

set -e
cd "$(dirname "$0")"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Chilly Phone Push Server 一键部署${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ---------- 1. 安装依赖 ----------
echo -e "${YELLOW}[1/6] 安装依赖...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GRAY}  跳过 (node_modules 已存在)${NC}"
fi

# ---------- 2. 登录 Cloudflare ----------
echo ""
echo -e "${YELLOW}[2/6] 检查 Cloudflare 登录状态...${NC}"
if npx wrangler whoami >/dev/null 2>&1; then
    echo -e "${GREEN}  已登录${NC}"
else
    echo -e "${YELLOW}  未登录,即将打开浏览器授权...${NC}"
    npx wrangler login
fi

# ---------- 3. 创建 KV 命名空间 ----------
echo ""
echo -e "${YELLOW}[3/6] 创建 KV 命名空间...${NC}"

get_or_create_kv() {
    local name=$1
    local existing=$(npx wrangler kv:namespace list 2>/dev/null | grep -B1 "\"title\": \"$name\"" | grep '"id"' | head -1 | grep -oP '"id"\s*:\s*"\K[^"]+')
    if [ -n "$existing" ]; then
        echo -e "${GREEN}  复用已存在的 $name : $existing${NC}" >&2
        echo "$existing"
    else
        echo -e "${YELLOW}  创建 $name ...${NC}" >&2
        local out=$(npx wrangler kv:namespace create "$name" 2>&1)
        local id=$(echo "$out" | grep -oP 'id\s*=\s*"\K[^"]+')
        if [ -z "$id" ]; then
            echo "无法从 wrangler 输出解析 id: $out" >&2
            exit 1
        fi
        echo "$id"
    fi
}

subId=$(get_or_create_kv "SUBSCRIPTIONS")
schId=$(get_or_create_kv "SCHEDULED")

# ---------- 4. 更新 wrangler.toml ----------
echo ""
echo -e "${YELLOW}[4/6] 更新 wrangler.toml...${NC}"

# 用 awk/sed 替换 SUBSCRIPTIONS 段内的占位符
python3 -c "
import re
with open('wrangler.toml', 'r') as f:
    content = f.read()

# 替换 SUBSCRIPTIONS 段
content = re.sub(
    r'(binding\s*=\s*\"SUBSCRIPTIONS\"[\s\S]*?id\s*=\s*\")REPLACE_WITH_ACTUAL_ID(\")',
    r'\g<1>$subId\g<2>', content, count=1
)
content = re.sub(
    r'(binding\s*=\s*\"SUBSCRIPTIONS\"[\s\S]*?preview_id\s*=\s*\")REPLACE_WITH_PREVIEW_ID(\")',
    r'\g<1>$subId\g<2>', content, count=1
)
# 替换 SCHEDULED 段
content = re.sub(
    r'(binding\s*=\s*\"SCHEDULED\"[\s\S]*?id\s*=\s*\")REPLACE_WITH_ACTUAL_ID(\")',
    r'\g<1>$schId\g<2>', content, count=1
)
content = re.sub(
    r'(binding\s*=\s*\"SCHEDULED\"[\s\S]*?preview_id\s*=\s*\")REPLACE_WITH_PREVIEW_ID(\")',
    r'\g<1>$schId\g<2>', content, count=1
)

with open('wrangler.toml', 'w') as f:
    f.write(content)
print('  ✓ wrangler.toml 已更新')
"

# ---------- 5. 生成 VAPID 密钥 ----------
echo ""
echo -e "${YELLOW}[5/6] 生成 VAPID 密钥...${NC}"

vapidOut=$(npx web-push generate-vapid-keys 2>&1)
publicKey=$(echo "$vapidOut" | grep -oP 'Public Key:\s*\K\S+')
privateKey=$(echo "$vapidOut" | grep -oP 'Private Key:\s*\K\S+')

if [ -z "$publicKey" ] || [ -z "$privateKey" ]; then
    echo "无法从 web-push 输出解析密钥: $vapidOut" >&2
    exit 1
fi

echo -e "${GRAY}  公钥: $publicKey${NC}"
echo -e "${GRAY}  私钥: ${privateKey:0:10}...${NC}"

echo -e "${YELLOW}  写入 VAPID_PUBLIC_KEY...${NC}"
echo "$publicKey" | npx wrangler secret put VAPID_PUBLIC_KEY

echo -e "${YELLOW}  写入 VAPID_PRIVATE_KEY...${NC}"
echo "$privateKey" | npx wrangler secret put VAPID_PRIVATE_KEY

echo -e "${YELLOW}  写入 VAPID_SUBJECT...${NC}"
echo "mailto:admin@chilly-phone.local" | npx wrangler secret put VAPID_SUBJECT

# ---------- 6. 部署 ----------
echo ""
echo -e "${YELLOW}[6/6] 部署到 Cloudflare Workers...${NC}"
deployOut=$(npx wrangler deploy 2>&1)
echo "$deployOut"

workerUrl=$(echo "$deployOut" | grep -oP 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' | head -1)

if [ -n "$workerUrl" ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ 部署成功!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}Worker URL: $workerUrl${NC}"
    echo ""
    echo -e "${YELLOW}下一步:${NC}"
    echo -e "${GRAY}  1. 测试健康检查:${NC}"
    echo -e "${GRAY}     curl $workerUrl/health${NC}"
    echo -e "${GRAY}  2. 在前端项目根目录创建 .env.production:${NC}"
    echo -e "${CYAN}     VITE_PUSH_SERVER_URL=$workerUrl${NC}"
    echo -e "${GRAY}  3. 重新构建前端:${NC}"
    echo -e "${GRAY}     npm run build${NC}"
    echo -e "${GRAY}  4. 打开 Chilly Phone → 设置 → 后局通知 → 开启${NC}"
    echo ""
else
    echo ""
    echo -e "${YELLOW}部署完成,但未匹配到 Worker URL,请手动检查上面的输出${NC}"
fi
