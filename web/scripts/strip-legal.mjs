import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../../resources/web', import.meta.url))

const RE = /\/\*[\s\S]{0,400}?\*\//g

let total = 0
for (const f of ['app.js', 'app.css']) {
  const p = join(DIST, f)
  let src
  try {
    src = readFileSync(p, 'utf8')
  } catch {
    continue
  }
  const out = src.replace(RE, (m) => {

    if (!/@vue\//.test(m) && !/vue-router/.test(m)) return m

    if (m.includes('"') || m.includes("'") || m.includes('`')) return m
    total++
    return ''
  })
  if (out !== src) writeFileSync(p, out, 'utf8')
}

console.log(`[strip-comments] 已剥离 ${total} 处第三方 license 注释块`)
