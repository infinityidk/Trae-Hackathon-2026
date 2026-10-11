'use strict';
// 记录持久化：服务端 JSON 文件（同一服务下手机与电脑看到同一记录）。
const fs = require('fs');
const path = require('path');
const reference = require('./reference');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SEED_FILE = path.join(DATA_DIR, 'seed-records.json');

// 允许的状态流转（宽松但明确；已改善/未发现问题均可重新打开）
const STATUSES = {
  pending: '待核查',
  reviewing: '核查中',
  to_fix: '待改善',
  fixed: '已改善',
  no_issue: '未发现问题'
};
const VALID_STATUS = new Set(Object.keys(STATUSES));

let records = [];
let writeChain = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return 'rec-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** 把种子里的条款引用/案例分析解析成完整记录 */
function hydrateRecord(input) {
  const { clauses } = reference.resolveClauseRefs(input.clauseRefs || []);
  const rec = { ...input, clauses };
  delete rec.clauseRefs;
  return rec;
}

function seedIfNeeded() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(RECORDS_FILE)) {
    records = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8')).records || [];
    return;
  }
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')).records || [];
  records = seed.map(hydrateRecord);
  persist();
  console.log(`[store] 首次启动，已载入 ${records.length} 条演示记录（明确标注的虚构示例）`);
}

function persist() {
  const snapshot = JSON.stringify({ records }, null, 2);
  writeChain = writeChain.then(() => fs.promises.writeFile(RECORDS_FILE, snapshot, 'utf8'))
    .catch((err) => console.error('[store] 写入 records.json 失败:', err.message));
  return writeChain;
}

function list() {
  return records;
}

function get(id) {
  return records.find((r) => r.id === id) || null;
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20);
}

function cleanClauses(clauseIds) {
  const valid = [];
  const seen = new Set();
  for (const raw of asStringArray(clauseIds)) {
    const m = raw.match(/^(gb55019|gb50763|sjg103)-(.+)$/);
    if (!m || seen.has(raw)) continue;
    seen.add(raw);
    const c = reference.resolveClause(m[1], m[2]);
    if (c) valid.push(c);
  }
  return valid;
}

function cleanPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.slice(0, 12).map((p) => ({
    url: String(p.url || '').slice(0, 300),
    kind: ['现场', '补充', '复查'].includes(p.kind) ? p.kind : '现场',
    label: String(p.label || '').slice(0, 100),
    at: p.at || nowIso()
  })).filter((p) => p.url.startsWith('/'));
}

function cleanLocation(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const lng = Number(loc.lng);
  const lat = Number(loc.lat);
  const hasCoord = Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= 73.66 && lng <= 135.05 && lat >= 3.86 && lat <= 53.55;
  const address = String(loc.address || '').trim().slice(0, 200);
  const routeName = String(loc.routeName || '').trim().slice(0, 200);
  if (!hasCoord && !address && !routeName) return null;
  return {
    lng: hasCoord ? lng : null,
    lat: hasCoord ? lat : null,
    coordSystem: hasCoord ? 'GCJ-02' : null, // 前端在高德底图上选点/已做 WGS84→GCJ02 转换
    address,
    routeName: reference.routeNames.includes(routeName) ? routeName : (routeName || '')
  };
}

/**
 * 新建记录。payload 来自前端，做白名单与基本校验。
 */
function create(payload) {
  const source = payload.source === 'public' ? 'public' : 'volunteer';
  const issue = reference.getIssue(String(payload.issueId || ''));
  const category = issue ? issue.category : String(payload.category || '其他').slice(0, 20);
  const title = String(payload.title || '').trim().slice(0, 120) ||
    (issue ? issue.title : '未命名问题记录');

  const rec = {
    id: newId(),
    isDemo: false,
    source,
    title,
    issueId: issue ? issue.id : '',
    category,
    observations: asStringArray(payload.observations),
    impacts: String(payload.impacts || '').slice(0, 1000),
    boundary: String(payload.boundary || '').slice(0, 1000),
    photos: cleanPhotos(payload.photos),
    location: cleanLocation(payload.location),
    clauses: cleanPayloadClauses(payload, issue),
    evidenceNeeded: asStringArray(payload.evidenceNeeded),
    supplements: [],
    reviewConclusion: '',
    status: 'pending',
    analysis: cleanAnalysis(payload.analysis),
    timeline: []
  };
  const at = nowIso();
  const by = source === 'public' ? '公众' : '志愿者';
  rec.timeline.push({
    at,
    action: source === 'public' ? '公众线索' : '新增记录',
    detail: source === 'public'
      ? '公众提交待核查线索，等待志愿者核查确认。'
      : '志愿者新增记录，状态：待核查。',
    by
  });
  rec.createdAt = at;
  rec.updatedAt = at;
  records.unshift(rec);
  persist();
  return rec;
}

function cleanPayloadClauses(payload, issue) {
  // 优先使用前端显式传入的条款；否则用问题分类的默认条款
  const refs = Array.isArray(payload.clauseRefs) && payload.clauseRefs.length
    ? payload.clauseRefs
    : (issue ? issue.clauseRefs : []);
  const { clauses } = reference.resolveClauseRefs(refs);
  return clauses;
}

function cleanAnalysis(a) {
  const allowed = ['demo-preset', 'vision-model', 'text-model', 'manual'];
  const source = a && allowed.includes(a.source) ? a.source : 'manual';
  return {
    source,
    model: String((a && a.model) || '').slice(0, 80),
    note: String((a && a.note) || '').slice(0, 300),
    at: (a && a.at) || nowIso()
  };
}

/**
 * 更新记录：补充证据 / 状态进展 / 编辑基础字段
 */
function update(id, payload) {
  const rec = get(id);
  if (!rec) return null;
  const at = nowIso();
  const by = payload.source === 'public' ? '公众' : '志愿者';
  const action = payload.action;

  if (action === 'supplement') {
    const text = String(payload.text || '').trim().slice(0, 1000);
    const photos = cleanPhotos(payload.photos);
    if (!text && !photos.length) {
      const e = new Error('补充内容不能为空');
      e.statusCode = 400;
      throw e;
    }
    const sup = { at, author: by, text, photos };
    rec.supplements.push(sup);
    rec.timeline.push({
      at,
      action: '新增补充',
      detail: text ? (text.length > 60 ? text.slice(0, 60) + '…' : text) : `补充 ${photos.length} 张照片`,
      by
    });
  } else if (action === 'status') {
    const status = String(payload.status || '');
    if (!VALID_STATUS.has(status)) {
      const e = new Error('未知状态');
      e.statusCode = 400;
      throw e;
    }
    if (status === 'fixed') {
      const note = String(payload.note || '').trim();
      if (!note) {
        const e = new Error('标记“已改善”需要填写复查说明');
        e.statusCode = 400;
        throw e;
      }
    }
    const note = String(payload.note || '').trim().slice(0, 1000);
    const photos = cleanPhotos(payload.photos);
    const oldStatus = rec.status;
    const oldLabel = STATUSES[oldStatus];
    const newLabel = STATUSES[status];
    const isReopen = ['fixed', 'no_issue'].includes(oldStatus) &&
      ['reviewing', 'pending'].includes(status);
    rec.status = status;
    if (status === 'fixed') rec.reviewConclusion = note;
    if (status === 'no_issue') rec.reviewConclusion = note || rec.reviewConclusion;
    if (note || photos.length) {
      rec.supplements.push({ at, author: by, text: note, photos });
    }
    rec.timeline.push({
      at,
      action: isReopen ? '重新打开' : '状态更新',
      detail: isReopen
        ? `情况发生变化，记录由「${oldLabel}」重新打开为「${newLabel}」。${note}`
        : `状态由「${oldLabel}」变更为「${newLabel}」。${note}`,
      by
    });
  } else if (action === 'edit') {
    if (payload.title !== undefined) {
      const t = String(payload.title).trim().slice(0, 120);
      if (t) rec.title = t;
    }
    if (payload.observations !== undefined) rec.observations = asStringArray(payload.observations);
    if (payload.impacts !== undefined) rec.impacts = String(payload.impacts).slice(0, 1000);
    if (payload.evidenceNeeded !== undefined) rec.evidenceNeeded = asStringArray(payload.evidenceNeeded);
    if (payload.location !== undefined) rec.location = cleanLocation(payload.location);
    if (payload.clauseRefs !== undefined) {
      const { clauses } = reference.resolveClauseRefs(Array.isArray(payload.clauseRefs) ? payload.clauseRefs : []);
      rec.clauses = clauses;
    }
    rec.timeline.push({ at, action: '编辑记录', detail: '志愿者修正了记录内容。', by });
  } else {
    const e = new Error('未知更新操作');
    e.statusCode = 400;
    throw e;
  }

  rec.updatedAt = at;
  persist();
  return rec;
}

module.exports = {
  STATUSES,
  seedIfNeeded,
  list,
  get,
  create,
  update,
  persist
};
