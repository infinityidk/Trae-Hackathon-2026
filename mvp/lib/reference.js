'use strict';
// 参考资料：复用橙光队上游项目的标准检索库、PDF、路线与设施数据，不复制站点。
const fs = require('fs');
const path = require('path');

const MVP_DIR = path.join(__dirname, '..');
const REPO_DIR = path.join(MVP_DIR, '..');
const STANDARDS_DIR = path.join(REPO_DIR, '橙光队项目', 'accessibility-standards');
const MAP_DIR = path.join(REPO_DIR, '橙光队项目', 'survey-map');

const paths = {
  mvpDir: MVP_DIR,
  repoDir: REPO_DIR,
  standardsDir: STANDARDS_DIR,
  mapDir: MAP_DIR,
  searchIndex: path.join(STANDARDS_DIR, 'data', 'search-index.json'),
  standardsMeta: path.join(STANDARDS_DIR, 'data', 'standards.json'),
  pdfDir: path.join(STANDARDS_DIR, 'pdf'),
  pdfWebDir: path.join(STANDARDS_DIR, 'pdf', 'lib', 'web'),
  pdfBuildDir: path.join(STANDARDS_DIR, 'pdf', 'lib', 'build'),
  routes: path.join(MAP_DIR, 'data', 'routes.geojson'),
  routeTypes: path.join(MAP_DIR, 'data', 'types.json'),
  routeDetails: path.join(MAP_DIR, 'data', 'route_details.csv'),
  accessibilityTypes: path.join(MAP_DIR, 'data', 'accessibility_types.json'),
  accessibilityDir: path.join(MAP_DIR, 'data', 'accessibility'),
  issues: path.join(MVP_DIR, 'data', 'issue-types.json'),
  demoCases: path.join(MVP_DIR, 'data', 'demo-cases.json')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const searchIndex = readJson(paths.searchIndex).entries; // 576 条，部分为节选/条文说明
const standardsMeta = readJson(paths.standardsMeta).standards.map((s) => ({
  id: s.id,
  shortName: s.shortName,
  fullName: s.fullName,
  type: s.type,
  totalPages: s.totalPages
}));
const indexById = new Map(searchIndex.map((e) => [e.id, e]));

const issueTypes = readJson(paths.issues).issues;
const issueById = new Map(issueTypes.map((i) => [i.id, i]));
const demoCases = readJson(paths.demoCases).cases;
const demoCaseById = new Map(demoCases.map((c) => [c.id, c]));

const routeTypes = readJson(paths.routeTypes);
const accessibilityTypes = readJson(paths.accessibilityTypes);
const routesGeo = readJson(paths.routes);

// 解析路线勘测详情 CSV（名称,勘测日期,无障碍不规范点）
function parseRouteDetailsCsv() {
  const text = fs.readFileSync(paths.routeDetails, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    const [name, date, spots] = cols;
    if (name) out[name.trim()] = { date: (date || '').trim(), spots: (spots || '').trim() };
  }
  return out;
}
const routeDetails = parseRouteDetailsCsv();

// 精简路线要素供前端渲染（坐标是 GCJ-02，直接配合高德底图）
const routes = routesGeo.features.map((f, idx) => ({
  id: 'route-' + idx,
  name: f.properties.name || '未命名路线',
  type: f.properties.type || '待勘测',
  geometry: f.geometry,
  details: routeDetails[f.properties.name] || null
}));
const routeNames = routes.map((r) => r.name);

/**
 * 条款引用 → 本地资料库中的完整条目。匹配不到时返回 null（不编造正文）。
 */
function resolveClause(standardId, clauseNumber) {
  const entry = indexById.get(`${standardId}-${clauseNumber}`);
  if (!entry) return null;
  return {
    id: entry.id,
    standardId: entry.standardId,
    standardName: entry.standardName,
    standardFullName: entry.standardFullName,
    standardType: entry.standardType,
    clauseNumber: entry.clauseNumber,
    text: entry.text,
    page: entry.page,
    pdfFile: entry.pdfFile,
    excerpt: true // 资料库文本可能为节选/条文说明，以 PDF 原文为准
  };
}

/**
 * 批量解析条款引用；返回 {clauses, missing}
 */
function resolveClauseRefs(refs) {
  const clauses = [];
  const missing = [];
  const seen = new Set();
  for (const ref of refs || []) {
    const key = `${ref.standardId}-${ref.clauseNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = resolveClause(ref.standardId, ref.clauseNumber);
    if (c) clauses.push(c);
    else missing.push(key);
  }
  return { clauses, missing };
}

/**
 * 标准关键词检索（沿用上游 search.js 的 AND 分词与打分思路，服务端实现）
 */
function searchStandards(query, limit = 30) {
  const keywords = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!keywords.length) return [];
  const results = [];
  for (const entry of searchIndex) {
    const hay = {
      text: (entry.text || '').toLowerCase(),
      number: (entry.clauseNumber || '').toLowerCase(),
      chapter: (entry.chapterTitle || '').toLowerCase(),
      section: (entry.sectionTitle || '').toLowerCase(),
      standard: (entry.standardName || '').toLowerCase()
    };
    let all = true;
    let score = 0;
    for (const kw of keywords) {
      const inText = hay.text.includes(kw);
      const inNumber = hay.number.includes(kw);
      const inChapter = hay.chapter.includes(kw);
      const inSection = hay.section.includes(kw);
      const inStandard = hay.standard.includes(kw);
      if (!inText && !inNumber && !inChapter && !inSection && !inStandard) { all = false; break; }
      if (inNumber) score += 10;
      if (hay.number === kw) score += 20;
      if (inChapter) score += 3;
      if (inSection) score += 3;
      if (inStandard) score += 2;
      if (inText) {
        score += 5;
        let pos = hay.text.indexOf(kw);
        while (pos !== -1) { score++; pos = hay.text.indexOf(kw, pos + 1); }
      }
    }
    if (all) results.push({ entry, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => ({
    id: r.entry.id,
    standardId: r.entry.standardId,
    standardName: r.entry.standardName,
    standardFullName: r.entry.standardFullName,
    standardType: r.entry.standardType,
    clauseNumber: r.entry.clauseNumber,
    text: r.entry.text,
    page: r.entry.page,
    pdfFile: r.entry.pdfFile,
    chapterTitle: r.entry.chapterTitle,
    sectionTitle: r.entry.sectionTitle,
    isMandatory: r.entry.isMandatory,
    excerpt: true
  }));
}

/** 给模型用的紧凑条款目录（15 类常见问题 + 对应条款 ID） */
function compactCatalog() {
  return issueTypes.map((i) => ({
    issueId: i.id,
    category: i.category,
    title: i.title,
    description: i.description,
    clauseIds: i.clauseRefs.map((r) => `${r.standardId}-${r.clauseNumber}`)
  }));
}

function getDemoCase(id) {
  return demoCaseById.get(id) || null;
}
function getIssue(id) {
  return issueById.get(id) || null;
}

module.exports = {
  paths,
  standardsMeta,
  issueTypes,
  demoCases,
  routes,
  routeNames,
  routeTypes,
  accessibilityTypes,
  resolveClause,
  resolveClauseRefs,
  searchStandards,
  compactCatalog,
  getDemoCase,
  getIssue
};
