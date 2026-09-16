/**
 * End-to-end UI test: boots the real index.html in jsdom, runs the real
 * scripts, then drives the interface like a user would.
 *
 *   npm run test:ui      (needs: npm install --save-dev jsdom)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = join(__dirname, '..');

function boot({ theme, done, bookmarks } = {}) {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:4173/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // jsdom stubs: things every real browser provides
  window.matchMedia = window.matchMedia || ((query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  window.confirm = () => true;
  window.open = (url) => {
    window.__opened = (window.__opened || []).concat(url);
    return null;
  };
  if (!window.Element.prototype.scrollIntoView) {
    window.Element.prototype.scrollIntoView = function () {};
  }
  if (theme) window.localStorage.setItem('codepath:theme', JSON.stringify(theme));
  if (done) window.localStorage.setItem('codepath:done', done);
  if (bookmarks) window.localStorage.setItem('codepath:bookmarks', bookmarks);

  ['js/data.js', 'js/core.js', 'js/app.js'].forEach((file) => {
    window.eval(readFileSync(join(ROOT, file), 'utf8'));
  });
  // jsdom fires DOMContentLoaded on the next tick; call the same init the
  // browser would call so the test is synchronous and deterministic.
  window.CodePathApp.init();

  return { dom, window, document: window.document };
}

const $ = (window, sel) => window.document.querySelector(sel);
const $$ = (window, sel) => Array.from(window.document.querySelectorAll(sel));
const cardTitles = (window) => $$(window, '.card .card-title').map((n) => n.textContent);
const visibleCards = (window) => $$(window, '.card').length;
const tabByText = (window, text) => $$(window, '.tab').find((t) => t.textContent.includes(text));

test('renders every section tab and every topic card', () => {
  const { window } = boot();
  const tabs = $$(window, '.tab');
  assert.equal(tabs.length, 10, 'All + Favourites + 8 sections');
  assert.equal(tabs[0].textContent.includes('All'), true);
  assert.equal(tabs[0].getAttribute('aria-pressed'), 'true', 'All tab starts active');
  assert.equal(tabs[1].textContent.includes('Favourites'), true);
  assert.equal(tabs[9].textContent.includes('Projects'), true);
  assert.equal($$(window, '.tab').filter((t) => t.getAttribute('aria-pressed') === 'true').length, 1);

  assert.equal(visibleCards(window), 92);
  assert.equal($$(window, '.section').length, 8, 'one block per section');
  assert.equal($$(window, '.section-progress .bar span').length, 8);
});

test('stats, ring and footer show real numbers', () => {
  const { window } = boot();
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed');
  assert.equal($(window, '#ringText').textContent, '0%');
  assert.equal($(window, '#ringValue').getAttribute('stroke-dashoffset'), '175.93');
  assert.match($(window, '#footStats').textContent, /92 topics/);
  assert.match($(window, '#brandTagline').textContent, /YouTube/i);
  assert.equal($(window, '#btnContinue').hidden, false, 'continue button is offered');
});

test('every card opens YouTube: unique, well-formed, encoded links', () => {
  const { window } = boot();
  const links = $$(window, '.card-link');
  assert.equal(links.length, 92);
  const urls = new Set();
  for (const link of links) {
    const href = link.getAttribute('href');
    assert.match(href, /^https:\/\/www\.youtube\.com\/results\?search_query=[^\s"<>]+$/, href);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.ok(link.getAttribute('aria-label').length > 10, 'has an accessible name');
    urls.add(href);
  }
  assert.ok(urls.size > 85, 'links are topic-specific, not duplicated');
});

test('channel chips link to that channel and the primary chip is first', () => {
  const { window } = boot();
  const card = $$(window, '.card').find((c) => c.querySelector('.card-title').textContent === 'Graph');
  const chips = Array.from(card.querySelectorAll('.chip'));
  assert.equal(chips[0].className.includes('chip-primary'), true);
  assert.match(chips[0].textContent, /Watch on YouTube/);
  assert.equal(chips[0].getAttribute('href'), card.querySelector('.card-link').getAttribute('href'));

  const names = chips.slice(1).map((c) => c.textContent);
  assert.deepEqual(names, ['Striver', 'William Fiset', 'Abdul Bari']);
  assert.match(chips[1].getAttribute('href'), /Graph%20Striver$/);
});

test('tapping a section button shows only that section', () => {
  const { window, document } = boot();
  const dsaTab = $$(window, '.tab').find((t) => t.textContent.includes('DSA'));
  dsaTab.click();

  assert.equal(visibleCards(window), 17);
  assert.equal($$(window, '.section').length, 1);
  assert.equal($(window, '.section').id, 'section-dsa');
  assert.equal(dsaTab.isConnected, false, 'tabs are re-rendered on every change');
  assert.equal(
    $$(window, '.tab').find((t) => t.textContent.includes('DSA')).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal($$(window, '.tab')[0].getAttribute('aria-pressed'), 'false');
  assert.equal(window.location.hash, '#dsa');
  assert.ok(document.getElementById('toasts').textContent.includes('DSA'));
  assert.equal($$(window, '.tab').length, 10, 'all section buttons stay available');

  // and back to All
  $$(window, '.tab')[0].click();
  assert.equal(visibleCards(window), 92);
  assert.equal(window.location.hash, '');
});

test('search filters live across sections and reports the count', () => {
  const { window } = boot();
  const input = $(window, '#search');
  input.value = 'joins';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));

  assert.equal(visibleCards(window), 1);
  assert.deepEqual(cardTitles(window), ['SQL Joins']);
  assert.match($(window, '#statHint').textContent, /Showing 1 of 92 topics/);
  assert.equal($(window, '#btnClearSearch').hidden, false);

  // two-word query is ANDed
  input.value = 'binary search';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const titles = cardTitles(window);
  assert.ok(titles.includes('Binary Search (patterns)'));
  assert.ok(titles.includes('Binary Search Tree (BST)'));
  assert.ok(!titles.includes('SQL Joins'));

  // Escape clears it
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(input.value, '');
  assert.equal(visibleCards(window), 92);
});

test('no-match search shows a helpful empty state that can be cleared', () => {
  const { window } = boot();
  const input = $(window, '#search');
  input.value = 'qqqzzz';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));

  const empty = $(window, '.empty');
  assert.ok(empty, 'empty state is rendered');
  assert.match(empty.textContent, /No topics match/);
  assert.equal(visibleCards(window), 0);

  empty.querySelector('[data-action="clear-query"]').click();
  assert.equal(visibleCards(window), 92);
  assert.equal($(window, '#search').value, '');
});

test('marking a topic done updates card, stats, tab and localStorage', () => {
  const { window } = boot();
  const first = $$(window, '.card')[0];
  const title = first.querySelector('.card-title').textContent;
  const toggle = first.querySelector('.done-toggle');

  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(toggle.textContent.includes('Mark done'), true);
  toggle.click();

  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(toggle.textContent.includes('Completed'), true);
  assert.equal(first.className.includes('is-done'), true);
  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed');
  assert.equal($(window, '#ringText').textContent, '1%');
  assert.match($(window, '.section-progress small').textContent, /^1\/17 done · 6%$/);
  assert.equal(tabByText(window, 'Programming').querySelector('.tab-count').textContent, '1/17');
  assert.ok($(window, '#toasts').textContent.includes(title));

  const saved = JSON.parse(window.localStorage.getItem('codepath:done'));
  assert.deepEqual(Object.keys(saved), ['programming::Roadmap: How to Start Coding']);

  // un-marking works too
  toggle.click();
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed');
  assert.equal(first.className.includes('is-done'), false);
});

test('progress survives a reload of the app', () => {
  const first = boot();
  $$(first.window, '.card')[0].querySelector('.done-toggle').click();
  const saved = first.window.localStorage.getItem('codepath:done');
  assert.match(saved, /Roadmap: How to Start Coding/);

  // boot a brand new window with that persisted progress
  const second = boot({ done: saved });
  assert.equal($(second.window, '#statText').textContent, '1 of 92 topics completed');
  assert.equal($$(second.window, '.card')[0].className.includes('is-done'), true);
  assert.equal($(second.window, '#ringText').textContent, '1%');
  assert.equal(tabByText(second.window, 'Programming').querySelector('.tab-count').textContent, '1/17');
  assert.match($(second.window, '#btnContinue').textContent, /Variables & Data Types/, 'continue moves to the next topic');
});

test('"hide completed" removes finished topics and empty sections', () => {
  const { window } = boot();
  $$(window, '.card')[0].querySelector('.done-toggle').click();
  const box = $(window, '#hideDone');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));

  assert.equal(visibleCards(window), 91);
  assert.equal(cardTitles(window).includes('Roadmap: How to Start Coding'), false);
});

test('reload button clears filters and re-renders everything', () => {
  const { window } = boot();
  const input = $(window, '#search');
  input.value = 'docker';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  $$(window, '.tab').find((t) => t.textContent.includes('Tools')).click();
  assert.equal(visibleCards(window), 2);

  $(window, '#btnReload').click();
  assert.equal($(window, '#search').value, '');
  assert.equal($(window, '#hideDone').checked, false);
  assert.equal(visibleCards(window), 92);
  assert.equal(window.location.hash, '');
  assert.match($(window, '#toasts').textContent, /Reloaded 92 topics/);
});

test('reset progress clears everything after confirmation', () => {
  const { window } = boot();
  $$(window, '.card').slice(0, 3).forEach((c) => c.querySelector('.done-toggle').click());
  assert.equal($(window, '#statText').textContent, '3 of 92 topics completed');

  $(window, '#btnReset').click();
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed');
  assert.equal(window.localStorage.getItem('codepath:done'), '{}');
  assert.equal($$(window, '.card.is-done').length, 0);
});

test('continue button opens the next unfinished topic on YouTube', () => {
  const { window } = boot();
  assert.equal($(window, '#btnContinue').hidden, false);
  assert.match($(window, '#btnContinue').textContent, /Roadmap: How to Start Coding/);

  $(window, '#btnContinue').click();
  assert.equal(window.__opened.length, 1);
  assert.match(window.__opened[0], /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  assert.ok(window.__opened[0].includes('CodeWithHarry'));

  // hideDone keeps the card in the DOM (it is not completed), so nothing breaks
  assert.equal(visibleCards(window), 92);
});

test('theme toggle switches theme and keeps its label intact', () => {
  const { window } = boot();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
  $(window, '#btnTheme').click();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal($(window, '#btnTheme .btn-label').textContent, 'Dark');
  assert.equal($(window, '#btnTheme .btn-icon').textContent, '🌙');
  assert.equal(JSON.parse(window.localStorage.getItem('codepath:theme')), 'light');
  $(window, '#btnTheme').click();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal($(window, '#btnTheme .btn-label').textContent, 'Light');
});

test('deep link #projects opens that section on load', () => {
  const { window } = boot();
  window.location.hash = '#projects';
  window.dispatchEvent(new window.Event('hashchange'));
  assert.equal($(window, '.section').id, 'section-projects');
  assert.equal(visibleCards(window), 6);
  assert.equal($$(window, '.card')[0].querySelector('.card-title').textContent.includes('E-commerce'), true);
});

test('project cards list every function to build', () => {
  const { window } = boot();
  $$(window, '.tab').find((t) => t.textContent.includes('Projects')).click();
  const cards = $$(window, '.card');
  assert.equal(cards.length, 6);
  cards.forEach((card) => {
    const features = card.querySelectorAll('.features li').length;
    assert.ok(features >= 8, card.querySelector('.card-title').textContent + ' lists fewer than 8 functions');
  });
  assert.equal($$(window, '.features').length >= 6, true);
});

test('each section has a working "Mark all done" button', () => {
  const { window } = boot();
  const buttons = $$(window, '.section-action');
  assert.equal(buttons.length, 8, 'one bulk action per section');
  buttons.forEach((b) => {
    assert.equal(b.getAttribute('aria-pressed'), 'false');
    assert.equal(b.textContent.includes('Mark all done'), true);
    assert.match(b.getAttribute('title'), /^Mark the \d+ topics? shown here as done$/);
  });

  // mark the whole Programming section done
  const programming = $(window, '#section-programming .section-action');
  assert.equal(programming.getAttribute('data-section-id'), 'programming');
  assert.match(programming.getAttribute('title'), /Mark the 17 topics shown here as done/);
  programming.click();
  assert.equal($(window, '#statText').textContent, '17 of 92 topics completed');
  assert.equal($(window, '.section-progress small').textContent, '17/17 done · 100%');
  assert.equal(tabByText(window, 'Programming').querySelector('.tab-count').textContent, '17/17');
  assert.equal($$(window, '#section-programming .card.is-done').length, 17);
  assert.equal($(window, '#section-programming .section-action').getAttribute('aria-pressed'), 'true');
  assert.match($(window, '#section-programming .section-action').textContent, /Clear section/);
  assert.match($(window, '#toasts').textContent, /Marked 17 topics done in Programming/);

  // the other sections are untouched
  assert.equal($$(window, '#section-dsa .card.is-done').length, 0);
  assert.equal(Object.keys(JSON.parse(window.localStorage.getItem('codepath:done'))).length, 17);

  // clicking again clears just that section
  $(window, '#section-programming .section-action').click();
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed');
  assert.equal($$(window, '.card.is-done').length, 0);
  assert.match($(window, '#toasts').textContent, /Cleared 17 topics in Programming/);
});

test('"Mark all done" only touches what the filter is showing', () => {
  const { window } = boot();
  const input = $(window, '#search');
  input.value = 'join';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));

  // only "SQL Joins" matches, so the bulk action must say "1 topic"
  assert.equal(visibleCards(window), 1);
  const action = $(window, '#section-database .section-action');
  assert.match(action.getAttribute('title'), /Mark the 1 topic shown here as done/);
  action.click();

  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed');
  assert.equal($(window, '.section-progress small').textContent, '1/11 done · 9%');
  assert.match($(window, '#toasts').textContent, /Marked 1 topic done in Database/);
});

test('starring a topic saves a favourite and fills the Favourites tab', () => {
  const { window } = boot();
  const tabs = $$(window, '.tab');
  assert.equal(tabs[1].textContent.includes('Favourites'), true);
  assert.equal(tabs[1].querySelector('.tab-count').textContent, '0');

  const card = $$(window, '.card')[0];
  const star = card.querySelector('.star-btn');
  assert.equal(star.textContent, '☆');
  assert.equal(star.getAttribute('aria-pressed'), 'false');
  assert.match(star.getAttribute('aria-label'), /^Save to favourites:/);

  star.click();
  assert.equal(star.textContent, '★');
  assert.equal(star.getAttribute('aria-pressed'), 'true');
  assert.equal(card.className.includes('is-starred'), true);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('codepath:bookmarks')), {
    'programming::Roadmap: How to Start Coding': true,
  });
  assert.equal($$(window, '.tab')[1].querySelector('.tab-count').textContent, '1');
  assert.match($(window, '#toasts').textContent, /Saved to favourites/);
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed', 'starring is not progress');
});

test('the Favourites tab shows only starred topics', () => {
  const { window } = boot({
    bookmarks: JSON.stringify({
      'dsa::Graph': true,
      'database::SQL Joins': true,
      'dsa::Stack': true,
    }),
  });
  const favTab = $$(window, '.tab').find((t) => t.textContent.includes('Favourites'));
  assert.equal(favTab.querySelector('.tab-count').textContent, '3');

  favTab.click();
  assert.deepEqual(cardTitles(window).sort(), ['Graph', 'SQL Joins', 'Stack']);
  assert.equal($$(window, '.section').length, 2, 'grouped by their sections');
  assert.equal(window.location.hash, '#favourites');
  assert.equal($$(window, '.card.is-starred').length, 3);
  assert.match($(window, '#statHint').textContent, /3 saved favourites/);

  // un-starring from inside the favourites view removes the card
  const graphCard = $$(window, '.card').find((c) => c.querySelector('.card-title').textContent === 'Graph');
  graphCard.querySelector('.star-btn').click();
  assert.equal(visibleCards(window), 2);
  assert.equal(cardTitles(window).includes('Graph'), false);
  assert.equal(window.localStorage.getItem('codepath:bookmarks').includes('Graph'), false);
});

test('favourites survive a reload, deep link and progress reset', () => {
  const store = JSON.stringify({ 'tools::Docker Basics': true });
  const { window } = boot({ bookmarks: store });

  // deep link
  window.location.hash = '#favourites';
  window.dispatchEvent(new window.Event('hashchange'));
  assert.deepEqual(cardTitles(window), ['Docker Basics']);

  // reset progress keeps favourites
  $(window, '#btnReset').click();
  assert.equal($(window, '#statText').textContent, '0 of 92 topics completed');
  assert.deepEqual(cardTitles(window), ['Docker Basics'], 'favourites were kept');
  assert.equal(window.localStorage.getItem('codepath:bookmarks'), store);
  assert.match($(window, '#toasts').textContent, /1 favourite kept/);

  // reload button also keeps them
  $(window, '#btnReload').click();
  assert.equal(window.location.hash, '', 'reload goes back to All');
  assert.equal($$(window, '.tab')[1].querySelector('.tab-count').textContent, '1');
});

test('an empty Favourites tab explains how to save topics', () => {
  const { window } = boot();
  $$(window, '.tab').find((t) => t.textContent.includes('Favourites')).click();

  const empty = $(window, '.empty');
  assert.match(empty.textContent, /No favourites yet/);
  assert.match(empty.textContent, /Tap the ☆/);
  assert.equal(visibleCards(window), 0);

  empty.querySelector('[data-action="show-all"]').click();
  assert.equal(visibleCards(window), 92);
});



/* ------------------------------------------------------- backup / restore */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Capture what the export would have downloaded. */
function captureDownload(window) {
  const captured = { anchors: [], blob: null, dataUri: false };
  const realCreate = window.URL.createObjectURL;
  const realRevoke = window.URL.revokeObjectURL;
  const realClick = window.HTMLAnchorElement.prototype.click;

  window.URL.createObjectURL = (blob) => {
    captured.blob = blob;
    return 'blob:stub';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    const href = this.getAttribute('href');
    captured.anchors.push({ download: this.getAttribute('download'), href });
    if (href.startsWith('data:')) {
      captured.dataUri = decodeURIComponent(href.split(',').slice(1).join(','));
    }
  };

  return {
    captured,
    restore() {
      window.URL.createObjectURL = realCreate;
      window.URL.revokeObjectURL = realRevoke;
      window.HTMLAnchorElement.prototype.click = realClick;
    },
  };
}

/** Put a fake file into the hidden import input and fire the change event. */
function pickImportFile(window, content, name = 'backup.json') {
  const input = $(window, '#importFile');
  const file = new window.File([content], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  return input;
}

test('exporting downloads a dated JSON backup of progress and favourites', async () => {
  const { window } = boot({
    done: JSON.stringify({ 'dsa::Stack': true }),
    bookmarks: JSON.stringify({ 'tools::Git': true }),
  });
  assert.equal($(window, '#btnExport').textContent.includes('Export backup'), true);

  const spy = captureDownload(window);
  $(window, '#btnExport').click();

  assert.equal(spy.captured.anchors.length, 1, 'one download was triggered');
  const anchor = spy.captured.anchors[0];
  assert.match(anchor.download, /^codepath-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(anchor.href, 'blob:stub');
  assert.equal($(window, '#toasts').textContent.includes(anchor.download), true, 'toast names the file');
  assert.match($(window, '#toasts').textContent, /1 completed topic and 1 favourite/);

  const written = JSON.parse(await spy.captured.blob.text());
  spy.restore();

  assert.equal(written.app, 'codepath');
  assert.equal(written.kind, 'progress-backup');
  assert.deepEqual(written.done, { 'dsa::Stack': true });
  assert.deepEqual(written.bookmarks, { 'tools::Git': true });
  assert.deepEqual(written.counts, { completed: 1, favourites: 1 });
  assert.ok(written.exportedAt);
  assert.equal(window.document.querySelectorAll('a[download]').length, 0, 'temp anchor is cleaned up');
});

test('exporting an empty backup still produces a valid file', () => {
  const { window } = boot();
  const spy = captureDownload(window);
  $(window, '#btnExport').click();
  assert.equal(spy.captured.anchors.length, 1);
  assert.match($(window, '#toasts').textContent, /0 completed topics and 0 favourites/);
  spy.restore();
});

test('export falls back to a data: URI where Blob URLs are unsupported', () => {
  const { window } = boot({ done: JSON.stringify({ 'dsa::Stack': true }) });
  // jsdom has no URL.createObjectURL, which is exactly the fallback case
  assert.equal(typeof window.URL.createObjectURL, 'undefined');
  const spy = captureDownload(window);
  window.URL.createObjectURL = undefined; // keep the fallback path even after stubbing
  window.__CodePathHome = 'reset';
  spy.restore();

  // re-run with a spy that leaves createObjectURL missing
  const anchors = [];
  const realClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () {
    anchors.push({ download: this.getAttribute('download'), href: this.getAttribute('href') });
  };
  $(window, '#btnExport').click();
  window.HTMLAnchorElement.prototype.click = realClick;

  assert.equal(anchors.length, 1);
  assert.match(anchors[0].href, /^data:application\/json/);
  const decoded = JSON.parse(decodeURIComponent(anchors[0].href.split(',').slice(1).join(',')));
  assert.deepEqual(decoded.done, { 'dsa::Stack': true });
  assert.equal(window.document.querySelectorAll('a[download]').length, 0, 'the temp anchor is cleaned up');
});

test('importing merges a backup into the existing progress', async () => {
  const { window } = boot({ done: JSON.stringify({ 'dsa::Stack': true }) });
  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed');

  pickImportFile(
    window,
    JSON.stringify({
      app: 'codepath',
      done: { 'database::SQL Joins': true, 'tools::Docker Basics': true },
      bookmarks: { 'dsa::Graph': true },
    }),
  );
  await tick();

  assert.equal($(window, '#statText').textContent, '3 of 92 topics completed', 'merged, not replaced');
  assert.equal($$(window, '.card.is-done').length, 3);
  assert.equal($$(window, '.card.is-starred').length, 1);
  assert.equal(tabByText(window, 'Favourites').querySelector('.tab-count').textContent, '1');
  assert.match($(window, '#toasts').textContent, /Merged 2 completed topics and 1 favourite/);

  const saved = JSON.parse(window.localStorage.getItem('codepath:done'));
  assert.deepEqual(Object.keys(saved).sort(), ['database::SQL Joins', 'dsa::Stack', 'tools::Docker Basics']);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('codepath:bookmarks')), { 'dsa::Graph': true });
});

test('import accepts a bare topic map and reports skipped entries', async () => {
  const { window } = boot();
  pickImportFile(window, JSON.stringify({ 'dsa::Stack': true, 'ghost::Nope': true, 'dsa::Heap': false }));
  await tick();

  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed');
  assert.match($(window, '#toasts').textContent, /Merged 1 completed topic and 0 favourites/);
  assert.match($(window, '#toasts').textContent, /2 unknown entries skipped/);
});

test('the same file can be imported again and again', async () => {
  const { window } = boot();
  const input = pickImportFile(window, JSON.stringify({ done: { 'dsa::Stack': true } }));
  await tick();
  assert.equal(input.value, '', 'the picker is reset for reuse');

  const file = new window.File([JSON.stringify({ done: { 'dsa::Graph': true } })], 'again.json', {
    type: 'application/json',
  });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();

  assert.equal($(window, '#statText').textContent, '2 of 92 topics completed');
  assert.equal($$(window, '.toast').length, 2, 'each import reported');
});

test('a broken import file changes nothing and explains why', async () => {
  const { window } = boot({ done: JSON.stringify({ 'dsa::Stack': true }) });

  pickImportFile(window, 'this is not json {{');
  await tick();
  assert.match($(window, '#toasts').textContent, /Import failed: That file is not valid JSON/);

  pickImportFile(window, JSON.stringify({ something: 'else' }));
  await tick();
  assert.match($(window, '#toasts').textContent, /Import failed: No progress or favourites found/);

  pickImportFile(window, JSON.stringify({ done: { 'ghost::Nothing': true } }));
  await tick();
  assert.match($(window, '#toasts').textContent, /contains no topics from this roadmap/);

  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed', 'state untouched');
  assert.deepEqual(Object.keys(JSON.parse(window.localStorage.getItem('codepath:done'))), ['dsa::Stack']);
  assert.equal($$(window, '.card.is-starred').length, 0);
});

test('inside the Android app the export goes through the native bridge', () => {
  const { window } = boot({
    done: JSON.stringify({ 'dsa::Stack': true }),
    bookmarks: JSON.stringify({ 'tools::Git': true }),
  });

  // the APK injects this object (see android/java/com/codepath/app/MainActivity.java)
  const calls = [];
  window.CodePathAndroid = {
    saveBackup(filename, json, mime) {
      calls.push({ filename, json, mime });
      return 'Saved to Downloads/CodePath/' + filename;
    },
  };

  const spy = captureDownload(window);
  $(window, '#btnExport').click();

  assert.equal(calls.length, 1, 'the bridge was used');
  assert.equal(spy.captured.anchors.length, 0, 'no blob download was attempted');
  spy.restore();

  assert.match(calls[0].filename, /^codepath-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(calls[0].mime, 'application/json');
  const written = JSON.parse(calls[0].json);
  assert.deepEqual(written.done, { 'dsa::Stack': true });
  assert.deepEqual(written.bookmarks, { 'tools::Git': true });
  assert.match($(window, '#toasts').textContent, /Saved to Downloads\/CodePath\/codepath-backup-/);
  assert.match($(window, '#toasts').textContent, /1 completed topic and 1 favourite/);
});

test('a failing Android bridge reports an error instead of throwing', () => {
  const { window } = boot({ done: JSON.stringify({ 'dsa::Stack': true }) });
  window.CodePathAndroid = {
    saveBackup() {
      throw new Error('storage is full');
    },
  };

  $(window, '#btnExport').click();
  assert.match($(window, '#toasts').textContent, /Export failed: storage is full/);
});

test('a bridge without the expected method falls back to the web download', () => {
  const { window } = boot({ done: JSON.stringify({ 'dsa::Stack': true }) });
  window.CodePathAndroid = { someOtherMethod: () => {} };

  const spy = captureDownload(window);
  $(window, '#btnExport').click();
  assert.equal(spy.captured.anchors.length, 1, 'fell back to the blob path');
  assert.equal(spy.captured.anchors[0].href, 'blob:stub');
  spy.restore();
});

test('export then import round-trips the whole state', async () => {
  const source = boot({
    done: JSON.stringify({ 'dsa::Stack': true, 'web::CSS': true }),
    bookmarks: JSON.stringify({ 'projects::Project 1: E-commerce App (Full Stack)': true }),
  });
  const spy = captureDownload(source.window);
  $(source.window, '#btnExport').click();
  const json = await spy.captured.blob.text();
  spy.restore();

  const restored = boot();
  pickImportFile(restored.window, json);
  await tick();

  assert.equal($(restored.window, '#statText').textContent, '2 of 92 topics completed');
  assert.equal(tabByText(restored.window, 'Favourites').querySelector('.tab-count').textContent, '1');
  assert.equal($$(restored.window, '.card.is-starred').length, 1);
});

test('install button appears only for installable browsers', () => {
  const { window } = boot();
  assert.equal($(window, '#btnInstall').hidden, true, 'hidden until beforeinstallprompt');

  const event = new window.Event('beforeinstallprompt');
  event.prompt = () => {};
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  assert.equal($(window, '#btnInstall').hidden, false);
  $(window, '#btnInstall').click();
});

test('a corrupt localStorage value does not break the app', () => {
  const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), {
    url: 'http://localhost:4173/',
    runScripts: 'dangerously',
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.localStorage.setItem('codepath:done', 'not json at all');
  window.localStorage.setItem('codepath:theme', '"purple"');
  ['js/data.js', 'js/core.js', 'js/app.js'].forEach((f) =>
    window.eval(readFileSync(join(ROOT, f), 'utf8')),
  );
  window.CodePathApp.init();

  assert.equal(visibleCards(window), 92);
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark', 'unknown theme falls back');
  $$(window, '.card')[0].querySelector('.done-toggle').click();
  assert.equal($(window, '#statText').textContent, '1 of 92 topics completed');
});
