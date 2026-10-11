/**
 * 橙光队无障碍督导标准查询 - 标准大纲
 * Copyright © 2025 Wayhhow
 * Licensed under MIT
 * https://github.com/Wayhhow/accessibility-standards
 */

/**
 * outline.js
 * Outline Module - expandable/collapsible tree structure for standards
 */

const Outline = (() => {
  let standardsData = [];
  let currentStandardId = 'all';

  /**
   * Initialize the outline module
   * @param {Object} data - standards data object with standards array
   */
  function init(data) {
    standardsData = data.standards || [];
    renderTabs();
    renderOutline();
    bindExpandCollapseButtons();
  }

  /**
   * Render standard selection tabs
   */
  function renderTabs() {
    const tabsContainer = document.querySelector('.standard-tabs');
    if (!tabsContainer) return;

    // "All" tab
    let tabsHtml = `
      <button class="standard-tab active" role="tab" aria-selected="true" data-standard="all">
        全部标准
      </button>
    `;

    // One tab per standard
    standardsData.forEach(std => {
      tabsHtml += `
        <button class="standard-tab" role="tab" aria-selected="false" data-standard="${escapeHtml(std.id)}">
          ${escapeHtml(std.shortName)}
        </button>
      `;
    });

    tabsContainer.innerHTML = tabsHtml;
    bindTabEvents();
  }

  /**
   * Bind tab click events
   */
  function bindTabEvents() {
    const tabs = document.querySelectorAll('.standard-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        currentStandardId = tab.dataset.standard;
        renderOutline();
      });
    });
  }

  /**
   * Render the outline tree based on current filter
   */
  function renderOutline() {
    const container = document.getElementById('outline-tree');
    if (!container) return;

    const filteredStandards = currentStandardId === 'all'
      ? standardsData
      : standardsData.filter(s => s.id === currentStandardId);

    if (filteredStandards.length === 0) {
      container.innerHTML = `
        <div class="search-empty">
          <p>暂无标准数据</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredStandards.map(std => renderStandard(std)).join('');
    bindToggleEvents();
  }

  /**
   * Render a single standard (all its chapters)
   * @param {Object} standard
   * @returns {string} HTML string
   */
  function renderStandard(standard) {
    const chapters = standard.chapters || [];
    if (chapters.length === 0) return '';

    const typeBadgeClass = getTypeBadgeClass(standard.type);
    const standardHeader = `
      <div style="padding: 10px 16px; background: var(--primary-light); border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong style="font-size: 0.9rem; color: var(--primary-dark);">${escapeHtml(standard.shortName)}</strong>
          <span style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(standard.fullName)}</span>
          <span class="badge badge-type-${typeBadgeClass}">${escapeHtml(standard.type)}</span>
        </div>
      </div>
    `;

    const chaptersHtml = chapters.map(ch => renderChapter(ch, standard)).join('');

    return `
      <div class="outline-standard" data-standard-id="${standard.id}">
        ${standardHeader}
        ${chaptersHtml}
      </div>
    `;
  }

  /**
   * Render a chapter
   * @param {Object} chapter
   * @param {Object} standard - parent standard for PDF link
   * @returns {string} HTML string
   */
  function renderChapter(chapter, standard) {
    const sections = chapter.sections || [];
    const directClauses = chapter.clauses || [];
    const hasContent = sections.length > 0 || directClauses.length > 0;

    // Sort sections by number
    const sortedSections = [...sections].sort((a, b) => compareNumbers(a.number, b.number));
    const sortedDirectClauses = [...directClauses].sort((a, b) => compareNumbers(a.number, b.number));

    const sectionsHtml = sortedSections.map(sec => renderSection(sec, standard)).join('');
    const directClausesHtml = sortedDirectClauses.map(cl => renderClause(cl, standard)).join('');

    return `
      <div class="outline-chapter" role="treeitem" aria-expanded="false">
        <button class="outline-chapter-header" aria-expanded="false" aria-controls="chapter-body-${standard.id}-${chapter.number}">
          <span class="outline-toggle" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
          <span class="outline-chapter-number">${escapeHtml(chapter.number)}</span>
          <span class="outline-chapter-title">${escapeHtml(chapter.title)}</span>
        </button>
        <div class="outline-chapter-body" id="chapter-body-${standard.id}-${chapter.number}" role="group">
          ${sectionsHtml}
          ${directClausesHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a section
   * @param {Object} section
   * @param {Object} standard
   * @returns {string} HTML string
   */
  function renderSection(section, standard) {
    const clauses = section.clauses || [];
    const sortedClauses = [...clauses].sort((a, b) => compareNumbers(a.number, b.number));

    const clausesHtml = sortedClauses.map(cl => renderClause(cl, standard)).join('');

    return `
      <div class="outline-section" role="treeitem" aria-expanded="false">
        <button class="outline-section-header" aria-expanded="false" aria-controls="section-body-${standard.id}-${section.number}">
          <span class="outline-toggle" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
          <span class="outline-section-number">${escapeHtml(section.number)}</span>
          <span>${escapeHtml(section.title)}</span>
        </button>
        <div class="outline-section-body" id="section-body-${standard.id}-${section.number}" role="group">
          ${clausesHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single clause
   * @param {Object} clause
   * @param {Object} standard
   * @returns {string} HTML string
   */
  function renderClause(clause, standard) {
    const mandatoryBadge = clause.isMandatory
      ? '<span class="badge badge-mandatory">强制性</span>'
      : '';

    return `
      <div class="outline-clause" role="treeitem">
        <div class="outline-clause-header">
          <span class="outline-clause-number">${escapeHtml(clause.number)}</span>
          <div class="outline-clause-badges">${mandatoryBadge}</div>
        </div>
        <div class="outline-clause-text">${escapeHtml(clause.text)}</div>
        <div class="outline-clause-actions">
          <button class="btn btn-pdf" onclick="openPdf('${standard.pdfFile}', ${clause.page})" aria-label="查看 ${clause.number} PDF 第${clause.page}页">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            查看PDF (第${clause.page}页)
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Bind toggle events for chapter and section headers
   * Includes localStorage persistence for expand state
   */
  function bindToggleEvents() {
    // 恢复保存的展开状态
    restoreExpandState();

    // Chapter toggles
    document.querySelectorAll('.outline-chapter-header').forEach(header => {
      const body = header.nextElementSibling;
      const toggleIcon = header.querySelector('.outline-toggle');
      const chapterId = body ? body.id : '';
      
      header.addEventListener('click', () => {
        if (!body) return;
        const isOpen = body.classList.toggle('open');
        if (toggleIcon) toggleIcon.classList.toggle('open', isOpen);
        header.classList.toggle('open', isOpen);
        header.setAttribute('aria-expanded', String(isOpen));
        // 保存展开状态
        if (chapterId) saveExpandState(chapterId, isOpen);
      });
    });

    // Section toggles
    document.querySelectorAll('.outline-section-header').forEach(header => {
      const body = header.nextElementSibling;
      const toggleIcon = header.querySelector('.outline-toggle');
      const sectionId = body ? body.id : '';
      
      header.addEventListener('click', () => {
        if (!body) return;
        const isOpen = body.classList.toggle('open');
        if (toggleIcon) toggleIcon.classList.toggle('open', isOpen);
        header.classList.toggle('open', isOpen);
        header.setAttribute('aria-expanded', String(isOpen));
        // 保存展开状态
        if (sectionId) saveExpandState(sectionId, isOpen);
      });
    });
  }

  /**
   * Save expand state to localStorage
   * @param {string} id - element id
   * @param {boolean} isOpen - expand state
   */
  function saveExpandState(id, isOpen) {
    try {
      const state = JSON.parse(localStorage.getItem('outlineExpandState') || '{}');
      if (isOpen) {
        state[id] = true;
      } else {
        delete state[id];
      }
      localStorage.setItem('outlineExpandState', JSON.stringify(state));
    } catch (e) {
      // localStorage不可用时忽略
    }
  }

  /**
   * Restore expand state from localStorage
   */
  function restoreExpandState() {
    try {
      const state = JSON.parse(localStorage.getItem('outlineExpandState') || '{}');
      Object.keys(state).forEach(id => {
        const body = document.getElementById(id);
        if (body) {
          body.classList.add('open');
          const header = body.previousElementSibling;
          if (header) {
            header.classList.add('open');
            header.setAttribute('aria-expanded', 'true');
            const toggle = header.querySelector('.outline-toggle');
            if (toggle) toggle.classList.add('open');
          }
        }
      });
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * Expand all chapters and sections
   */
  function expandAll() {
    document.querySelectorAll('.outline-chapter-body, .outline-section-body').forEach(body => {
      body.classList.add('open');
      const id = body.id;
      if (id) saveExpandState(id, true);
    });
    document.querySelectorAll('.outline-toggle, .outline-chapter-header, .outline-section-header').forEach(el => {
      el.classList.add('open');
      if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', 'true');
    });
  }

  /**
   * Collapse all chapters and sections
   */
  function collapseAll() {
    document.querySelectorAll('.outline-chapter-body, .outline-section-body').forEach(body => {
      body.classList.remove('open');
      const id = body.id;
      if (id) saveExpandState(id, false);
    });
    document.querySelectorAll('.outline-toggle, .outline-chapter-header, .outline-section-header').forEach(el => {
      el.classList.remove('open');
      if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Bind expand/collapse all buttons
   */
  function bindExpandCollapseButtons() {
    const expandBtn = document.getElementById('expand-all-btn');
    const collapseBtn = document.getElementById('collapse-all-btn');

    if (expandBtn) {
      expandBtn.addEventListener('click', expandAll);
    }
    if (collapseBtn) {
      collapseBtn.addEventListener('click', collapseAll);
    }
  }

  /**
   * Compare two clause/section numbers for sorting
   * Handles mixed numeric parts like "2.1", "2.10", "2.1.1"
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function compareNumbers(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA !== numB) return numA - numB;
    }

    return 0;
  }

  /**
   * Get badge class for standard type
   * @param {string} type
   * @returns {string}
   */
  function getTypeBadgeClass(type) {
    switch (type) {
      case '全文强制性': return 'full';
      case '部分强制': return 'partial';
      default: return 'local';
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, expandAll, collapseAll };
})();
