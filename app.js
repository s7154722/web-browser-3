(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    welcome: $('welcome'), browser: $('browser'), searchForm: $('searchForm'), searchInput: $('searchInput'),
    addressForm: $('addressForm'), addressInput: $('addressInput'), tabs: $('tabs'), resultsView: $('resultsView'),
    resultsHeading: $('resultsHeading'), resultsMeta: $('resultsMeta'), resultsList: $('resultsList'),
    frameWrap: $('frameWrap'), frame: $('pageFrame'), browserEmpty: $('browserEmpty'), bookmarkList: $('bookmarkList'),
    bookmarkButton: $('bookmarkButton'), backButton: $('backButton'), forwardButton: $('forwardButton'), toast: $('toast')
  };

  const STORAGE_KEY = 'webspace-bookmarks-v1';
  let bookmarks = readBookmarks();
  let tabs = [{ id: makeId(), title: 'New tab', url: '', history: [], historyIndex: -1, mode: 'empty', query: '' }];
  let activeTabId = tabs[0].id;
  let toastTimer;

  function makeId() { return Math.random().toString(36).slice(2, 10); }
  function readBookmarks() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(x => x && typeof x.url === 'string' && typeof x.title === 'string') : [];
    } catch { return []; }
  }
  function activeTab() { return tabs.find(t => t.id === activeTabId) || tabs[0]; }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
  }
  function showBrowser() {
    els.welcome.hidden = true;
    els.browser.hidden = false;
    renderTabs();
    renderCurrent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showHome() {
    els.browser.hidden = true;
    els.welcome.hidden = false;
    renderBookmarks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function safeUrl(raw) {
    const input = String(raw || '').trim();
    if (!input) return null;
    if (/^(javascript|data|vbscript):/i.test(input)) return null;
    let candidate = input;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[\w-]+\.[a-z]{2,})(?::\d+)?(?:\/|$)/i.test(candidate)) candidate = 'https://' + candidate;
      else return null;
    }
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.href;
    } catch { return null; }
  }
  function isLikelyUrl(value) {
    const v = value.trim();
    return /^(https?:\/\/|localhost(?::|\/|$)|[\w-]+\.[a-z]{2,}(?::\d+)?(?:\/|$))/i.test(v);
  }
  function pushNavigation(tab, mode, value, title) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push({ mode, value, title });
    tab.historyIndex = tab.history.length - 1;
    applyNavigation(tab, mode, value, title);
  }
  function applyNavigation(tab, mode, value, title) {
    tab.mode = mode;
    tab.url = mode === 'page' ? value : '';
    tab.query = mode === 'search' ? value : '';
    tab.title = title || (mode === 'page' ? new URL(value).hostname : mode === 'search' ? `Search: ${value}` : 'New tab');
    if (tab.id === activeTabId) {
      renderTabs();
      renderCurrent();
    }
  }
  function navigate(raw) {
    const value = String(raw || '').trim();
    if (!value) return;
    const tab = activeTab();
    const url = safeUrl(value);
    if (url) {
      pushNavigation(tab, 'page', url, new URL(url).hostname.replace(/^www\./, ''));
      return;
    }
    if (isLikelyUrl(value)) {
      showToast('That address does not look valid. Try a full website address.');
      return;
    }
    search(value);
  }
  function search(query) {
    const tab = activeTab();
    // applyNavigation() renders the search view and makes the single API request.
    pushNavigation(tab, 'search', query, `Search: ${query}`);
  }
  function renderResults(data, query) {
    const results = Array.isArray(data.results) ? data.results : [];
    els.resultsMeta.textContent = `${results.length} results · Search powered by DuckDuckGo`;
    els.resultsList.innerHTML = '';
    if (!results.length) {
      const p = document.createElement('p');
      p.className = 'no-results';
      p.textContent = 'No results came back. Try a different search phrase.';
      els.resultsList.appendChild(p);
      return;
    }
    results.forEach(result => {
      const card = document.createElement('article');
      card.className = 'result-card';
      const domain = document.createElement('div');
      domain.className = 'result-domain';
      domain.textContent = result.domain || result.url;
      const title = document.createElement('a');
      title.className = 'result-title';
      title.href = result.url;
      title.textContent = result.title || result.url;
      title.addEventListener('click', event => { event.preventDefault(); navigate(result.url); });
      const snippet = document.createElement('p');
      snippet.className = 'result-snippet';
      snippet.textContent = result.snippet || 'Open this result to view the page.';
      const actions = document.createElement('div');
      actions.className = 'result-actions';
      const view = document.createElement('button');
      view.className = 'primary';
      view.textContent = 'View in WebSpace';
      view.addEventListener('click', () => navigate(result.url));
      const save = document.createElement('button');
      save.textContent = '☆ Save';
      save.addEventListener('click', () => addBookmark(result.url, result.title || result.domain || result.url));
      actions.append(view, save);
      card.append(domain, title, snippet, actions);
      els.resultsList.appendChild(card);
    });
  }
  function renderCurrent() {
    const tab = activeTab();
    els.resultsView.hidden = true;
    els.frameWrap.hidden = true;
    els.browserEmpty.hidden = true;
    els.addressInput.value = tab.mode === 'page' ? tab.url : tab.mode === 'search' ? tab.query : '';
    els.backButton.disabled = tab.historyIndex <= 0;
    els.forwardButton.disabled = tab.historyIndex >= tab.history.length - 1;
    els.bookmarkButton.textContent = tab.mode === 'page' && bookmarks.some(b => b.url === tab.url) ? '★' : '☆';
    if (tab.mode === 'search') {
      els.resultsView.hidden = false;
      els.resultsHeading.textContent = `Results for “${tab.query}”`;
      els.resultsMeta.textContent = 'Loading…';
      els.resultsList.innerHTML = '<div class="no-results">Loading results…</div>';
      searchResultsOnly(tab.query, tab.id);
    } else if (tab.mode === 'page') {
      els.frameWrap.hidden = false;
      els.frame.src = tab.url;
    } else {
      els.browserEmpty.hidden = false;
      els.frame.removeAttribute('src');
    }
  }
  async function searchResultsOnly(query, tabId) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (activeTabId === tabId && activeTab().mode === 'search' && activeTab().query === query) renderResults(data, query);
    } catch (e) {
      if (activeTabId !== tabId) return;
      els.resultsMeta.textContent = 'Search is temporarily unavailable.';
      els.resultsList.innerHTML = '<p class="search-error">The search service could not load results. Check your Pages Function deployment, then try again.</p>';
      console.error(e);
    }
  }
  function renderTabs() {
    els.tabs.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = tab.title;
      label.title = tab.title;
      label.addEventListener('click', () => { activeTabId = tab.id; renderTabs(); renderCurrent(); });
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.type = 'button';
      close.textContent = '×';
      close.title = 'Close tab';
      close.addEventListener('click', event => { event.stopPropagation(); closeTab(tab.id); });
      el.append(label, close);
      el.addEventListener('click', () => { activeTabId = tab.id; renderTabs(); renderCurrent(); });
      els.tabs.appendChild(el);
    });
  }
  function newTab() {
    const tab = { id: makeId(), title: 'New tab', url: '', history: [], historyIndex: -1, mode: 'empty', query: '' };
    tabs.push(tab); activeTabId = tab.id; showBrowser();
  }
  function closeTab(id) {
    if (tabs.length === 1) { tabs[0] = { id: makeId(), title: 'New tab', url: '', history: [], historyIndex: -1, mode: 'empty', query: '' }; activeTabId = tabs[0].id; }
    else {
      const index = tabs.findIndex(t => t.id === id);
      tabs = tabs.filter(t => t.id !== id);
      if (activeTabId === id) activeTabId = tabs[Math.max(0, index - 1)].id;
    }
    renderTabs(); renderCurrent();
  }
  function goHistory(direction) {
    const tab = activeTab();
    const next = tab.historyIndex + direction;
    if (next < 0 || next >= tab.history.length) return;
    tab.historyIndex = next;
    const item = tab.history[next];
    applyNavigation(tab, item.mode, item.value, item.title);
  }
  function addBookmark(url, title) {
    const safe = safeUrl(url);
    if (!safe) return;
    if (bookmarks.some(b => b.url === safe)) { showToast('This page is already saved.'); return; }
    bookmarks.unshift({ url: safe, title: title || new URL(safe).hostname });
    bookmarks = bookmarks.slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    renderBookmarks();
    const tab = activeTab();
    if (tab.mode === 'page' && tab.url === safe) els.bookmarkButton.textContent = '★';
    showToast('Page saved to this browser.');
  }
  function removeBookmark(url) {
    bookmarks = bookmarks.filter(b => b.url !== url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    renderBookmarks();
    renderCurrent();
  }
  function renderBookmarks() {
    els.bookmarkList.innerHTML = '';
    if (!bookmarks.length) {
      const empty = document.createElement('div'); empty.className = 'empty-bookmarks'; empty.textContent = 'Your saved pages will show up here.'; els.bookmarkList.appendChild(empty); return;
    }
    bookmarks.forEach(bookmark => {
      const chip = document.createElement('div'); chip.className = 'bookmark-chip';
      const open = document.createElement('button'); open.className = 'open-bookmark'; open.textContent = bookmark.title; open.title = bookmark.url;
      open.addEventListener('click', () => { showBrowser(); navigate(bookmark.url); });
      const remove = document.createElement('button'); remove.textContent = '×'; remove.title = 'Remove saved page'; remove.addEventListener('click', () => removeBookmark(bookmark.url));
      chip.append(open, remove); els.bookmarkList.appendChild(chip);
    });
  }

  els.searchForm.addEventListener('submit', event => { event.preventDefault(); const q = els.searchInput.value.trim(); if (q) { showBrowser(); navigate(q); } });
  els.addressForm.addEventListener('submit', event => { event.preventDefault(); navigate(els.addressInput.value); });
  els.backButton.addEventListener('click', () => goHistory(-1));
  els.forwardButton.addEventListener('click', () => goHistory(1));
  $('reloadButton').addEventListener('click', () => { const tab = activeTab(); if (tab.mode === 'page') els.frame.src = tab.url; else if (tab.mode === 'search') searchResultsOnly(tab.query, tab.id); });
  $('homeButton').addEventListener('click', showHome);
  $('browserHomeButton').addEventListener('click', () => { const tab = activeTab(); pushNavigation(tab, 'empty', '', 'New tab'); });
  $('homeViewButton').addEventListener('click', showHome);
  $('returnHomeButton').addEventListener('click', showHome);
  $('newTabButton').addEventListener('click', newTab);
  els.bookmarkButton.addEventListener('click', () => { const tab = activeTab(); if (tab.mode === 'page') addBookmark(tab.url, tab.title); else showToast('Open a page before saving it.'); });
  document.querySelectorAll('.quick-card').forEach(button => button.addEventListener('click', () => { showBrowser(); navigate(button.dataset.url); }));
  els.searchInput.addEventListener('keydown', event => { if (event.key === 'Escape') els.searchInput.value = ''; });
  renderBookmarks();
})();
