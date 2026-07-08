// v1.10.96: build 时把 functions/ 复制到 dist/functions/
// 原因: wrangler pages deploy dist 只会上传 dist/ 目录,
//   Cloudflare Pages Functions 必须在 dist/functions/ 里才能被识别
//   之前 functions/ 在项目根,根本没被部署 → 线上 /v2/music/* 全走 SPA fallback
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('functions')
const DEST = path.resolve('dist/functions')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`[copy-functions] ${src} not found, skip`)
    return
  }
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d)
    }
  }
  console.log(`[copy-functions] copied ${src} -> ${dest}`)
}

copyDir(SRC, DEST)
console.log('[copy-functions] done')
