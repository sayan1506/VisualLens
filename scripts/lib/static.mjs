// Shared static file serving for the render (screenshot) server and the play
// (interactive) server. Serving dist/ is identical for both; only the extra
// routes differ, so those live in each caller.
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

export const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

// Serve a file from distDir for this request. SPA-style: extensionless paths
// resolve to index.html. Writes the full response (200 or 404).
export async function serveStaticFile(distDir, req, res) {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0])
    if (urlPath === '/' || !extname(urlPath)) urlPath = '/index.html'
    const filePath = join(distDir, urlPath)
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403)
      return res.end()
    }
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}
