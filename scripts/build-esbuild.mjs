// 自定义 esbuild 构建脚本, 绕过 Vite/Rollup 的栈溢出问题
// 用法: node scripts/build-esbuild.mjs
import { build } from 'esbuild'
import vuePlugin from 'esbuild-plugin-vue3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// v1.10.218: 用 PostCSS + Tailwind 处理 CSS, 因为 esbuild 不识别 Tailwind 任意值
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const publicDir = path.join(root, 'public')

console.log('[build-esbuild] starting...')
console.log('[build-esbuild] root:', root)

// 准备 dist 目录
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true })
}
fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true })
fs.mkdirSync(path.join(distDir, 'functions'), { recursive: true })

// 复制 public 文件
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
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
}

console.log('[build-esbuild] copying public assets...')
copyDir(publicDir, distDir)
console.log('[build-esbuild] copying functions...')
copyDir(path.join(root, 'functions'), path.join(distDir, 'functions'))

// 处理 index.html
console.log('[build-esbuild] processing index.html...')
let indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8')

// 自定义 Vue 插件: 在 esbuild-plugin-vue3 之前预处理 .vue 文件, 替换 @/ 别名
const aliasPlugin = {
  name: 'alias-resolver',
  setup(build) {
    // v1.10.218: 把 main.js 里的 .css import 全部替换为空模块
    // 之前 esbuild 会把 .css 内容作为 side-effect 注入 main.js, 但不会跑 Tailwind JIT
    // 改为: main.js 不带 CSS, 单独跑 PostCSS + Tailwind 输出到 dist/assets/main.css
    build.onResolve({ filter: /\.css$/ }, (args) => {
      return { path: args.path, namespace: 'css-stub' }
    })
    build.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => {
      return { contents: '// CSS handled by PostCSS pipeline', loader: 'js' }
    })

    // @ 别名解析 + 自动加扩展名
    build.onResolve({ filter: /@\// }, (args) => {
      const relPath = args.path.replace(/^@\//, '')
      const base = path.join(root, 'src', relPath)
      if (/\.[a-zA-Z0-9]+$/.test(relPath)) {
        return { path: base }
      }
      const js = base + '.js'
      try { if (fs.statSync(js).isFile()) return { path: js } } catch {}
      const vue = base + '.vue'
      try { if (fs.statSync(vue).isFile()) return { path: vue } } catch {}
      const indexJs = path.join(base, 'index.js')
      try { if (fs.statSync(indexJs).isFile()) return { path: indexJs } } catch {}
      return { path: base }
    })

    // 根相对路径 /xxx (CSS 里的 url('/wallpaper.jpg') 等) 解析到 public/ 目录
    build.onResolve({ filter: /^\// }, (args) => {
      // 跳过 Node.js 内置模块
      if (args.path.startsWith('//')) return null
      const target = path.join(root, 'public', args.path)
      try {
        if (fs.statSync(target).isFile()) return { path: target }
      } catch {}
      return null
    })

    // 相对路径自动加扩展名 (Vite 默认行为): 只处理没有扩展名的路径
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      // 跳过已有扩展名的
      if (/\.[a-zA-Z0-9]+$/.test(args.path)) return null

      const baseDir = path.dirname(args.resolveDir)
      const target = path.resolve(baseDir, args.path)
      // 尝试 .js
      const js = target + '.js'
      try {
        if (fs.statSync(js).isFile()) return { path: js }
      } catch {}
      // 尝试 /index.js
      const indexJs = path.join(target, 'index.js')
      try {
        if (fs.statSync(indexJs).isFile()) return { path: indexJs }
      } catch {}
      // 尝试 .vue
      const vue = target + '.vue'
      try {
        if (fs.statSync(vue).isFile()) return { path: vue }
      } catch {}
      // 尝试 .mjs
      const mjs = target + '.mjs'
      try {
        if (fs.statSync(mjs).isFile()) return { path: mjs }
      } catch {}
      return null
    })
  }
}

// esbuild 配置
try {
  console.log('[build-esbuild] bundling with esbuild...')

  // v1.10.218: 用 PostCSS + Tailwind 处理 src/style.css -> dist/assets/main.css
  // esbuild 不会跑 Tailwind JIT, 所以 w-[50px] / text-[32px] 这些任意值类不会被生成
  // 之前构建出来的 main.css 没有这些类, 桌面图标(FontAwesome fallback)显示不出来
  console.log('[build-esbuild] processing CSS with PostCSS + Tailwind...')
  const styleCssPath = path.join(root, 'src/style.css')
  const themesCssPath = path.join(root, 'src/assets/themes.css')
  // FontAwesome css 在 node_modules 里, 找到 all.css
  const faCssPath = path.join(root, 'node_modules/@fortawesome/fontawesome-free/css/all.css')
  const styleCss = fs.readFileSync(styleCssPath, 'utf8')
  // Tailwind 3: tailwindcss(config) 是 PostCSS 插件
  // 必须传 config path, 否则 tailwind 找不到 content 字段
  const tailwindPlugin = tailwindcss(path.join(root, 'tailwind.config.js'))
  // postcss-import 展开 @import "tailwindcss/base" 这种语法
  const postcssImport = (await import('postcss-import')).default
  const cssResult = await postcss([
    postcssImport(),
    tailwindPlugin,
    autoprefixer()
  ]).process(styleCss, {
    from: styleCssPath,
    to: path.join(distDir, 'assets/main.css')
  })
  // 追加 themes.css 和 fontawesome (PostCSS 不能展开"@import 'tailwindcss/base'"之外的)
  // fontawesome 里也有 .fa- 类, 可能与 style.css 重复, 但浏览器后定义优先, 无副作用
  let finalCss = cssResult.css
  if (fs.existsSync(themesCssPath)) {
    finalCss += '\n/* === themes.css === */\n' + fs.readFileSync(themesCssPath, 'utf8')
  }
  if (fs.existsSync(faCssPath)) {
    finalCss += '\n/* === FontAwesome === */\n' + fs.readFileSync(faCssPath, 'utf8')
  }
  console.log('[build-esbuild] app CSS generated, size:', finalCss.length, 'bytes (style+themes+fontawesome)')

  const result = await build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    outfile: path.join(distDir, 'assets/main.js'),
    format: 'esm',
    platform: 'browser',
    target: 'esnext',
    minify: false,
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
      // esbuild 不支持 import.meta.env, 需要手动定义 BASE_URL
      'import.meta.env.BASE_URL': '"./"',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.VITE_PUSH_SERVER_URL': JSON.stringify(process.env.VITE_PUSH_SERVER_URL || 'https://chilly-phone-push.by811520.workers.dev')
    },
    loader: {
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.svg': 'file',
      '.webp': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.ttf': 'file',
      '.eot': 'file',
      '.mp3': 'file',
      '.wav': 'file',
      '.mp4': 'file',
      '.ico': 'file'
    },
    assetNames: 'assets/[name]-[hash]',
    publicPath: './',
    plugins: [aliasPlugin, vuePlugin()],
    logLevel: 'info',
    splitting: false,
    treeShaking: true,
    write: true,
    allowOverwrite: true
  })

  console.log('[build-esbuild] JS bundle done')

  const cssOutputPath = path.join(distDir, 'assets/main.css')
  const existingCss = fs.existsSync(cssOutputPath) ? fs.readFileSync(cssOutputPath, 'utf8') : ''
  const mergedCss = finalCss + (existingCss ? '\n/* === existing SFC CSS === */\n' + existingCss : '')
  fs.writeFileSync(cssOutputPath, mergedCss, 'utf8')
  console.log('[build-esbuild] CSS merged, size:', mergedCss.length, 'bytes (style+themes+fontawesome + existing)')

  // Copy FontAwesome font files from node_modules into dist/webfonts so CSS font URLs resolve in production.
  const faWebfontsSrc = path.join(root, 'node_modules', '@fortawesome', 'fontawesome-free', 'webfonts')
  const faWebfontsDest = path.join(distDir, 'webfonts')
  if (fs.existsSync(faWebfontsSrc)) {
    console.log('[build-esbuild] copying FontAwesome webfonts...')
    copyDir(faWebfontsSrc, faWebfontsDest)
  }

  // 输出 index.html - 修复 module 脚本路径, 添加 CSS 引用
  indexHtml = indexHtml.replace(
    /<script type="module" src="\/src\/main\.js"><\/script>/,
    '<link rel="stylesheet" href="./assets/main.css">\n  <script type="module" src="./assets/main.js"></script>'
  )
  // 处理 native-diag.js 路径: dev 是 /native-diag.js, build 输出在根
  indexHtml = indexHtml.replace(
    /<script type="module" src="\/native-diag\.js"><\/script>/,
    '<script src="./native-diag.js"></script>'
  )
  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml)
  console.log('[build-esbuild] index.html written')

  console.log('[build-esbuild] all done!')
} catch (e) {
  console.error('[build-esbuild] FAILED:', e.message)
  console.error(e.stack)
  process.exit(1)
}
