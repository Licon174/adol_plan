import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

if (!existsSync('.git') && !existsSync('../.git')) {
  console.log('[prepare] 非 git 仓，跳过 husky')
  process.exit(0)
}
try {
  execSync('husky', { stdio: 'inherit' })
} catch {
  console.log('[prepare] husky 安装失败，已忽略')
}
