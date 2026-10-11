'use strict';
/* 橙光随手查 MVP 前端（原生 JS，无框架）
 * 志愿者/公众共用一套页面，顶栏切换体验；数据来自同源服务端 API。
 */
(function () {
  // ---------- 常量与状态 ----------
  const STATUS_META = {
    pending:   { label: '待核查',   cls: 'badge-pending',    icon: '◔' },
    reviewing: { label: '核查中',   cls: 'badge-reviewing',  icon: '◐' },
    to_fix:    { label: '待改善',   cls: 'badge-to_fix',     icon: '⚠' },
    fixed:     { label: '已改善',   cls: 'badge-fixed',      icon: '✓' },
    no_issue:  { label: '未发现问题', cls: 'badge-no_issue', icon: '∅' }
  };
  const NEXT_STATUS = {
    pending:   [['reviewing', '开始核查'], ['no_issue', '标记未发现问题']],
    reviewing: [['to_fix', '确认问题，转待改善'], ['no_issue', '标记未发现问题'], ['pending', '退回待核查']],
    to_fix:    [['fixed', '填写复查说明，标记已改善'], ['reviewing', '退回核查中']],
    fixed:     [['reviewing', '情况变化，重新打开']],
    no_issue:  [['reviewing', '情况变化，重新打开']]
  };
  const ANALYSIS_META = {
    'demo-preset': { label: '演示预设分析（非模型识别）', cls: 'mode-demo' },
    'vision-model': { label: '视觉模型分析（已查看照片）', cls: 'mode-vision' },
    'text-model':   { label: '文本模型辅助（仅基于文字描述）', cls: 'mode-text' },
    manual:         { label: '人工填写', cls: 'mode-unavailable' }
  };

  const state = {
    role: localStorage.getItem('cg-role') === 'public' ? 'public' : 'volunteer',
    meta: null,
    records: [],
    demos: [],
    model: null,
    maps: [],
    draft: loadDraft()
  };

  const view = document.getElementById('view');

  // ---------- 小工具 ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function statusBadge(status) {
    const m = STATUS_META[status] || STATUS_META.pending;
    return `<span class="badge ${m.cls}"><span aria-hidden="true">${m.icon}</span>${m.label}</span>`;
  }
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms || 2400);
  }
  async function api(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(url, opt);
    let data = null;
    try { data = await res.json(); } catch (_) { /* 非 JSON */ }
    if (!res.ok) {
      const e = new Error((data && data.error) || `请求失败（${res.status}）`);
      e.payload = data;
      throw e;
    }
    return data;
  }

  // WGS84 → GCJ02（高德底图；与上游 survey-map/js/map.js 同一算法，浏览器定位需转换，底图选点不重复转换）
  function wgs84ToGcj02(lng, lat) {
    const a = 6378245.0, ee = 0.00669342162296594323;
    const tLat = (x, y) => {
      let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
      r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
      r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
      return r;
    };
    const tLng = (x, y) => {
      let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
      r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
      r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
      return r;
    };
    let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    const rad = lat / 180 * Math.PI;
    let magic = Math.sin(rad);
    magic = 1 - ee * magic * magic;
    const sq = Math.sqrt(magic);
    dLat = dLat * 180 / ((a * (1 - ee)) / (magic * sq) * Math.PI);
    dLng = dLng * 180 / (a / sq * Math.cos(rad) * Math.PI);
    return [lng + dLng, lat + dLat];
  }

  function openPdf(pdfFile, page) {
    const file = '/' + String(pdfFile || '').split('/').pop();
    const url = `/pdfjs/web/viewer.html?file=${encodeURIComponent('/pdfs/' + file.replace(/^\//, ''))}#page=${page || 1}`;
    window.open(url, '_blank', 'noopener');
  }
  window.openPdf = openPdf;

  function registerMap(m) { state.maps.push(m); return m; }
  function cleanupMaps() {
    state.maps.forEach((m) => { try { m.remove(); } catch (_) {} });
    state.maps = [];
  }

  function makeBaseMap(el, zoom) {
    // Leaflet 的 L.map(id) 内部用 getElementById，需去掉选择器前缀的 #
    const id = typeof el === 'string' ? el.replace(/^#/, '') : el;
    const container = typeof id === 'string' ? document.getElementById(id) : id;
    // 若容器尚未有尺寸（移动端布局未完成/父级 display:none 刚恢复），给临时高度避免 Leaflet 初始化尺寸为 0
    let tempHeight = null;
    if (container && container.clientHeight === 0) {
      tempHeight = container.style.height;
      container.style.height = '360px';
    }
    const map = L.map(id, { preferCanvas: true, zoomControl: true, zoomSnap: 0.5 }).setView([22.5955, 114.0020], zoom || 15);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: '1234', maxZoom: 20, attribution: '高德地图'
    }).addTo(map);
    // 下一帧恢复容器原始高度并刷新地图尺寸
    requestAnimationFrame(() => {
      if (tempHeight !== null) container.style.height = tempHeight;
      map.invalidateSize({ animate: false });
      setTimeout(() => map.invalidateSize({ animate: false }), 120);
    });
    registerMap(map);
    return map;
  }

  function clauseCard(c, removable) {
    const mandatory = c.standardType === '全文强制性'
      ? '<span class="badge badge-mandatory">强制性</span>' : '';
    return `<div class="clause-card" data-cid="${esc(c.id)}">
      ${removable ? '<button type="button" class="btn small ghost clause-remove" data-act="remove-clause" aria-label="移除该条款">×</button>' : ''}
      <div class="clause-head">
        <span class="clause-num">${esc(c.clauseNumber)}</span>
        <span class="badge badge-std">${esc(c.standardName)}</span>
        ${mandatory}
        <span class="muted">${esc(c.standardFullName)}</span>
      </div>
      <div class="clause-text">${esc(c.text)}</div>
      <div class="excerpt-note">资料为搜索库节选，部分内容为条文说明，以 PDF 原文为准（第 ${esc(c.page)} 页）。</div>
      <div class="clause-actions">
        <button type="button" class="btn small" data-act="pdf" data-file="${esc(c.pdfFile || '')}" data-page="${esc(c.page)}">📄 查看 PDF 原文（第 ${esc(c.page)} 页）</button>
      </div>
    </div>`;
  }

  // ---------- 图片：压缩上传 ----------
  function fileToResizedDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解析失败'));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10MB');
    const dataUrl = await fileToResizedDataUrl(file, 1400);
    const blob = await (await fetch(dataUrl)).blob();
    const res = await fetch('/api/images', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '图片上传失败');
    return { url: data.url, dataUrl };
  }

  // ---------- 草稿 ----------
  const DRAFT_KEY = 'cg-draft-v1';
  function emptyDraft() {
    return {
      demoCaseId: '', mainPhoto: '', description: '',
      issueId: '', title: '', observations: '', impacts: '', boundary: '',
      clauses: [], evidenceNeeded: [],
      location: { lng: null, lat: null, address: '', routeName: '' },
      extraPhotos: []
    };
  }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return Object.assign(emptyDraft(), JSON.parse(raw));
    } catch (_) {}
    return emptyDraft();
  }
  function saveDraft() {
    try {
      const d = Object.assign({}, state.draft);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (_) {}
  }
  function clearDraft() {
    state.draft = emptyDraft();
    localStorage.removeItem(DRAFT_KEY);
  }

  // ---------- 路由 ----------
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '') || 'discover';
    const [pathPart, queryPart] = raw.split('?');
    const params = {};
    if (queryPart) {
      for (const pair of queryPart.split('&')) {
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    const parts = pathPart.split('/').filter(Boolean);
    return { name: parts[0] || 'discover', arg: parts[1] || '', params };
  }

  async function route() {
    cleanupMaps();
    const r = parseHash();
    $$('.bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === r.name));
    if (r.name === 'discover') renderDiscover(r.params);
    else if (r.name === 'capture') renderCapture(r.params);
    else if (r.name === 'standards') renderStandards();
    else if (r.name === 'record') renderRecord(r.arg);
    else { location.hash = '#/discover'; return; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- 发现页 ----------
  const discoverFilter = { category: '', status: '', q: '', route: '' };
  let facilityLayers = {};

  function haversineKm(coords) {
    let km = 0;
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1], [lng2, lat2] = coords[i];
      const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      km += 2 * R * Math.asin(Math.sqrt(a));
    }
    return km;
  }

  function filteredRecords() {
    return state.records.filter((r) => {
      if (discoverFilter.category && r.category !== discoverFilter.category) return false;
      if (discoverFilter.status && r.status !== discoverFilter.status) return false;
      if (discoverFilter.route && (!r.location || r.location.routeName !== discoverFilter.route)) return false;
      if (discoverFilter.q) {
        const hay = (r.title + ' ' + r.category + ' ' + (r.location ? r.location.address : '') + ' ' +
          r.observations.join(' ')).toLowerCase();
        if (!hay.includes(discoverFilter.q.toLowerCase())) return false;
      }
      return true;
    });
  }

  function renderDiscover(params) {
    if (params.route) discoverFilter.route = params.route;
    const isPublic = state.role === 'public';
    const cats = state.meta.categories;
    view.innerHTML = `
      <div class="discover" id="discover-root">
        <div class="map-pane">
          <div id="map" role="region" aria-label="无障碍问题与督导路线地图"></div>
          <div class="map-toolbar">
            <div class="map-panel" id="facility-panel">
              <h4>图层</h4>
              <label><input type="checkbox" data-fac="wheelchair_toilets"> 无障碍卫生间</label>
              <label><input type="checkbox" data-fac="wheelchair_poi"> 轮椅可达场所</label>
              <label><input type="checkbox" id="layer-routes" data-layer="routes" checked> 督导路线</label>
            </div>
          </div>
          <div class="mobile-view-toggle" role="tablist" aria-label="地图与列表切换">
            <button type="button" id="mt-map" class="on">地图</button>
            <button type="button" id="mt-list">列表</button>
          </div>
        </div>
        <aside class="list-pane">
          <button type="button" class="btn primary big" id="go-capture">📷 ${isPublic ? '拍照看看 / 提交线索' : '拍照看看 / 新增记录'}</button>
          <div class="filters">
            <select id="f-category" aria-label="按问题类型筛选">
              <option value="">全部类型</option>
              ${cats.map((c) => `<option value="${esc(c)}"${discoverFilter.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <select id="f-status" aria-label="按处理状态筛选">
              <option value="">全部状态</option>
              ${state.meta.statuses.map((s) => `<option value="${s.value}"${discoverFilter.status === s.value ? ' selected' : ''}>${s.label}</option>`).join('')}
            </select>
            <input type="search" id="f-q" class="grow" placeholder="搜索标题/位置…" value="${esc(discoverFilter.q)}" aria-label="关键词筛选">
          </div>
          ${discoverFilter.route ? `<div class="hint info" id="route-hint">正在查看路线「${esc(discoverFilter.route)}」的关联记录。<a href="#" id="clear-route">清除筛选</a></div>` : ''}
          <div class="count-line" id="count-line"></div>
          <div id="record-list"></div>
        </aside>
      </div>`;

    const map = makeBaseMap('#map', 15);
    // 等下一帧布局完成后刷新地图尺寸（移动端切换/首次渲染常见容器高度为 0 问题）
    requestAnimationFrame(() => {
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 100);
    });

    // 路线图层
    let routesLayer = null;
    function drawRoutes() {
      if (routesLayer) { map.removeLayer(routesLayer); routesLayer = null; }
      if (!$('#layer-routes').checked) return;
      routesLayer = L.geoJSON(state.meta.routes.map((r) => ({ type: 'Feature', properties: r, geometry: r.geometry })), {
        style: (f) => {
          const t = state.meta.routeTypes[f.properties.type] || {};
          return { color: t.color || '#999', weight: 4, opacity: .85 };
        },
        onEachFeature: (f, layer) => {
          const r = f.properties;
          const km = f.geometry.type === 'LineString' ? haversineKm(f.geometry.coordinates) : 0;
          const linked = state.records.filter((x) => x.location && x.location.routeName === r.name).length;
          layer.bindPopup(
            `<h3>${esc(r.name)}</h3>
             <p>类型：${esc(r.type)}｜长度约 ${km.toFixed(2)} 公里</p>
             <p>勘测日期：${esc(r.details && r.details.date || '未记录')}</p>
             <p>勘测不规范点：${esc(r.details && r.details.spots || '未记录')}</p>
             <p class="muted">关联问题记录：<b>${linked}</b> 条（问题数量不代表整条路线是否无障碍）</p>
             <p><a href="#/discover?route=${encodeURIComponent(r.name)}">查看该路线的关联记录 →</a></p>`
          );
        }
      }).addTo(map);
    }
    drawRoutes();

    // 问题点图层
    let markerLayer = L.layerGroup().addTo(map);
    function drawMarkers() {
      markerLayer.clearLayers();
      const list = filteredRecords();
      list.forEach((r) => {
        if (!r.location || r.location.lng == null) return;
        const m = STATUS_META[r.status] || STATUS_META.pending;
        const icon = L.divIcon({
          className: '',
          html: `<div class="custom-marker cm-${esc(r.status)}" title="${esc(r.title)}"><span>${m.icon}</span></div>`,
          iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24]
        });
        const marker = L.marker([r.location.lat, r.location.lng], { icon });
        marker.bindPopup(
          `<h3>${esc(r.title)}</h3>
           <div class="popup-badges">${statusBadge(r.status)}
             <span class="badge badge-src">${esc(r.category)}</span>
             ${r.isDemo ? '<span class="badge badge-demo">示例</span>' : ''}
           </div>
           <a href="#/record/${esc(r.id)}">查看完整记录 →</a>`
        );
        markerLayer.addLayer(marker);
      });
      return list;
    }

    function renderList() {
      const list = drawMarkers();
      const counts = state.meta.statuses.map((s) => {
        const n = state.records.filter((r) => r.status === s.value).length;
        return `${s.label} ${n}`;
      }).join('　');
      const surveyed = state.meta.routes.filter((r) => r.type === '已勘测').length;
      $('#count-line').innerHTML =
        `当前筛选 <b>${list.length}</b> 条记录（无坐标的记录只在列表中显示）。<br>` +
        `<span class="muted">全部记录状态：${counts}。督导路线：已勘测 ${surveyed} / ${state.meta.routes.length} 条（路线勘测统计与问题统计分开）。</span>`;
      if (!list.length) {
        $('#record-list').innerHTML = '<div class="card" style="padding:18px;text-align:center;color:var(--muted)">没有符合筛选条件的记录</div>';
        return;
      }
      $('#record-list').innerHTML = list.map((r) => {
        const thumb = r.photos && r.photos[0]
          ? `<img class="rc-thumb" src="${esc(r.photos[0].url)}" alt="${esc(r.photos[0].label || r.title)}" loading="lazy">` : '';
        const loc = r.location ? (r.location.address || r.location.routeName || '已选地图点位') : '仅文字位置（待核实点位）';
        return `<button type="button" class="record-card" data-id="${esc(r.id)}">
          <div class="rc-top">
            ${statusBadge(r.status)}
            <span class="badge badge-src">${esc(r.category)}</span>
            ${r.isDemo ? '<span class="badge badge-demo">虚构示例</span>' : ''}
            ${r.source === 'public' ? '<span class="badge badge-src">公众线索</span>' : ''}
          </div>
          <div class="rc-title">${esc(r.title)}</div>
          <div class="rc-meta">
            <span>🕓 ${fmtDate(r.createdAt)}</span><span>📍 ${esc(loc)}</span>
            ${r.location && r.location.routeName ? `<span>🧭 ${esc(r.location.routeName)}</span>` : ''}
          </div>
          ${thumb}
          <div class="rc-evidence">
            <span>📷 ${r.photos.length} 张照片</span>
            <span>🧾 依据 ${r.clauses.length} 条</span>
            <span>🔍 待补证据 ${r.evidenceNeeded.length} 项</span>
          </div>
        </button>`;
      }).join('');
      $$('.record-card', $('#record-list')).forEach((card) => {
        card.addEventListener('click', () => { location.hash = '#/record/' + card.dataset.id; });
      });
    }
    renderList();

    // 设施图层（懒加载，OSM 数据为 WGS84，需转 GCJ-02）
    async function toggleFacility(key, on) {
      if (on) {
        if (!facilityLayers[key]) {
          const cfg = state.meta.accessibilityTypes[key];
          const resp = await fetch(`/survey/data/accessibility/${key}.geojson`);
          const geo = await resp.json();
          const layer = L.layerGroup();
          (geo.features || []).forEach((f) => {
            if (!f.geometry || f.geometry.type !== 'Point') return;
            const [wLng, wLat] = f.geometry.coordinates;
            const [lng, lat] = wgs84ToGcj02(wLng, wLat);
            const p = f.properties || {};
            const cm = L.circleMarker([lat, lng], {
              radius: 6, color: '#fff', weight: 1.5,
              fillColor: cfg.markerColor, fillOpacity: .85
            });
            cm.bindPopup(`<h3>${esc(p.name || p['name:zh'] || cfg.label)}</h3><p>${esc(cfg.label)}</p><p class="muted">数据来源：OpenStreetMap</p>`);
            layer.addLayer(cm);
          });
          facilityLayers[key] = layer;
        }
        facilityLayers[key].addTo(map);
      } else if (facilityLayers[key]) {
        map.removeLayer(facilityLayers[key]);
      }
    }

    // 事件绑定
    $('#go-capture').addEventListener('click', () => { location.hash = '#/capture'; });
    $('#f-category').addEventListener('change', (e) => { discoverFilter.category = e.target.value; renderList(); });
    $('#f-status').addEventListener('change', (e) => { discoverFilter.status = e.target.value; renderList(); });
    let qTimer;
    $('#f-q').addEventListener('input', (e) => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { discoverFilter.q = e.target.value.trim(); renderList(); }, 250);
    });
    $('#layer-routes').addEventListener('change', (e) => { drawRoutes(); });
    $$('#facility-panel input[data-fac]').forEach((cb) => {
      cb.addEventListener('change', () => {
        toggleFacility(cb.dataset.fac, cb.checked).catch((err) => toast('设施图层加载失败：' + err.message));
      });
    });
    const clearRoute = $('#clear-route');
    if (clearRoute) clearRoute.addEventListener('click', (e) => {
      e.preventDefault(); discoverFilter.route = ''; renderDiscover({});
    });
    // 手机地图/列表切换
    const root = $('#discover-root');
    $('#mt-list').addEventListener('click', () => {
      root.classList.add('show-list');
      $('#mt-list').classList.add('on'); $('#mt-map').classList.remove('on');
    });
    $('#mt-map').addEventListener('click', () => {
      root.classList.remove('show-list');
      $('#mt-map').classList.add('on'); $('#mt-list').classList.remove('on');
      // 从列表切回地图时容器从 display:none 恢复，需等布局完成后刷新尺寸
      requestAnimationFrame(() => {
        map.invalidateSize();
        setTimeout(() => map.invalidateSize(), 100);
      });
    });
  }

  // ---------- 拍照 / 新增 ----------
  function issueOptions(selected) {
    const groups = {};
    state.meta.issues.forEach((i) => { (groups[i.category] = groups[i.category] || []).push(i); });
    return `<option value="">未确定类型（可稍后选择）</option>` +
      Object.keys(groups).map((cat) =>
        `<optgroup label="${esc(cat)}">${groups[cat].map((i) =>
          `<option value="${esc(i.id)}"${i.id === selected ? ' selected' : ''}>${esc(i.title)}</option>`).join('')}</optgroup>`
      ).join('');
  }
  function getIssue(id) { return state.meta.issues.find((i) => i.id === id) || null; }

  function renderCapture(params) {
    const d = state.draft;
    if (params.issue && !d.issueId) { // 从标准页带入类型
      d.issueId = params.issue;
      const issue = getIssue(d.issueId);
      if (issue) {
        d.clauses = issue.clauses.slice();
        d.evidenceNeeded = issue.checkPoints.slice();
      }
      saveDraft();
    }
    const isPublic = state.role === 'public';
    view.innerHTML = `
      <div class="page">
        <div class="hint">${isPublic
          ? '你正在以<b>公众</b>身份体验：拍照了解问题与影响，提交后将成为「待核查」线索，由志愿者核实跟进。'
          : '你正在以<b>志愿者</b>身份操作：拍照分析 → 补证与定位 → 保存为可核查记录。'}
          所有内容每一步都会自动暂存在本机，返回不会丢失。</div>

        <!-- 步骤 1 -->
        <section class="card step">
          <div class="step-num">选择照片或演示案例</div>
          <p class="muted" style="margin:4px 0 10px">支持手机直接拍照/相册上传；也可以选择明确标注的虚构演示案例走完全流程。</p>
          <label class="upload-slot" id="upload-slot">
            <input type="file" id="main-file" accept="image/*" capture="environment">
            <div class="big-ico">📷</div>
            <div><b>拍照 / 从相册选择图片</b></div>
            <div class="muted">JPG/PNG/WebP，最大 10MB（局域网下相机不可用时可改用相册或演示案例）</div>
          </label>
          <div class="preview-wrap" id="main-preview"></div>
          <div class="section-title" style="font-size:15px">或选择演示案例（虚构示意，图片由 AI 生成）</div>
          <div class="demo-grid" id="demo-grid">
            ${state.demos.map((c) => `
              <button type="button" class="demo-case ${d.demoCaseId === c.id ? 'selected' : ''}" data-case="${esc(c.id)}">
                <span class="dc-tag">虚构示例</span>
                <img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">
                <div class="dc-cap">${esc(c.title)}</div>
              </button>`).join('')}
          </div>
        </section>

        <!-- 步骤 2 -->
        <section class="card step">
          <div class="step-num">查看分析，纠正与补充</div>
          <label class="field-label" for="cap-desc">你观察到的现象（可选；仅有文本模型时为必填，越具体越好）</label>
          <textarea id="cap-desc" placeholder="例如：盲道上停了约十辆共享单车，占了大约 30 米，旁边是非机动车道…">${esc(d.description)}</textarea>
          <div class="action-row">
            <button type="button" class="btn primary" id="btn-analyze">🔍 开始分析</button>
            <span class="muted" id="analyze-hint">分析分四块：可见现象、可能影响、相关标准、待补证据</span>
          </div>
          <div id="analyze-banner"></div>
          <div class="analysis-result" id="analysis-panel" ${d.title || d.observations ? '' : 'hidden'}>
            <label class="field-label" for="cap-issue">问题类型（可纠正模型判断）</label>
            <select id="cap-issue">${issueOptions(d.issueId)}</select>
            <div class="action-row"><button type="button" class="btn small" id="btn-apply-template">套用该类型的检查要点与标准条款</button></div>

            <label class="field-label" for="cap-title">记录标题</label>
            <input type="text" id="cap-title" maxlength="120" value="${esc(d.title)}" placeholder="一句话概括问题与位置">

            <div class="block-label">① 照片可见现象 <span class="muted" style="font-weight:400">（每行一条，只写看得到的事实）</span></div>
            <textarea id="cap-obs" placeholder="逐行填写可见现象…">${esc(d.observations)}</textarea>

            <div class="block-label">② 可能影响谁、为什么</div>
            <textarea id="cap-impacts">${esc(d.impacts)}</textarea>

            <div class="block-label">信息边界（单凭照片无法确认的内容）</div>
            <textarea id="cap-boundary" style="min-height:60px">${esc(d.boundary)}</textarea>

            <div class="block-label">③ 相关标准条款</div>
            <div id="cap-clauses"></div>
            <div class="mini-search">
              <input type="search" id="clause-q" placeholder="搜索本地标准库，如：盲道 占用 / 1:12 / 缘石坡道" aria-label="搜索标准条款">
              <button type="button" class="btn" id="clause-search-btn">搜索</button>
            </div>
            <div class="search-results card" id="clause-results" style="border-radius:10px;padding:8px"></div>

            <div class="block-label">④ 还需要补拍 / 测量 / 确认什么</div>
            <ul class="evidence-list" id="evidence-list"></ul>
            <button type="button" class="btn small" id="add-evidence">+ 增加一项</button>

            <div class="block-label">补充照片（可多张）</div>
            <label class="upload-slot" style="padding:12px">
              <input type="file" id="extra-file" accept="image/*" multiple>
              ＋ 添加补充照片
            </label>
            <div class="thumb-grid" id="extra-photos"></div>
          </div>
        </section>

        <!-- 步骤 3 -->
        <section class="card step">
          <div class="step-num">位置与关联路线</div>
          <p class="muted" style="margin:4px 0">在地图上点选位置（可拖动红点微调），或只填写文字位置——没有坐标的记录也会保留在列表中，不会生成假点位。</p>
          <div class="pick-map" id="pick-map"></div>
          <div class="map-actions">
            <button type="button" class="btn" id="btn-geo">📍 使用我的定位（可选）</button>
            <button type="button" class="btn ghost" id="btn-clear-loc">清除点位</button>
          </div>
          <div class="coord-line" id="coord-line"></div>
          <label class="field-label" for="cap-address">位置文字描述（必填其一：点位或文字）</label>
          <input type="text" id="cap-address" maxlength="200" value="${esc(d.location.address)}" placeholder="如：学苑大道与南科一路路口西侧公交站旁">
          <label class="field-label" for="cap-route">关联督导路线（可选）</label>
          <select id="cap-route">
            <option value="">不关联路线</option>
            ${state.meta.routes.map((r) => `<option value="${esc(r.name)}"${d.location.routeName === r.name ? ' selected' : ''}>${esc(r.name)}（${esc(r.type)}）</option>`).join('')}
          </select>
        </section>

        <!-- 步骤 4 -->
        <section class="card step">
          <div class="step-num">保存记录</div>
          <div id="save-summary" class="muted" style="margin-bottom:10px"></div>
          <button type="button" class="btn primary btn-block" id="btn-save" style="min-height:50px">
            ${isPublic ? '提交待核查线索' : '保存记录（状态：待核查）'}
          </button>
          <p class="muted" style="margin-top:8px">不必填完所有信息：信息不完整也可以先保存，后续在记录详情中补证。</p>
        </section>
      </div>`;

    const dm = state.draft;

    // 主图
    function renderMainPreview() {
      const el = $('#main-preview');
      if (dm.mainPhoto) {
        el.innerHTML = `<img src="${esc(dm.mainPhoto)}" alt="已选照片预览">
          <button type="button" class="btn small preview-remove" data-act="clear-main">移除照片 ×</button>`;
        el.querySelector('[data-act="clear-main"]').addEventListener('click', () => {
          dm.mainPhoto = ''; dm._dataUrl = ''; dm.demoCaseId = '';
          saveDraft(); renderMainPreview(); $$('.demo-case').forEach((b) => b.classList.toggle('selected', false));
        });
      } else el.innerHTML = '';
    }
    renderMainPreview();

    $('#main-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        toast('正在处理图片…');
        const up = await uploadImage(file);
        dm.mainPhoto = up.url; dm._dataUrl = up.dataUrl; dm.demoCaseId = '';
        saveDraft(); renderMainPreview();
        $$('.demo-case').forEach((b) => b.classList.toggle('selected', false));
        toast('图片已上传，可以开始分析');
      } catch (err) { toast(err.message); }
      e.target.value = '';
    });

    $$('.demo-case').forEach((btn) => {
      btn.addEventListener('click', () => {
        dm.demoCaseId = btn.dataset.case;
        const c = state.demos.find((x) => x.id === dm.demoCaseId);
        dm.mainPhoto = c.image; dm._dataUrl = '';
        saveDraft(); renderMainPreview();
        $$('.demo-case').forEach((b) => b.classList.toggle('selected', b === btn));
      });
    });

    // 分析
    $('#cap-desc').addEventListener('input', (e) => { dm.description = e.target.value; saveDraft(); });

    function renderBanner(mode, errorText) {
      const el = $('#analyze-banner');
      if (errorText) {
        el.innerHTML = `<div class="hint warn" style="margin-top:12px"><span class="mode-tag mode-error">接口失败</span>
          <div style="margin-top:6px">${esc(errorText)}</div>
          <div class="action-row">
            <button type="button" class="btn small primary" id="retry-analyze">重试</button>
            <button type="button" class="btn small" id="retry-demo">改用演示案例</button>
            <button type="button" class="btn small ghost" id="retry-manual">人工填写</button>
          </div></div>`;
        $('#retry-analyze').addEventListener('click', doAnalyze);
        $('#retry-demo').addEventListener('click', () => toast('请在上方选择一个演示案例后再点“开始分析”'));
        $('#retry-manual').addEventListener('click', () => { $('#analysis-panel').hidden = false; syncSummary(); });
        return;
      }
      const map = {
        demo: ['mode-demo', '演示预设结果：以下为该虚构案例的预设分析，不是模型真实识别，可自由修改。'],
        vision: ['mode-vision', `视觉模型 ${esc(state.model.model || '')} 已分析照片；以下为模型推测，精确数值与画面外情况仍需核实。`],
        text: ['mode-text', '基于你的文字描述由文本模型辅助生成，模型没有查看照片；条款由程序从本地资料库补入。'],
        unavailable: ['mode-unavailable', '当前没有可用模型接口：未对图片做任何识别。你可以人工填写，或选择上方演示案例。']
      };
      const [cls, text] = map[mode] || map.unavailable;
      el.innerHTML = `<div class="hint ${mode === 'vision' ? 'info' : ''}" style="margin-top:12px">
        <span class="mode-tag ${cls}">${mode === 'demo' ? '演示模式' : mode === 'vision' ? '视觉模型' : mode === 'text' ? '文字模式' : '无模型'}</span>
        <div style="margin-top:6px">${text}</div></div>`;
    }

    async function doAnalyze() {
      const banner = $('#analyze-banner');
      banner.innerHTML = '<div style="margin-top:12px"><span class="spinner"></span> 正在分析，请稍候…</div>';
      const payload = { description: dm.description };
      if (dm.demoCaseId) payload.demoCaseId = dm.demoCaseId;
      else if (dm._dataUrl) payload.imageDataUrl = dm._dataUrl;
      try {
        const { result } = await api('POST', '/api/analyze', payload);
        $('#analysis-panel').hidden = false;
        renderBanner(result.mode);
        if (result.mode !== 'unavailable') {
          dm.issueId = result.issueId || dm.issueId;
          dm.title = result.title || dm.title;
          dm.observations = (result.observations || []).join('\n');
          dm.impacts = result.impacts || dm.impacts;
          dm.boundary = result.boundary || dm.boundary;
          if (result.clauses && result.clauses.length) dm.clauses = result.clauses;
          if (result.evidenceNeeded && result.evidenceNeeded.length) dm.evidenceNeeded = result.evidenceNeeded;
          saveDraft();
          syncFormFromDraft();
        }
      } catch (err) {
        renderBanner(null, err.message + '（失败不会伪装成识别结果，可重试或改用演示）');
      }
      syncSummary();
    }
    $('#btn-analyze').addEventListener('click', doAnalyze);

    // 表单 ↔ draft
    function syncFormFromDraft() {
      const issueEl = $('#cap-issue');
      if (issueEl) issueEl.value = dm.issueId;
      $('#cap-title').value = dm.title;
      $('#cap-obs').value = dm.observations;
      $('#cap-impacts').value = dm.impacts;
      $('#cap-boundary').value = dm.boundary;
      renderClauses(); renderEvidence(); renderExtraPhotos(); syncSummary();
    }
    function bindFormSync() {
      $('#cap-issue').addEventListener('change', (e) => { dm.issueId = e.target.value; saveDraft(); syncSummary(); });
      $('#cap-title').addEventListener('input', (e) => { dm.title = e.target.value; saveDraft(); syncSummary(); });
      $('#cap-obs').addEventListener('input', (e) => { dm.observations = e.target.value; saveDraft(); syncSummary(); });
      $('#cap-impacts').addEventListener('input', (e) => { dm.impacts = e.target.value; saveDraft(); syncSummary(); });
      $('#cap-boundary').addEventListener('input', (e) => { dm.boundary = e.target.value; saveDraft(); });
      $('#cap-address').addEventListener('input', (e) => { dm.location.address = e.target.value; saveDraft(); syncSummary(); });
      $('#cap-route').addEventListener('change', (e) => { dm.location.routeName = e.target.value; saveDraft(); syncSummary(); });
    }

    $('#btn-apply-template').addEventListener('click', () => {
      const issue = getIssue($('#cap-issue').value);
      if (!issue) return toast('请先选择问题类型');
      dm.issueId = issue.id;
      dm.clauses = issue.clauses.slice();
      dm.evidenceNeeded = issue.checkPoints.slice();
      if (!dm.title) dm.title = issue.title;
      saveDraft(); syncFormFromDraft();
      toast('已套用该类型的条款与检查要点');
    });

    function renderClauses() {
      const host = $('#cap-clauses');
      host.innerHTML = dm.clauses.length
        ? dm.clauses.map((c) => clauseCard(c, true)).join('')
        : '<p class="muted">尚未关联条款，可在下方搜索添加。</p>';
      host.querySelectorAll('[data-act="remove-clause"]').forEach((b) => {
        b.addEventListener('click', () => {
          const card = b.closest('.clause-card');
          dm.clauses = dm.clauses.filter((c) => c.id !== card.dataset.cid);
          saveDraft(); renderClauses();
        });
      });
      host.querySelectorAll('[data-act="pdf"]').forEach((b) => {
        b.addEventListener('click', () => openPdf(b.dataset.file, b.dataset.page));
      });
    }

    async function clauseSearch() {
      const q = $('#clause-q').value.trim();
      const box = $('#clause-results');
      if (!q) return;
      box.classList.add('open');
      box.innerHTML = '<p class="muted" style="padding:6px">搜索中…</p>';
      const { results } = await api('GET', '/api/standards/search?q=' + encodeURIComponent(q));
      if (!results.length) { box.innerHTML = '<p class="muted" style="padding:6px">未找到相关条款，换个关键词试试。</p>'; return; }
      box.innerHTML = results.slice(0, 12).map((c) => `
        <div class="clause-card">
          <div class="clause-head"><span class="clause-num">${esc(c.clauseNumber)}</span>
            <span class="badge badge-std">${esc(c.standardName)}</span></div>
          <div class="clause-text">${esc(c.text)}</div>
          <div class="clause-actions">
            <button type="button" class="btn small primary" data-add="${esc(c.id)}">加入本记录</button>
            <button type="button" class="btn small" data-pdf="${esc(c.pdfFile)}" data-page="${esc(c.page)}">查看 PDF</button>
          </div>
        </div>`).join('');
      box.querySelectorAll('[data-add]').forEach((b) => {
        b.addEventListener('click', () => {
          const c = results.find((x) => x.id === b.dataset.add);
          if (dm.clauses.some((x) => x.id === c.id)) return toast('该条款已在记录中');
          dm.clauses.push(c); saveDraft(); renderClauses(); toast('已加入');
        });
      });
      box.querySelectorAll('[data-pdf]').forEach((b) => {
        b.addEventListener('click', () => openPdf(b.dataset.pdf, b.dataset.page));
      });
    }
    $('#clause-search-btn').addEventListener('click', clauseSearch);
    $('#clause-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') clauseSearch(); });

    function renderEvidence() {
      const listEl = $('#evidence-list');
      listEl.innerHTML = dm.evidenceNeeded.map((t, i) => `
        <li>
          <input type="text" value="${esc(t)}" data-i="${i}" aria-label="待补证据第 ${i + 1} 项">
          <button type="button" class="btn small ghost" data-del="${i}" aria-label="删除该项">×</button>
        </li>`).join('');
      listEl.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', () => { dm.evidenceNeeded[+inp.dataset.i] = inp.value; saveDraft(); syncSummary(); });
      });
      listEl.querySelectorAll('[data-del]').forEach((b) => {
        b.addEventListener('click', () => { dm.evidenceNeeded.splice(+b.dataset.del, 1); saveDraft(); renderEvidence(); });
      });
    }
    $('#add-evidence').addEventListener('click', () => { dm.evidenceNeeded.push(''); saveDraft(); renderEvidence(); });

    function renderExtraPhotos() {
      const host = $('#extra-photos');
      host.innerHTML = dm.extraPhotos.map((u, i) => `
        <div class="ph">
          <img src="${esc(u)}" alt="补充照片 ${i + 1}" data-lightbox="${esc(u)}">
          <button type="button" data-del-ph="${i}" aria-label="删除补充照片">×</button>
        </div>`).join('');
      host.querySelectorAll('[data-del-ph]').forEach((b) => {
        b.addEventListener('click', () => { dm.extraPhotos.splice(+b.dataset.delPh, 1); saveDraft(); renderExtraPhotos(); });
      });
    }
    $('#extra-file').addEventListener('change', async (e) => {
      for (const file of Array.from(e.target.files)) {
        try {
          const up = await uploadImage(file);
          dm.extraPhotos.push(up.url); saveDraft(); renderExtraPhotos();
        } catch (err) { toast(err.message); }
      }
      e.target.value = '';
    });

    bindFormSync();
    syncFormFromDraft();

    // 选点地图
    const pmap = makeBaseMap('#pick-map', 16);
    requestAnimationFrame(() => { pmap.invalidateSize(); setTimeout(() => pmap.invalidateSize(), 100); });
    let pMarker = null;
    function setPoint(lng, lat) {
      dm.location.lng = lng; dm.location.lat = lat;
      if (pMarker) pMarker.setLatLng([lat, lng]);
      else {
        pMarker = L.marker([lat, lng], { draggable: true }).addTo(pmap);
        pMarker.on('dragend', () => {
          const ll = pMarker.getLatLng(); setPoint(ll.lng, ll.lat);
        });
      }
      $('#coord-line').textContent = `已选点位（GCJ-02）：${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      saveDraft(); syncSummary();
    }
    function clearPoint() {
      dm.location.lng = null; dm.location.lat = null;
      if (pMarker) { pmap.removeLayer(pMarker); pMarker = null; }
      $('#coord-line').textContent = '';
      saveDraft(); syncSummary();
    }
    pmap.on('click', (e) => setPoint(e.latlng.lng, e.latlng.lat));
    if (dm.location.lng != null) {
      setPoint(dm.location.lng, dm.location.lat);
      pmap.setView([dm.location.lat, dm.location.lng], 17);
    }
    $('#btn-geo').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('当前浏览器不支持定位，请手动选点');
      toast('正在获取定位…');
      navigator.geolocation.getCurrentPosition((pos) => {
        const [lng, lat] = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude);
        setPoint(lng, lat); pmap.setView([lat, lng], 17);
        toast('已定位（WGS84 已转换为高德坐标）');
      }, (err) => {
        toast('定位不可用（局域网 HTTP 下常见）：请直接在地图上点选或填写文字位置');
      }, { enableHighAccuracy: true, timeout: 9000 });
    });
    $('#btn-clear-loc').addEventListener('click', clearPoint);

    function syncSummary() {
      const s = $('#save-summary');
      if (!s) return;
      const photoN = (dm.mainPhoto ? 1 : 0) + dm.extraPhotos.length;
      const locOk = dm.location.lng != null || dm.location.address || dm.location.routeName;
      s.innerHTML = `照片 <b>${photoN}</b> 张｜条款 <b>${dm.clauses.length}</b> 条｜待补证据 <b>${dm.evidenceNeeded.filter(Boolean).length}</b> 项｜位置：${locOk ? '<b style="color:var(--green)">已填写</b>' : '<b style="color:var(--danger)">缺失</b>'}`;
    }
    syncSummary();

    // 保存
    $('#btn-save').addEventListener('click', async () => {
      const obs = dm.observations.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!dm.mainPhoto && obs.length === 0) return toast('请至少上传一张照片或填写可见现象');
      if (dm.location.lng == null && !dm.location.address.trim() && !dm.location.routeName) {
        return toast('请点选地图位置或填写位置文字描述（没有精确点位也要有文字位置）');
      }
      const photos = [];
      if (dm.mainPhoto) {
        photos.push({
          url: dm.mainPhoto,
          kind: '现场',
          label: dm.demoCaseId ? '示例照片（AI 生成，虚构）' : '现场照片',
          at: new Date().toISOString()
        });
      }
      dm.extraPhotos.forEach((u) => photos.push({ url: u, kind: '补充', label: '补充照片', at: new Date().toISOString() }));
      const payload = {
        source: state.role,
        title: dm.title.trim() || (getIssue(dm.issueId) ? getIssue(dm.issueId).title : '未命名问题记录'),
        issueId: dm.issueId,
        observations: obs,
        impacts: dm.impacts.trim(),
        boundary: dm.boundary.trim(),
        photos,
        location: dm.location.lng != null || dm.location.address.trim() || dm.location.routeName
          ? { lng: dm.location.lng, lat: dm.location.lat, address: dm.location.address.trim(), routeName: dm.location.routeName }
          : null,
        clauseRefs: dm.clauses.map((c) => ({ standardId: c.standardId, clauseNumber: c.clauseNumber })),
        evidenceNeeded: dm.evidenceNeeded.map((x) => x.trim()).filter(Boolean),
        analysis: dm.demoCaseId
          ? { source: 'demo-preset', note: '演示案例预设分析' }
          : (dm._dataUrl
              ? (state.model.mode === 'vision' ? { source: 'vision-model', model: state.model.model } : { source: 'manual' })
              : (dm.description.trim() && state.model.mode === 'text' ? { source: 'text-model', model: state.model.model } : { source: 'manual' }))
      };
      const btn = $('#btn-save');
      btn.disabled = true; btn.textContent = '保存中…';
      try {
        const { record } = await api('POST', '/api/records', payload);
        await reloadRecords();
        clearDraft();
        toast('已保存');
        location.hash = '#/record/' + record.id;
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
        btn.textContent = state.role === 'public' ? '提交待核查线索' : '保存记录（状态：待核查）';
      }
    });
  }

  // ---------- 标准查询 ----------
  function renderStandards() {
    view.innerHTML = `
      <div class="page">
        <div class="card" style="padding:14px 16px">
          <div class="section-title" style="margin-top:0">标准检索</div>
          <p class="muted">收录三本现行标准，共 ${state.meta.standards.reduce((a, s) => a + s.totalPages, 0)} 页：
            ${state.meta.standards.map((s) => `${esc(s.shortName)}《${esc(s.fullName)}》`).join('；')}。
            搜索库文本为节选，部分内容是条文说明，<b>以 PDF 原文为准</b>。</p>
          <div class="std-search-row">
            <input type="search" id="std-q" placeholder="关键词空格分词，如：盲道 占用｜编号 2.11.2｜数值 900mm" aria-label="搜索标准条文">
            <button type="button" class="btn primary" id="std-search-btn">搜索</button>
          </div>
          <div id="std-results" style="margin-top:12px"></div>
        </div>
        <div id="issue-browser"></div>
      </div>`;

    async function doSearch() {
      const q = $('#std-q').value.trim();
      const host = $('#std-results');
      if (!q) { host.innerHTML = ''; return; }
      host.innerHTML = '<p class="muted">搜索中…</p>';
      const { results } = await api('GET', '/api/standards/search?q=' + encodeURIComponent(q));
      if (!results.length) { host.innerHTML = '<div class="hint">未找到相关条款，试试更短的关键词（盲道、坡道、扶手、1:12、13mm）。</div>'; return; }
      host.innerHTML = `<p class="muted">找到 ${results.length} 条（节选内容，以 PDF 为准）：</p>` +
        results.map((c) => `<div class="clause-card">
          <div class="clause-head">
            <span class="clause-num">${esc(c.clauseNumber)}</span>
            <span class="badge badge-std">${esc(c.standardName)}</span>
            ${c.isMandatory ? '<span class="badge badge-mandatory">强制性</span>' : ''}
            <span class="muted">${esc(c.chapterTitle || '')} ${esc(c.sectionTitle || '')}</span>
          </div>
          <div class="clause-text">${esc(c.text)}</div>
          <div class="clause-actions">
            <button type="button" class="btn small primary" data-newissue="${esc(c.standardId)}" data-num="${esc(c.clauseNumber)}">用此条线索去记录</button>
            <button type="button" class="btn small" data-pdf2="${esc(c.pdfFile)}" data-page2="${esc(c.page)}">查看 PDF 第 ${esc(c.page)} 页</button>
          </div>
        </div>`).join('');
      host.querySelectorAll('[data-pdf2]').forEach((b) => b.addEventListener('click', () => openPdf(b.dataset.pdf2, b.dataset.page2)));
      host.querySelectorAll('[data-newissue]').forEach((b) => {
        b.addEventListener('click', () => { location.hash = '#/capture'; toast('可在新增页选择对应问题类型并搜索该条款加入'); });
      });
    }
    $('#std-search-btn').addEventListener('click', doSearch);
    $('#std-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    // 分类浏览
    const groups = {};
    state.meta.issues.forEach((i) => { (groups[i.category] = groups[i.category] || []).push(i); });
    $('#issue-browser').innerHTML = Object.keys(groups).map((cat) => `
      <div class="issue-group-title">${esc(cat)}</div>
      ${groups[cat].map((i) => `
        <div class="card issue-card" data-issue="${esc(i.id)}">
          <div class="issue-card-head" role="button" tabindex="0" aria-expanded="false">
            <div>
              <div class="ic-title">${esc(i.title)}</div>
              <div class="muted">${esc(i.description)}</div>
            </div>
            <span class="chevron" aria-hidden="true">▾</span>
          </div>
          <div class="issue-card-body" hidden>
            <div class="block-label">检查要点</div>
            <ul class="checkpoints">${i.checkPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
            <div class="block-label">关联条款（资料摘录）</div>
            ${i.clauses.map((c) => clauseCard(c, false)).join('')}
            <div class="clause-actions">
              <button type="button" class="btn small primary" data-gocapture="${esc(i.id)}">用这个类型开始记录</button>
            </div>
          </div>
        </div>`).join('')}`).join('');

    $$('.issue-card').forEach((card) => {
      const head = $('.issue-card-head', card);
      const body = $('.issue-card-body', card);
      const toggle = () => {
        const open = card.classList.toggle('open');
        body.hidden = !open;
        head.setAttribute('aria-expanded', String(open));
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      card.querySelectorAll('[data-gocapture]').forEach((b) => {
        b.addEventListener('click', () => { location.hash = '#/capture?issue=' + encodeURIComponent(b.dataset.gocapture); });
      });
      card.querySelectorAll('[data-act="pdf"]').forEach((b) => {
        b.addEventListener('click', () => openPdf(b.dataset.file, b.dataset.page));
      });
    });
  }

  // ---------- 记录详情 ----------
  function renderRecord(id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) {
      view.innerHTML = '<div class="page"><div class="card" style="padding:20px">记录不存在或已被删除。<br><br><a class="btn primary" href="#/discover">返回发现页</a></div></div>';
      return;
    }
    const isPublic = state.role === 'public';
    const sm = STATUS_META[r.status];
    const am = ANALYSIS_META[r.analysis && r.analysis.source] || ANALYSIS_META.manual;
    const loc = r.location;

    const plain = buildPlainExplainer(r);

    view.innerHTML = `
      <div class="detail" id="detail-root">
        <div class="back-row no-print">
          <a class="btn small" href="#/discover">← 返回列表</a>
          <button type="button" class="btn small" id="btn-print">🖨 导出/打印记录</button>
        </div>

        <div class="card detail-head">
          <div class="dh-meta">
            ${statusBadge(r.status)}
            <span class="badge badge-src">${esc(r.category)}</span>
            ${r.isDemo ? '<span class="badge badge-demo">虚构示例记录</span>' : ''}
            <span class="badge badge-src">${r.source === 'public' ? '公众提交' : '志愿者记录'}</span>
          </div>
          <h1>${esc(r.title)}</h1>
          <div class="dh-meta">
            <span>编号 ${esc(r.id)}</span>
            <span>创建于 ${fmtDate(r.createdAt)}</span>
            ${r.updatedAt && r.updatedAt !== r.createdAt ? `<span>更新于 ${fmtDate(r.updatedAt)}</span>` : ''}
          </div>
        </div>

        <div class="detail-section card">
          <h2>📷 照片（${r.photos.length}）</h2>
          ${r.isDemo ? '<div class="hint" style="margin-bottom:8px">本记录为演示案例，照片由 AI 生成，人物与地点均为虚构，不代表真实发现。</div>' : ''}
          ${r.photos.length ? `<div class="thumb-grid">${r.photos.map((p) => `
            <div class="ph">
              <img src="${esc(p.url)}" alt="${esc(p.label || r.title)}" data-lightbox="${esc(p.url)}">
              <span class="ph-kind">${esc(p.kind)}</span>
            </div>`).join('')}</div>` : '<p class="muted">暂无照片</p>'}
        </div>

        <div class="detail-section card">
          <h2>💡 这是什么问题（通俗解释）</h2>
          <button type="button" class="btn small" id="toggle-plain">${isPublic ? '收起通俗解释' : '查看通俗解释'}</button>
          <div class="plain-card" id="plain-card" style="margin-top:10px;${isPublic ? '' : 'display:none'}">
            <p class="muted" style="margin:0 0 6px;color:#9a6a3a">由本记录的事实与条款自动整理，不是官方结论；判断与测量仍以核查为准。</p>
            <div class="plain-q">看到了什么</div><div>${esc(plain.what)}</div>
            <div class="plain-q">会影响谁</div><div>${esc(plain.who)}</div>
            <div class="plain-q">为什么影响通行</div><div>${esc(plain.why)}</div>
            <div class="plain-q">可以怎么做</div><div>${esc(plain.action)}</div>
          </div>
        </div>

        <details class="public-collapse" ${isPublic ? '' : 'open'}>
          <summary>🔎 现象、影响与信息边界（技术细节）</summary>
          <div class="pc-body">
            <div class="block-label">照片可见现象</div>
            <ul class="fact-list">${r.observations.length ? r.observations.map((o) => `<li>${esc(o)}</li>`).join('') : '<li class="muted">未填写</li>'}</ul>
            <div class="block-label">可能影响</div>
            <div>${r.impacts ? nl2br(r.impacts) : '<span class="muted">未填写</span>'}</div>
            <div class="block-label">信息边界</div>
            <div>${r.boundary ? nl2br(r.boundary) : '<span class="muted">未特别说明；注意照片不能判定精确数值与画面外情况。</span>'}</div>
          </div>
        </details>

        <div class="detail-section card">
          <h2>📍 位置与路线</h2>
          ${loc ? `
            <div class="kv"><b>位置描述：</b>${esc(loc.address || '（仅地图点位）')}</div>
            ${loc.routeName ? `<div class="kv"><b>关联路线：</b><a href="#/discover?route=${encodeURIComponent(loc.routeName)}">${esc(loc.routeName)}</a></div>` : ''}`
            : '<div class="kv muted">暂无坐标与关联路线，仅有文字线索，等待志愿者核实位置。</div>'}
          ${loc && loc.lng != null ? `<div class="mini-map" id="detail-map"></div>
            <div class="muted" style="margin-top:4px">点位为示例/人工选点（GCJ-02）。<button type="button" class="btn small ghost" id="detail-go-map">在大地图中查看</button></div>` : ''}
        </div>

        <details class="public-collapse" ${isPublic ? '' : 'open'}>
          <summary>📏 标准依据（${r.clauses.length} 条）与信息来源</summary>
          <div class="pc-body">
            <div style="margin:8px 0">
              <span class="mode-tag ${am.cls}">分析来源：${esc(am.label)}</span>
              ${r.analysis && r.analysis.model ? `<span class="muted" style="margin-left:8px">模型：${esc(r.analysis.model)}</span>` : ''}
            </div>
            <p class="muted">照片观察、模型推测与人工结论分开记录；条款文本为资料库节选，以 PDF 原文为准。</p>
            ${r.clauses.length ? r.clauses.map((c) => clauseCard(c, false)).join('') : '<p class="muted">暂未关联条款。</p>'}
          </div>
        </details>

        <details class="public-collapse" ${isPublic ? '' : 'open'}>
          <summary>🧾 还需要补什么证据（${r.evidenceNeeded.length} 项）</summary>
          <div class="pc-body">
            <ul class="fact-list">${r.evidenceNeeded.length ? r.evidenceNeeded.map((e) => `<li>${esc(e)}</li>`).join('') : '<li class="muted">暂无待补项</li>'}</ul>
          </div>
        </details>

        <div class="detail-section card">
          <h2>📝 核查结论与补充</h2>
          ${r.reviewConclusion ? `<div class="supplement"><div class="sup-meta">核查结论</div>${nl2br(r.reviewConclusion)}</div>` : '<p class="muted">尚未形成核查结论。</p>'}
          ${r.supplements.length ? r.supplements.map((s) => `
            <div class="supplement">
              <div class="sup-meta">${fmtDate(s.at)} · ${esc(s.author)}</div>
              <div>${s.text ? nl2br(s.text) : ''}</div>
              ${s.photos && s.photos.length ? `<div class="thumb-grid">${s.photos.map((p) => `
                <div class="ph"><img src="${esc(p.url)}" alt="补充照片" data-lightbox="${esc(p.url)}"><span class="ph-kind">${esc(p.kind)}</span></div>`).join('')}</div>` : ''}
            </div>`).join('') : ''}
        </div>

        <div class="detail-section card no-print">
          <h2>${isPublic ? '✋ 我要补充线索' : '⚙️ 跟进操作（志愿者）'}</h2>
          <label class="field-label" for="sup-text">${isPublic ? '补充说明（提交后志愿者可见）' : '新增补充说明 / 测量记录'}</label>
          <textarea id="sup-text" placeholder="${isPublic ? '例如：我今天路过发现车已经被清走了 / 另一侧其实有坡道…' : '测量值、复查见闻、联系情况…'}"></textarea>
          <label class="upload-slot" style="padding:10px;margin-top:8px">
            <input type="file" id="sup-file" accept="image/*" multiple>＋ 添加照片（可多张）
          </label>
          <div class="thumb-grid" id="sup-photos"></div>

          ${!isPublic ? `
          <div class="block-label">更新进展状态</div>
          <div class="chip-row" id="status-actions">
            ${(NEXT_STATUS[r.status] || []).map(([v, label]) => `<button type="button" class="btn" data-status="${v}">${esc(label)}</button>`).join('')}
          </div>
          <div id="status-note-box" hidden style="margin-top:10px">
            <label class="field-label" id="note-label" for="status-note">进展说明</label>
            <textarea id="status-note" placeholder="记录本次状态变化的依据…"></textarea>
          </div>` : ''}
          <div class="action-row">
            <button type="button" class="btn primary" id="btn-save-supplement">${isPublic ? '提交补充' : '保存补充'}</button>
          </div>
        </div>

        <div class="detail-section card">
          <h2>🕘 进展时间线</h2>
          <ul class="timeline">${r.timeline.map((t) => `
            <li>
              <div class="tl-at">${fmtDate(t.at)} · ${esc(t.by || '')}</div>
              <div class="tl-action">${esc(t.action)}</div>
              <div>${esc(t.detail)}</div>
            </li>`).join('')}</ul>
          <p class="muted">状态表示本系统内的记录进展，不代表官方认证，也不等于已联系管理方。</p>
        </div>
      </div>`;

    $('#btn-print').addEventListener('click', () => window.print());
    $('#toggle-plain').addEventListener('click', () => {
      const card = $('#plain-card');
      const hidden = card.style.display === 'none';
      card.style.display = hidden ? '' : 'none';
      $('#toggle-plain').textContent = hidden ? '收起通俗解释' : '查看通俗解释';
    });

    // 小地图
    if (loc && loc.lng != null) {
      const mm = makeBaseMap('#detail-map', 17);
      mm.setView([loc.lat, loc.lng], 17);
      L.marker([loc.lat, loc.lng]).addTo(mm);
      requestAnimationFrame(() => { mm.invalidateSize(); setTimeout(() => mm.invalidateSize(), 100); });
      $('#detail-go-map').addEventListener('click', () => { location.hash = '#/discover'; });
    }

    // 条款 PDF
    $$('#detail-root [data-act="pdf"]').forEach((b) => {
      b.addEventListener('click', () => openPdf(b.dataset.file, b.dataset.page));
    });
    // 灯箱
    $$('[data-lightbox]').forEach((img) => img.addEventListener('click', () => {
      const lb = $('#lightbox');
      $('img', lb).src = img.dataset.lightbox;
      lb.hidden = false;
    }));

    // 补充照片暂存
    let supPhotoUrls = [];
    function renderSupPhotos() {
      $('#sup-photos').innerHTML = supPhotoUrls.map((u, i) => `
        <div class="ph"><img src="${esc(u)}" alt="补充照片" data-lightbox="${esc(u)}">
        <button type="button" data-del="${i}" aria-label="删除">×</button></div>`).join('');
      $('#sup-photos').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        supPhotoUrls.splice(+b.dataset.del, 1); renderSupPhotos();
      }));
      $('#sup-photos').querySelectorAll('[data-lightbox]').forEach((img) => img.addEventListener('click', () => {
        const lb = $('#lightbox'); $('img', lb).src = img.dataset.lightbox; lb.hidden = false;
      }));
    }
    $('#sup-file').addEventListener('change', async (e) => {
      for (const file of Array.from(e.target.files)) {
        try { const up = await uploadImage(file); supPhotoUrls.push(up.url); renderSupPhotos(); }
        catch (err) { toast(err.message); }
      }
      e.target.value = '';
    });

    $('#btn-save-supplement').addEventListener('click', async () => {
      const text = $('#sup-text').value.trim();
      if (!text && !supPhotoUrls.length) return toast('请填写说明或添加照片');
      try {
        await api('PATCH', '/api/records/' + r.id, {
          action: 'supplement', source: state.role, text,
          photos: supPhotoUrls.map((u) => ({ url: u, kind: '补充', label: '补充照片' }))
        });
        toast('已保存补充');
        await reloadRecords();
        renderRecord(id);
      } catch (err) { toast(err.message); }
    });

    // 状态更新
    if (!isPublic) {
      $$('#status-actions [data-status]').forEach((b) => {
        b.addEventListener('click', () => {
          const box = $('#status-note-box');
          box.hidden = false;
          const target = b.dataset.status;
          $('#note-label').textContent = target === 'fixed' ? '复查说明（必填）' :
            target === 'no_issue' ? '未发现问题的依据（必填）' : '进展说明';
          box.dataset.target = target;
          if (target === 'fixed' || target === 'reviewing') $('#status-note').focus();
        });
      });
      // 确认按钮
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn primary';
      confirmBtn.style.marginTop = '8px';
      confirmBtn.textContent = '确认更新状态';
      $('#status-note-box').appendChild(confirmBtn);
      confirmBtn.addEventListener('click', async () => {
        const target = $('#status-note-box').dataset.target;
        const note = $('#status-note').value.trim();
        if ((target === 'fixed' || target === 'no_issue') && !note) {
          return toast(target === 'fixed' ? '标记已改善需要填写复查说明' : '请填写未发现问题的依据');
        }
        confirmBtn.disabled = true;
        try {
          await api('PATCH', '/api/records/' + r.id, {
            action: 'status', source: 'volunteer', status: target, note, photos: []
          });
          toast('状态已更新');
          await reloadRecords();
          renderRecord(id);
        } catch (err) { toast(err.message); confirmBtn.disabled = false; }
      });
    }
  }

  function buildPlainExplainer(r) {
    const what = r.observations[0] || r.title;
    const whoMap = {
      '盲道': '主要影响视障朋友，也会影响推婴儿车、拖行李的行人',
      '缘石坡道': '主要影响坐轮椅的朋友，推婴儿车和拄拐的人也会被高差卡住',
      '坡道': '主要影响轮椅使用者，老人和推重物的人也会受影响',
      '出入口': '主要影响轮椅使用者，老人、拄拐者和推婴儿车的人进出也困难',
      '卫生间': '主要影响轮椅使用者及其照护者',
      '其他': '主要影响行动不便的老人、残障朋友和推婴儿车的家长'
    };
    const who = whoMap[r.category] || whoMap['其他'];
    const why = r.impacts || '该情况会让上述人群难以独立、安全地通行或使用设施。';
    const action = r.status === 'fixed'
      ? '该问题已经志愿者复查确认改善。如再次发现类似情况，可以重新拍照上报。'
      : r.status === 'no_issue'
        ? '志愿者核查时该问题已不存在。若你路过发现情况变化，可以拍照补充，记录会重新打开。'
        : '可以在“我要补充线索”里提供更多照片和具体位置；志愿者会现场核查并跟进，状态进展可在本页面查看。';
    return { what, who, why, action };
  }

  // ---------- 灯箱全局 ----------
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target.tagName !== 'IMG') $('#lightbox').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('#lightbox').hidden = true;
  });

  // ---------- 身份切换 ----------
  function renderRoleSwitch() {
    $$('.role-switch button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.role === state.role));
    });
  }
  $$('.role-switch button').forEach((b) => {
    b.addEventListener('click', () => {
      state.role = b.dataset.role;
      localStorage.setItem('cg-role', state.role);
      renderRoleSwitch();
      route();
      toast(state.role === 'public' ? '已切换为公众体验（技术细节默认折叠）' : '已切换为志愿者视图（可核查与跟进）');
    });
  });

  // ---------- 启动 ----------
  async function reloadRecords() {
    const data = await api('GET', '/api/records');
    state.records = data.records || [];
  }

  function renderModelPill() {
    const pill = $('#model-pill');
    const m = state.model;
    pill.classList.remove('vision', 'text', 'demo');
    pill.classList.add(m.mode);
    const label = m.mode === 'vision' ? '视觉模型' : m.mode === 'text' ? '文本模型' : '演示模式';
    $('.txt', pill).textContent = label;
    pill.title = m.note;
    pill.onclick = () => toast(m.note, 4200);
    pill.style.cursor = 'pointer';
  }

  async function boot() {
    renderRoleSwitch();
    try {
      const [meta, records, demos, modelStatus] = await Promise.all([
        api('GET', '/api/meta'),
        api('GET', '/api/records'),
        api('GET', '/api/demo-cases'),
        api('GET', '/api/model-status')
      ]);
      state.meta = meta;
      state.records = records.records || [];
      state.demos = demos.cases || [];
      state.model = modelStatus;
      renderModelPill();
      if (!location.hash) {
        location.hash = '#/discover';
        // 首次设置 hash 后 hashchange 会异步触发 route；这里直接调一次避免空白闪烁
      }
      route();
    } catch (err) {
      view.innerHTML = `<div class="page"><div class="card" style="padding:20px">启动失败：${err.message || err}<br><br>
        请确认通过 <b>node server.js</b> 启动服务，而不是直接打开 HTML 文件。</div></div>`;
    }
  }

  boot();
})();
