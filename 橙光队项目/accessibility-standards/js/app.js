/**
 * 橙光队无障碍督导标准查询 - 主应用逻辑
 * Copyright © 2025 Wayhhow
 * Licensed under MIT
 * https://github.com/Wayhhow/accessibility-standards
 */

/**
 * app.js
 * Main Application - initialization, data loading, PDF helper, theme, back-to-top
 */

(function () {
  'use strict';

  /**
   * Open PDF at a specific page in a new tab
   * @param {string} pdfFile - relative path to the PDF file
   * @param {number} page - page number (1-based)
   */
  window.openPdf = function (pdfFile, page) {
    let fileParam;
    if (pdfFile.startsWith('pdf/')) {
      fileParam = '../../' + pdfFile.substring(4);
    } else {
      fileParam = '../' + pdfFile;
    }
    const viewerUrl = `pdf/lib/web/viewer.html?file=${encodeURIComponent(fileParam)}#page=${page}`;
    window.open(viewerUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * Load JSON data from a URL
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async function loadJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to load ${url}:`, error);
      return null;
    }
  }

  /**
   * Show loading state in outline tree
   */
  function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          <p style="margin-top: 12px;">正在加载数据...</p>
        </div>
      `;
    }
  }

  /**
   * Show error state
   */
  function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="search-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p>${message || '数据加载失败，请刷新页面重试'}</p>
        </div>
      `;
    }
  }

  /* ===== Theme Management ===== */

  /**
   * Initialize theme based on saved preference or system preference
   */
  function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    // Update icon visibility
    updateThemeIcon();

    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  /**
   * Set theme and persist to localStorage
   * @param {string} theme - 'light' or 'dark'
   */
  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
    updateThemeIcon();
  }

  /**
   * Update theme toggle icon based on current theme
   */
  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const lightIcon = document.querySelector('.theme-icon-light');
    const darkIcon = document.querySelector('.theme-icon-dark');
    const toggleBtn = document.getElementById('theme-toggle');

    if (lightIcon) lightIcon.style.display = isDark ? 'none' : 'block';
    if (darkIcon) darkIcon.style.display = isDark ? 'block' : 'none';
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? '切换浅色模式' : '切换深色模式');
      toggleBtn.setAttribute('title', isDark ? '切换浅色模式' : '切换深色模式');
    }
  }

  /* ===== Back to Top ===== */

  /**
   * Initialize back-to-top button
   */
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 400) {
            btn.classList.add('visible');
          } else {
            btn.classList.remove('visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ===== Header Scroll Effect ===== */

  /**
   * Initialize header glassmorphism effect on scroll
   */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 10) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ===== Main Init ===== */

  /**
   * Initialize the application
   */
  async function init() {
    // Show loading state
    showLoading('outline-tree');

    // Load data files in parallel
    const [standardsData, searchIndexData] = await Promise.all([
      loadJson('data/standards.json'),
      loadJson('data/search-index.json')
    ]);

    // Store standards data globally for other modules
    if (standardsData) {
      window.standardsData = standardsData;
    }

    // Initialize modules
    if (searchIndexData && searchIndexData.entries) {
      Search.init(searchIndexData.entries);
    } else {
      console.warn('Search index not loaded, search will be unavailable.');
      Search.init([]);
    }

    if (standardsData && standardsData.standards) {
      Outline.init(standardsData);
    } else {
      showError('outline-tree', '标准数据加载失败，请检查网络连接后刷新页面');
    }

    // Common issues module uses embedded data, no async loading needed
    CommonIssues.init();

    // Initialize UI features
    initTheme();
    initBackToTop();
    initHeaderScroll();

    // Set up keyboard shortcut: Ctrl+K or Cmd+K to focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Escape to clear search
      if (e.key === 'Escape') {
        const searchInput = document.getElementById('search-input');
        const resultsSection = document.getElementById('search-results-section');
        if (document.activeElement === searchInput && resultsSection && resultsSection.style.display !== 'none') {
          Search.clearSearch();
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
