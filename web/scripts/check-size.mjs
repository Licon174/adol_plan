import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../../resources/web', import.meta.url))
const KB = 1024

const TARGET = { total: 640 * KB, js: 440 * KB, css: 195 * KB }

const HARD = { total: 670 * KB, js: 465 * KB, css: 205 * KB }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push({ path: p, rel: relative(DIST, p).replace(/\\/g, '/'), size: st.size })
  }
  return out
}

let files
try {
  files = walk(DIST)
} catch {
  console.error(`[size] 找不到产物目录：${DIST}`)
  process.exit(1)
}

const kb = (n) => (n / KB).toFixed(1) + ' KB'
const sum = (arr) => arr.reduce((a, b) => a + b.size, 0)

const js = files.filter((f) => f.rel.endsWith('.js'))
const css = files.filter((f) => f.rel.endsWith('.css'))
const other = files.filter((f) => !f.rel.endsWith('.js') && !f.rel.endsWith('.css'))
const total = sum(files)

console.log('[size] 产物清单：')
for (const f of [...files].sort((a, b) => b.size - a.size)) {
  console.log(`         ${kb(f.size).padStart(10)}  ${f.rel}`)
}
console.log('[size] ------------------------------------------')
console.log(`[size] JS    ${kb(sum(js)).padStart(10)}  (目标 ${kb(TARGET.js)} / 上限 ${kb(HARD.js)})`)
console.log(`[size] CSS   ${kb(sum(css)).padStart(10)}  (目标 ${kb(TARGET.css)} / 上限 ${kb(HARD.css)})`)
console.log(`[size] 其它  ${kb(sum(other)).padStart(10)}`)
console.log(`[size] 合计  ${kb(total).padStart(10)}  (目标 ${kb(TARGET.total)} / 上限 ${kb(HARD.total)})`)
console.log(`[size] 对比旧后台 1.92MB：降 ${(100 - (total / (1.92 * 1024 * KB)) * 100).toFixed(1)}%`)

const chunks = js.filter((f) => f.rel !== 'app.js')
if (chunks.length) {
  console.error(`[size] ✗ 出现额外 chunk（违反单 bundle 约束）：${chunks.map((c) => c.rel).join(', ')}`)
  process.exit(1)
}

const MOCK_MARKERS = ['Xiaomi-14', '实测降级态', 'adol-2EB174_2', 'AdolTest2026']
if (js.length) {
  const src = readFileSync(js[0].path, 'utf8')
  const leaked = MOCK_MARKERS.filter((m) => src.includes(m))
  if (leaked.length) {
    console.error(`[size] ✗ 生产包含 mock 数据（特征串：${leaked.join(', ')}）`)
    console.error('[size]   常见原因：页面里用了动态 import()，导致 tree-shaking 失效 —— 改回静态导入')
    process.exit(1)
  }
  console.log(`[size] ✓ 无 mock 残留（已检查 ${MOCK_MARKERS.length} 个特征串）`)
}

try {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  if (!/type="module"/.test(html)) console.warn('[size] ! index.html 里没有 type="module"，请确认')
  if (!/app\.js/.test(html)) {
    console.error('[size] ✗ index.html 未引用 app.js')
    process.exit(1)
  }
} catch {
  console.error('[size] ✗ 缺少 index.html')
  process.exit(1)
}

const hardOver = []
if (total > HARD.total) hardOver.push(`合计 ${kb(total)} > ${kb(HARD.total)}`)
if (sum(js) > HARD.js) hardOver.push(`JS ${kb(sum(js))} > ${kb(HARD.js)}`)
if (sum(css) > HARD.css) hardOver.push(`CSS ${kb(sum(css))} > ${kb(HARD.css)}`)
if (hardOver.length) {
  console.error('[size] ✗ 超出硬上限：' + hardOver.join('；'))
  process.exit(1)
}

const softOver = []
if (total > TARGET.total) softOver.push(`合计 ${kb(total)} > ${kb(TARGET.total)}`)
if (sum(js) > TARGET.js) softOver.push(`JS ${kb(sum(js))} > ${kb(TARGET.js)}`)
if (sum(css) > TARGET.css) softOver.push(`CSS ${kb(sum(css))} > ${kb(TARGET.css)}`)
if (softOver.length) {
  console.warn('[size] ! 超出目标值（未超硬上限）：' + softOver.join('；'))
  console.warn('[size] ! 若为正常增长请同步上调 TARGET；否则先找可复用/可删的部分')
}

console.log('[size] ✓ 体积在硬上限内')
