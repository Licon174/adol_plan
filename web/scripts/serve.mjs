import { createServer, request as httpRequest } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = process.argv[2] ?? '.'
const port = Number(process.argv[3] ?? 4173)
const proxyArg = process.argv.find((a) => a.startsWith('--proxy='))
const proxyOrigin = proxyArg ? new URL(proxyArg.slice('--proxy='.length)) : null

const PROXY_PREFIXES = ['/reqproc', '/pic', '/reqproc_']

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/x-javascript',
  '.mjs': 'application/x-javascript',
  '.css': 'text/css',
  '.json': 'text/plain',
  '.png': 'text/plain',
  '.gif': 'text/plain',
  '.ico': 'text/plain',
  '.svg': 'text/plain',
}

function shouldProxy(pathname) {
  return proxyOrigin !== null && PROXY_PREFIXES.some((p) => pathname.startsWith(p))
}

function proxyTo(req, res, pathname, search) {
  const target = new URL(pathname + search, proxyOrigin)
  const headers = { ...req.headers, host: proxyOrigin.host }

  const upstream = httpRequest(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers,
      timeout: 15000,

      insecureHTTPParser: true,
    },
    (up) => {
      console.log(`[proxy] ${req.method} ${target.pathname}${target.search} -> ${up.statusCode}`)

      const out = { ...up.headers }
      delete out.connection
      delete out['keep-alive']
      delete out['transfer-encoding']
      delete out['content-length']
      res.writeHead(up.statusCode ?? 502, out)
      up.pipe(res)
    },
  )

  upstream.on('timeout', () => {
    console.log(`[proxy] ${req.method} ${target.pathname} -> 超时`)
    upstream.destroy()
    if (!res.headersSent) res.writeHead(504)
    res.end()
  })

  upstream.on('error', (e) => {
    console.log(`[proxy] ${req.method} ${target.pathname} -> 错误 ${e.message}`)
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })

  req.pipe(upstream)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)

  if (shouldProxy(pathname)) {
    proxyTo(req, res, pathname, url.search)
    return
  }

  let filePath = pathname
  if (filePath.endsWith('/')) filePath += 'index.html'
  const safe = normalize(filePath).replace(/^(\.\.[/\\])+/, '')
  const file = join(root, safe)

  try {
    const st = await stat(file)
    if (!st.isFile()) throw new Error('not a file')
    const buf = await readFile(file)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(buf)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end('404')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`)
  if (proxyOrigin) console.log(`proxying ${PROXY_PREFIXES.join(', ')} -> ${proxyOrigin.origin}`)
})
