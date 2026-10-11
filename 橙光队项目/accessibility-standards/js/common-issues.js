/**
 * 橙光队无障碍督导标准查询 - 常见问题数据与渲染
 * Copyright © 2025 Wayhhow
 * Licensed under MIT
 * https://github.com/Wayhhow/accessibility-standards
 */

/**
 * common-issues.js
 * Common Issues Module - displays common accessibility inspection issues
 */

const commonIssues = [
  {
    id: "blind-road-broken",
    category: "盲道",
    title: "盲道中断/断头",
    description: "盲道在人行道口、交叉口或建筑入口处突然中断，未与提示盲道或目的地衔接",
    checkPoints: [
      "检查盲道是否从起点到终点连续铺设",
      "检查盲道在路口是否与提示盲道衔接",
      "检查盲道是否被路面设施（井盖、电杆等）打断"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.11.1", text: "盲道的铺设应保证视觉障碍者安全行走和辨别方向。", page: 6 },
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.11.2", text: "盲道铺设应避开障碍物，任何设施不得占用盲道。", page: 6 },
      { standardId: "gb50763", standardName: "GB 50763-2012", clauseNumber: "3.2.1", text: "盲道铺设的位置和走向，应方便视残者安全行走和顺利到达无障碍设施位置。", page: 15 }
    ]
  },
  {
    id: "blind-road-occupied",
    category: "盲道",
    title: "盲道被占用",
    description: "盲道被共享单车、机动车、摊贩、垃圾桶等占用，导致视觉障碍者无法安全通行",
    checkPoints: [
      "检查盲道上是否有停放车辆",
      "检查盲道上是否有摊贩经营",
      "检查盲道上是否有市政设施占用"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.11.2", text: "盲道铺设应避开障碍物，任何设施不得占用盲道。", page: 6 }
    ]
  },
  {
    id: "blind-road-irregular",
    category: "盲道",
    title: "盲道铺设不规范",
    description: "行进盲道与提示盲道混用、铺设方向错误、颜色与路面无明显差异",
    checkPoints: [
      "检查行进盲道是否为条状形",
      "检查提示盲道是否为圆点形",
      "检查盲道颜色是否与路面形成差异"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.11.3", text: "需要安全警示和提示处应设置提示盲道。", page: 6 },
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.11.4", text: "盲道应与相邻人行道铺面的颜色或材质形成差异。", page: 6 }
    ]
  },
  {
    id: "blind-road-obstacle-distance",
    category: "盲道",
    title: "盲道与障碍物距离不足",
    description: "盲道距围墙、绿化带、树池、路缘石等固定障碍物距离不符合标准要求",
    checkPoints: [
      "检查盲道距围墙、花台、绿化带是否为250mm-500mm",
      "检查盲道距树池边缘是否为250mm-500mm",
      "检查盲道与路缘石距离：同一水平面时不小于500mm，低于路缘石时不小于250mm",
      "检查盲道是否避开了电线杆、路灯杆、拉线等障碍物",
      "检查盲道是否避开了非机动车停放位置",
      "【深圳】检查盲道距离绿化带不应小于250mm",
      "【深圳】检查盲道与非机动车道边界距离不应小于500mm"
    ],
    relatedClauses: [
      { standardId: "gb50763", standardName: "GB 50763-2012", clauseNumber: "3.2.2", text: "行进盲道宜在距围墙、花台、绿化带250mm-500mm处设置；行进盲道宜在距树池边缘250mm-500mm处设置；盲道应避开树木(穴)、电线杆、拉线等障碍物。", page: 18 },
      { standardId: "sjg103", standardName: "SJG 103-2021", clauseNumber: "5.2.2", text: "人行道与非机动车道同标高设置时，盲道与非机动车道边界之间宜设置绿化分隔带，盲道距离绿化带不应小于250mm；当无法设置绿化分隔带时，盲道与非机动车道边界距离不应小于500mm。", page: 17 }
    ]
  },
  {
    id: "curb-ramp-missing",
    category: "缘石坡道",
    title: "缘石坡道缺失",
    description: "人行道口存在高差但未设置缘石坡道，轮椅和推车无法通行",
    checkPoints: [
      "检查所有人行道口是否设有缘石坡道",
      "检查缘石坡道是否覆盖整个人行道宽度"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.10.1", text: "各种路口、出入口和人行横道处，有高差时应设置缘石坡道。", page: 5 },
      { standardId: "gb50763", standardName: "GB 50763-2012", clauseNumber: "3.1.1", text: "缘石坡道的坡面应平整、防滑。", page: 10 }
    ]
  },
  {
    id: "ramp-too-steep",
    category: "坡道",
    title: "坡道过陡",
    description: "轮椅坡道纵向坡度大于1:12，或缘石坡道坡度不符合标准要求",
    checkPoints: [
      "测量坡道纵向坡度是否超过1:12",
      "测量坡道横向坡度是否超过1:50"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.3.1", text: "轮椅坡道的坡度和坡段提升高度应符合下列规定：纵向坡度不应大于1:12。", page: 3 }
    ]
  },
  {
    id: "ramp-too-narrow",
    category: "坡道",
    title: "坡道/通道过窄",
    description: "无障碍通道或轮椅坡道净宽不足1.20m，人员密集场所不足1.80m",
    checkPoints: [
      "测量通道净宽是否不小于1.20m",
      "测量人员密集场所通道净宽是否不小于1.80m"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.2.2", text: "无障碍通道的通行净宽不应小于1.20m，人员密集的公共场所的通行净宽不应小于1.80m。", page: 3 }
    ]
  },
  {
    id: "entrance-steps-only",
    category: "出入口",
    title: "出入口仅有台阶",
    description: "应设无障碍出入口的位置仅设置了台阶，未配套轮椅坡道或升降平台",
    checkPoints: [
      "检查公共建筑出入口是否设有平坡出入口或轮椅坡道",
      "检查既有建筑改造是否增设了无障碍设施"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.4.1", text: "无障碍出入口应为下列3种出入口之一：平坡出入口、同时设置台阶和轮椅坡道的出入口、同时设置台阶和升降平台的出入口。", page: 3 }
    ]
  },
  {
    id: "door-too-narrow",
    category: "出入口",
    title: "门通行净宽不足",
    description: "门开启后的通行净宽小于900mm，轮椅无法顺利通过",
    checkPoints: [
      "测量门开启后的通行净宽",
      "检查检票口、结算口是否设有轮椅通道"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.5.4", text: "新建和扩建建筑的门开启后的通行净宽不应小于900mm。", page: 4 },
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.2.3", text: "无障碍通道上的门洞口应满足轮椅通行，各类检票口、结算口等应设轮椅通道，通行净宽不应小于900mm。", page: 3 }
    ]
  },
  {
    id: "toilet-missing",
    category: "卫生间",
    title: "未设置无障碍卫生间",
    description: "公共场所缺少无障碍厕所或无障碍厕位，未满足轮椅使用者如厕需求",
    checkPoints: [
      "检查公共建筑是否设有无障碍厕所",
      "检查是否设有第三卫生间（无性别厕所）"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "3.2.1", text: "满足无障碍要求的公共卫生间（厕所）应符合下列规定。", page: 7 }
    ]
  },
  {
    id: "grab-bar-missing",
    category: "卫生间",
    title: "安全抓杆缺失或不规范",
    description: "无障碍厕位内未安装安全抓杆，或抓杆高度、位置、尺寸不符合标准要求",
    checkPoints: [
      "检查坐便器两侧是否安装安全抓杆",
      "检查抓杆安装高度是否为850mm-900mm"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "3.2.2", text: "无障碍厕位应符合下列规定。", page: 7 }
    ]
  },
  {
    id: "signage-missing",
    category: "其他",
    title: "无障碍标识缺失",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1-1-4-1-5 2-8 2-4 1-4 1z"/><line x1="12" y1="17" x2="12" y2="22"/></svg>`,
    description: "未设置国际通用无障碍标志，或标志位置、尺寸不符合要求",
    checkPoints: [
      "检查无障碍设施处是否设有无障碍标志",
      "检查标志是否从站立和座位角度都能看见"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "4.0.1", text: "无障碍标识应纳入室内外环境的标识系统。", page: 9 },
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "4.0.3", text: "无障碍设施处均应设置无障碍标识。", page: 9 }
    ]
  },
  {
    id: "manhole-too-wide",
    category: "其他",
    title: "井盖/箅子孔洞过大",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/></svg>`,
    description: "无障碍通道上的井盖、箅子孔洞宽度大于13mm，可能卡住拐杖头或轮椅小轮",
    checkPoints: [
      "检查井盖孔洞宽度是否不大于13mm",
      "检查条状孔洞是否垂直于通行方向"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.2.4", text: "无障碍通道上有井盖、箅子时，井盖、箅子孔洞的宽度或直径不应大于13mm，条状孔洞应垂直于通行方向。", page: 3 }
    ]
  },
  {
    id: "handrail-missing",
    category: "其他",
    title: "扶手缺失或不连续",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 8h12"/><path d="M6 16h12"/></svg>`,
    description: "楼梯、坡道两侧未设置扶手，或扶手中断不连续、高度不符合标准",
    checkPoints: [
      "检查楼梯两侧是否设有连续扶手",
      "检查扶手是否连贯不断开",
      "检查扶手高度是否为850mm-900mm"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "2.8.1", text: "满足无障碍要求的单层扶手的高度应为850mm～900mm；设置双层扶手时，上层扶手高度应为850mm～900mm，下层扶手高度应为650mm～700mm。", page: 5 }
    ]
  },
  {
    id: "low-service-missing",
    category: "其他",
    title: "低位服务设施缺失",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><circle cx="12" cy="15" r="1.5"/></svg>`,
    description: "服务台、饮水机、自动售货机等设施未考虑轮椅使用者的可达高度",
    checkPoints: [
      "检查服务台是否设有低位服务窗口",
      "检查低位服务台面高度是否在700mm-850mm范围内"
    ],
    relatedClauses: [
      { standardId: "gb55019", standardName: "GB 55019-2021", clauseNumber: "3.6.1", text: "为公众提供服务的各类服务台均应设置低位服务设施，包括问询台、接待处、业务台、收银台、借阅台等。", page: 8 }
    ]
  }
];

/**
 * Category icon SVG map
 */
const categoryIcons = {
  "盲道": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  "坡道": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M4 20l8-16"/><path d="M12 4l8 16"/><circle cx="17" cy="9" r="1" fill="currentColor"/><path d="M17 10l-3 6"/></svg>`,
  "缘石坡道": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="20" height="6" rx="1"/><path d="M6 14v-4"/><path d="M6 10l12-6"/><path d="M18 4v10"/></svg>`,
  "出入口": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 3v18"/></svg>`,
  "卫生间": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/></svg>`,
  "其他": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
};

/**
 * CommonIssues module
 */
const CommonIssues = (() => {
  let currentCategory = 'all';

  /**
   * Initialize the common issues section
   */
  function init() {
    renderIssues(commonIssues);
    bindCategoryTabs();
  }

  /**
   * Bind click events to category tabs
   */
  function bindCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active state
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        currentCategory = tab.dataset.category;
        const filtered = currentCategory === 'all'
          ? commonIssues
          : commonIssues.filter(issue => issue.category === currentCategory);

        renderIssues(filtered);
      });
    });
  }

  /**
   * Render issue cards
   * @param {Array} issues - list of issue objects
   */
  function renderIssues(issues) {
    const container = document.getElementById('common-issues-list');
    if (!container) return;

    if (issues.length === 0) {
      container.innerHTML = `
        <div class="search-empty" style="grid-column: 1 / -1;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 15s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          <p>该分类下暂无常见问题</p>
        </div>
      `;
      return;
    }

    container.innerHTML = issues.map(issue => createIssueCard(issue)).join('');
    bindCardToggles();
  }

  /**
   * Create HTML for a single issue card
   * @param {Object} issue
   * @returns {string} HTML string
   */
  function createIssueCard(issue) {
    const icon = issue.icon || categoryIcons[issue.category] || categoryIcons["其他"];

    const checkPointsHtml = issue.checkPoints.map(cp =>
      `<li>${escapeHtml(cp)}</li>`
    ).join('');

    const relatedClausesHtml = issue.relatedClauses.map(clause => {
      // Find pdfFile from standards data if available
      const pdfFile = findPdfFile(clause.standardId);
      return `
        <div class="related-clause-item">
          <div class="related-clause-header">
            <span class="related-clause-number">${escapeHtml(clause.clauseNumber)}</span>
            <span class="badge badge-type-${getTypeClass(clause.standardId)}">${escapeHtml(clause.standardName)}</span>
          </div>
          <div class="related-clause-text">${escapeHtml(clause.text)}</div>
          <div class="related-clause-actions">
            <button class="btn btn-pdf" onclick="openPdf('${pdfFile}', ${clause.page})" aria-label="查看 ${clause.clauseNumber} PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              查看PDF
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="issue-card" data-issue-id="${issue.id}">
        <div class="issue-card-header" tabindex="0" role="button" aria-expanded="false" aria-controls="issue-body-${issue.id}">
          <div class="issue-card-icon">${icon}</div>
          <div class="issue-card-info">
            <div class="issue-card-title">${escapeHtml(issue.title)}</div>
            <div class="issue-card-desc">${escapeHtml(issue.description)}</div>
          </div>
          <div class="issue-card-toggle" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
        <div class="issue-card-body" id="issue-body-${issue.id}">
          <div class="issue-check-points">
            <h3>检查要点</h3>
            <ul>${checkPointsHtml}</ul>
          </div>
          <div class="issue-related-clauses">
            <h3>关联标准条文</h3>
            ${relatedClausesHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind toggle events to issue card headers
   */
  function bindCardToggles() {
    document.querySelectorAll('.issue-card-header').forEach(header => {
      const toggle = () => {
        const card = header.closest('.issue-card');
        const body = card.querySelector('.issue-card-body');
        const toggleIcon = header.querySelector('.issue-card-toggle');
        const isOpen = body.classList.contains('open');

        if (isOpen) {
          body.classList.remove('open');
          toggleIcon.classList.remove('open');
          header.setAttribute('aria-expanded', 'false');
        } else {
          body.classList.add('open');
          toggleIcon.classList.add('open');
          header.setAttribute('aria-expanded', 'true');
        }
      };

      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /**
   * Find PDF file path for a standard ID
   * @param {string} standardId
   * @returns {string} PDF file path
   */
  function findPdfFile(standardId) {
    if (typeof window.standardsData !== 'undefined' && window.standardsData.standards) {
      const std = window.standardsData.standards.find(s => s.id === standardId);
      if (std) return std.pdfFile;
    }
    // Fallback - 包含所有三个标准的映射
    const map = {
      'gb55019': 'pdf/gb55019-2021.pdf',
      'gb50763': 'pdf/gb50763-2012.pdf',
      'sjg103': 'pdf/sjg103-2021.pdf'
    };
    return map[standardId] || 'pdf/gb55019-2021.pdf';
  }

  /**
   * Get type badge class for a standard ID
   * @param {string} standardId
   * @returns {string}
   */
  function getTypeClass(standardId) {
    if (standardId === 'gb55019') return 'full';
    if (standardId === 'gb50763') return 'partial';
    return 'local';
  }

  /**
   * Escape HTML special characters
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init };
})();
