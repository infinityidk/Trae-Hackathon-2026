/**
 * 橙光队无障碍督导标准查询 - 搜索功能
 * Copyright © 2025 Wayhhow
 * Licensed under MIT
 * https://github.com/Wayhhow/accessibility-standards
 */

/**
 * search.js
 * Search Module - full-text search with debounce and highlighting
 */

const Search = (() => {
  let searchIndex = [];
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300;

  /**
   * Initialize the search module
   * @param {Array} indexData - search index entries
   */
  function init(indexData) {
    searchIndex = indexData || [];
    bindEvents();
  }

  /**
   * Bind search-related events
   */
  function bindEvents() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');
    const clearBtn = document.getElementById('clear-search-btn');

    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          performSearch(input.value.trim());
        }, DEBOUNCE_DELAY);
      });

      // Press Enter to search immediately
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(debounceTimer);
          performSearch(input.value.trim());
        }
      });
    }

    if (btn) {
      btn.addEventListener('click', () => {
        clearTimeout(debounceTimer);
        const input = document.getElementById('search-input');
        performSearch(input.value.trim());
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', clearSearch);
    }
  }

  /**
   * Perform search with the given query
   * @param {string} query - search query string
   */
  function performSearch(query) {
    const resultsSection = document.getElementById('search-results-section');
    const resultsContainer = document.getElementById('search-results');
    const resultsTitle = document.getElementById('search-results-title');

    if (!resultsSection || !resultsContainer) return;

    // Show/hide based on query
    if (!query) {
      resultsSection.style.display = 'none';
      return;
    }

    resultsSection.style.display = 'block';

    // Search
    const results = searchEntries(query);

    if (results.length === 0) {
      resultsTitle.textContent = `搜索 "${query}" - 未找到结果`;
      resultsContainer.innerHTML = renderEmptyResults(query);
      return;
    }

    resultsTitle.textContent = `搜索 "${query}" - 找到 ${results.length} 条结果`;
    resultsContainer.innerHTML = results.map(r => renderResultItem(r, query)).join('');

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Search entries by query
   * Supports space-separated keywords (all keywords must match)
   * @param {string} query
   * @returns {Array} matched and sorted entries
   */
  function searchEntries(query) {
    // 支持空格分词：将查询拆分为多个关键词
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    if (keywords.length === 0) return [];
    
    const results = [];

    for (const entry of searchIndex) {
      const textLower = entry.text.toLowerCase();
      const numberLower = entry.clauseNumber.toLowerCase();
      const chapterLower = (entry.chapterTitle || '').toLowerCase();
      const sectionLower = (entry.sectionTitle || '').toLowerCase();
      const standardLower = (entry.standardName || '').toLowerCase();

      // 检查每个关键词是否匹配（AND逻辑：所有关键词都必须匹配）
      let allMatch = true;
      let totalScore = 0;
      
      for (const keyword of keywords) {
        const textMatch = textLower.includes(keyword);
        const numberMatch = numberLower.includes(keyword);
        const chapterMatch = chapterLower.includes(keyword);
        const sectionMatch = sectionLower.includes(keyword);
        const standardMatch = standardLower.includes(keyword);

        if (!textMatch && !numberMatch && !chapterMatch && !sectionMatch && !standardMatch) {
          allMatch = false;
          break;
        }

        // 计算每个关键词的得分
        if (numberMatch) totalScore += 10;
        if (numberLower === keyword) totalScore += 20;
        if (chapterMatch) totalScore += 3;
        if (sectionMatch) totalScore += 3;
        if (standardMatch) totalScore += 2;
        if (textMatch) {
          totalScore += 5;
          // 统计出现次数
          let pos = textLower.indexOf(keyword);
          while (pos !== -1) {
            totalScore++;
            pos = textLower.indexOf(keyword, pos + 1);
          }
        }
      }

      if (allMatch) {
        results.push({ ...entry, score: totalScore });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Render a single search result item
   * @param {Object} entry - search result entry
   * @param {string} query - original query for highlighting
   * @returns {string} HTML string
   */
  function renderResultItem(entry, query) {
    const highlightedText = highlightText(entry.text, query);
    const typeBadgeClass = getTypeBadgeClass(entry.standardType);
    const mandatoryBadge = entry.isMandatory
      ? '<span class="badge badge-mandatory">强制性</span>'
      : '';

    // Build path
    const pathParts = [];
    if (entry.chapterTitle) pathParts.push(entry.chapterTitle);
    if (entry.sectionTitle) pathParts.push(entry.sectionTitle);
    const pathStr = pathParts.length > 0 ? pathParts.join(' > ') : '';

    return `
      <div class="search-result-item">
        <div class="search-result-header">
          <span class="search-result-number">${escapeHtml(entry.clauseNumber)}</span>
          <div class="search-result-badges">
            <span class="badge badge-type-${typeBadgeClass}">${escapeHtml(entry.standardName)}</span>
            ${mandatoryBadge}
          </div>
        </div>
        ${pathStr ? `<div class="search-result-path">${escapeHtml(pathStr)}</div>` : ''}
        <div class="search-result-text">${highlightedText}</div>
        <div class="search-result-actions">
          <button class="btn btn-pdf" onclick="openPdf('${entry.pdfFile}', ${entry.page})" aria-label="查看 ${entry.clauseNumber} PDF 第${entry.page}页">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            查看PDF (第${entry.page}页)
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render empty results with suggestions
   * @param {string} query
   * @returns {string} HTML string
   */
  function renderEmptyResults(query) {
    const suggestions = [
      '尝试使用更简短的关键词，如\u201C盲道\u201D、\u201C坡道\u201D、\u201C扶手\u201D',
      '搜索条文编号，如\u201C2.1.1\u201D、\u201C3.2.1\u201D',
      '搜索具体数值要求，如\u201C1:12\u201D、\u201C900mm\u201D、\u201C13mm\u201D',
      '搜索设施类型，如\u201C缘石坡道\u201D、\u201C无障碍电梯\u201D、\u201C低位服务设施\u201D'
    ];

    return `
      <div class="search-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        <p>未找到与 "${escapeHtml(query)}" 相关的条文</p>
        <div class="search-suggestions">
          <h3>搜索建议</h3>
          <ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  /**
   * Highlight matching text in a string
   * @param {string} text - original text
   * @param {string} query - search query
   * @returns {string} HTML with highlighted matches and context
   */
  function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return escapeHtml(text);

    // Context window: 30 chars before and after
    const CONTEXT = 30;
    let start = Math.max(0, index - CONTEXT);
    let end = Math.min(text.length, index + query.length + CONTEXT);

    // Try to break at word/character boundaries
    if (start > 0) {
      // Find a good break point (Chinese character boundary or space)
      let breakPoint = start;
      for (let i = start; i < start + 10 && i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ' || ch === '\u3002' || ch === '\uff0c' || ch === '\uff1b') {
          breakPoint = i + 1;
          break;
        }
      }
      start = breakPoint;
    }

    if (end < text.length) {
      let breakPoint = end;
      for (let i = end; i > end - 10 && i >= 0; i--) {
        const ch = text[i];
        if (ch === ' ' || ch === '\u3002' || ch === '\uff0c' || ch === '\uff1b') {
          breakPoint = i + 1;
          break;
        }
      }
      end = breakPoint;
    }

    let snippet = text.substring(start, end);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    // Escape HTML first
    snippet = escapeHtml(snippet);
    const escapedQuery = escapeHtml(query);

    // Highlight all occurrences in snippet
    const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
    snippet = snippet.replace(regex, '<mark>$1</mark>');

    return `${prefix}${snippet}${suffix}`;
  }

  /**
   * Escape special regex characters
   * @param {string} str
   * @returns {string}
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  /**
   * Clear search and hide results
   */
  function clearSearch() {
    const input = document.getElementById('search-input');
    const resultsSection = document.getElementById('search-results-section');

    if (input) input.value = '';
    if (resultsSection) resultsSection.style.display = 'none';

    // Focus back to search input
    if (input) input.focus();
  }

  return { init, performSearch, clearSearch };
})();
