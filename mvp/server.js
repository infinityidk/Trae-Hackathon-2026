'use strict';
// 橙光随手查 MVP —— 零依赖 Node 服务：静态托管 + JSON API + 图片上传 + 模型代理。
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');

const config = require('./lib/config');
const reference = require('./lib/reference');
const store = require('./lib/store');
const model = require('./lib/model');

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
store.seedIfNeeded();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        const e = new Error('请求体过大');
        e.statusCode = 413;
        reject(e);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req, 14 * 1024 * 1024); // 含 base64 图片
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    const e = new Error('JSON 格式错误');
    e.statusCode = 400;
    throw e;
  }
}

/** 安全地把 URL 路径映射到 baseDir 下的真实文件 */
function safeFile(baseDir, urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]);
  const full = path.normalize(path.join(baseDir, rel));
  if (!full.startsWith(baseDir + path.sep) && full !== baseDir) return null;
  return full;
}

function serveStatic(req, res, baseDir, urlPath, { fallthroughIndex = false } = {}) {
  let full = safeFile(baseDir, urlPath);
  if (!full) { sendError(res, 403, '禁止访问'); return true; }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    if (fallthroughIndex && (urlPath === '/' || urlPath === '')) {
      full = path.join(baseDir, 'index.html');
    } else {
      return false;
    }
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ...(ext === '.html' ? { 'Cache-Control': 'no-store' } : {})
  });
  fs.createReadStream(full).on('error', () => sendError(res, 404, '文件读取失败')).pipe(res);
  return true;
}

// 图片二进制魔数校验
function sniffImage(buf) {
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.length > 7 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf.length > 11 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return '.webp';
  if (buf.length > 5 && buf.slice(0, 6).toString('ascii') === 'GIF89a' || buf.slice(0, 6).toString('ascii') === 'GIF87a') return '.gif';
  return null;
}

// ---------- API 处理 ----------
async function handleApi(req, res, pathname) {
  // 模型状态
  if (pathname === '/api/model-status' && req.method === 'GET') {
    return sendJson(res, 200, model.status());
  }

  // 汇总元数据：问题分类（含已解析条款）、路线、标准、状态字典、设施图层配置
  if (pathname === '/api/meta' && req.method === 'GET') {
    const issues = reference.issueTypes.map((i) => {
      const { clauses } = reference.resolveClauseRefs(i.clauseRefs);
      return { ...i, clauses };
    });
    return sendJson(res, 200, {
      issues,
      categories: [...new Set(reference.issueTypes.map((i) => i.category))],
      statuses: Object.entries(store.STATUSES).map(([value, label]) => ({ value, label })),
      standards: reference.standardsMeta,
      routes: reference.routes,
      routeTypes: reference.routeTypes,
      accessibilityTypes: reference.accessibilityTypes,
      model: model.status()
    });
  }

  if (pathname === '/api/demo-cases' && req.method === 'GET') {
    const cases = reference.demoCases.map((c) => {
      const issue = reference.getIssue(c.issueId);
      return {
        id: c.id,
        issueId: c.issueId,
        category: issue ? issue.category : '',
        title: c.title,
        image: c.image,
        description: issue ? issue.description : ''
      };
    });
    return sendJson(res, 200, { cases, note: '演示案例与图片均为虚构示意（图片由 AI 生成），不是真实勘测发现。' });
  }

  if (pathname === '/api/records' && req.method === 'GET') {
    return sendJson(res, 200, { records: store.list() });
  }

  if (pathname === '/api/records' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const rec = store.create(body);
    return sendJson(res, 201, { record: rec });
  }

  const recMatch = pathname.match(/^\/api\/records\/([\w-]+)$/);
  if (recMatch && req.method === 'GET') {
    const rec = store.get(recMatch[1]);
    return rec ? sendJson(res, 200, { record: rec }) : sendError(res, 404, '记录不存在');
  }

  const patchMatch = pathname.match(/^\/api\/records\/([\w-]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const body = await readJsonBody(req);
    try {
      const rec = store.update(patchMatch[1], body);
      if (!rec) return sendError(res, 404, '记录不存在');
      return sendJson(res, 200, { record: rec });
    } catch (e) {
      return sendError(res, e.statusCode || 500, e.message);
    }
  }

  if (pathname === '/api/images' && req.method === 'POST') {
    const buf = await readBody(req, 10 * 1024 * 1024);
    const ext = sniffImage(buf);
    if (!ext) return sendError(res, 400, '仅支持 JPG/PNG/WebP/GIF 图片');
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const filePath = path.join(UPLOADS_DIR, name);
    await fs.promises.writeFile(filePath, buf);
    return sendJson(res, 201, { url: '/uploads/' + name });
  }

  if (pathname === '/api/analyze' && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const result = await model.analyze(body);
      return sendJson(res, 200, { result });
    } catch (e) {
      // 真实接口失败：明确报告失败，不伪装成功；前端可重试或主动切换演示
      return sendJson(res, e.statusCode || 502, {
        error: e.message || '模型分析失败',
        canRetry: true,
        fallback: '可重试，或改用明确标注的演示案例 / 人工填写记录。'
      });
    }
  }

  if (pathname === '/api/standards/search' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    return sendJson(res, 200, { query: q, results: reference.searchStandards(q), note: '资料为搜索库节选，部分内容为条文说明，以 PDF 原文为准。' });
  }

  return sendError(res, 404, '接口不存在');
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    // 上游 PDF 原文与 PDF.js 查看器
    if (pathname.startsWith('/pdfs/')) {
      if (serveStatic(req, res, reference.paths.pdfDir, pathname.replace(/^\/pdfs\//, '/'))) return;
      return sendError(res, 404, 'PDF 不存在');
    }
    if (pathname.startsWith('/pdfjs/web/')) {
      if (serveStatic(req, res, reference.paths.pdfWebDir, pathname.replace(/^\/pdfjs\/web\//, '/'))) return;
      return sendError(res, 404, '查看器资源不存在');
    }
    if (pathname.startsWith('/pdfjs/build/')) {
      if (serveStatic(req, res, reference.paths.pdfBuildDir, pathname.replace(/^\/pdfjs\/build\//, '/'))) return;
      return sendError(res, 404, '查看器资源不存在');
    }

    // 上游地图数据（路线 / 设施 GeoJSON）
    if (pathname.startsWith('/survey/')) {
      if (serveStatic(req, res, reference.paths.mapDir, pathname.replace(/^\/survey\//, '/'))) return;
      return sendError(res, 404, '地图资源不存在');
    }

    // 用户上传图片
    if (pathname.startsWith('/uploads/')) {
      if (serveStatic(req, res, UPLOADS_DIR, pathname.replace(/^\/uploads\//, '/'))) return;
      return sendError(res, 404, '图片不存在');
    }

    // 前端静态资源（含 /demo、/assets）
    if (serveStatic(req, res, PUBLIC_DIR, pathname === '/' ? '/index.html' : pathname)) return;

    // 前端路由兜底（hash 路由下通常用不到，保险处理）
    if (serveStatic(req, res, PUBLIC_DIR, '/index.html')) return;
  } catch (e) {
    if (e.statusCode === 413) return sendError(res, 413, e.message);
    console.error('[server]', e);
    if (!res.headersSent) sendError(res, 500, '服务器内部错误');
  }
});

server.listen(config.port, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name]) {
      if (ni.family === 'IPv4' && !ni.internal) lanIps.push(ni.address);
    }
  }
  console.log('');
  console.log('橙光随手查 MVP 已启动');
  console.log('  本机访问:   http://localhost:' + config.port);
  for (const ip of lanIps) console.log('  局域网访问: http://' + ip + ':' + config.port + '  （手机连同一 Wi-Fi）');
  console.log('  模型状态:   ' + model.status().note);
  console.log('');
});
