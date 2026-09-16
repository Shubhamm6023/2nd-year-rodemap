/**
 * CodePath — app controller.
 * Classic script (no ES modules) so the app also works when index.html is
 * opened straight from disk with file://.
 */
(function () {
  'use strict';

  var C = window.CodePathCore;
  var data = window.APP_DATA;

  var DONE_KEY = 'codepath:done';
  var BOOKMARK_KEY = 'codepath:bookmarks';
  var THEME_KEY = 'codepath:theme';
  var FAVOURITES = 'favourites';

  var state = {
    sections: [],
    section: 'all',
    query: '',
    hideDone: false,
    done: {},
    bookmarks: {},
    theme: 'dark',
    lastResult: null
  };

  var refs = {};

  /* ------------------------------------------------------------ helpers */

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'text') node.textContent = value;
        else if (key === 'class') node.setAttribute('class', value);
        else node.setAttribute(key, value === true ? '' : String(value));
      });
    }
    append(node, kids);
    return node;
  }

  function append(node, kids) {
    if (kids === null || kids === undefined) return;
    var list = Array.isArray(kids) ? kids : [kids];
    list.forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  /** matchMedia is missing in some old WebViews — never let it break the app. */
  function mediaMatches(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (err) {
      return false;
    }
  }

  /** Coerce whatever came out of localStorage into a safe plain object. */
  function plainObject(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value;
  }

  function store(key, value) {
    try {
      if (value === undefined) {
        var raw = window.localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
      }
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // private mode / storage disabled: run in memory only
    }
    return null;
  }

  function toast(message, kind) {
    if (!refs.toasts) return;
    var node = el('div', { class: 'toast', 'data-kind': kind || 'info', role: 'status' }, [
      el('span', { text: message })
    ]);
    refs.toasts.appendChild(node);
    while (refs.toasts.children.length > 3) refs.toasts.removeChild(refs.toasts.firstChild);
    window.setTimeout(function () {
      node.classList.add('out');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 320);
    }, 2600);
  }

  /* -------------------------------------------------------------- theme */

  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    if (refs.btnTheme) {
      var icon = refs.btnTheme.querySelector('.btn-icon');
      var label = refs.btnTheme.querySelector('.btn-label');
      if (icon) icon.textContent = state.theme === 'light' ? '🌙' : '☀️';
      if (label) label.textContent = state.theme === 'light' ? 'Dark' : 'Light';
      refs.btnTheme.setAttribute('title', state.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'light' ? '#f5f6fc' : '#080c1a');
  }

  /* ---------------------------------------------------------------- tabs */

  function renderTabs() {
    var p = C.progress(state.sections, state.done);
    refs.tabs.textContent = '';

    refs.tabs.appendChild(
      el('button', {
        class: 'tab',
        type: 'button',
        'data-section': 'all',
        'aria-pressed': state.section === 'all' ? 'true' : 'false',
        style: '--tab-color:#6366f1'
      }, [
        el('span', { text: '🗂️ All' }),
        el('span', { class: 'tab-count', text: p.total })
      ])
    );

    refs.tabs.appendChild(
      el('button', {
        class: 'tab',
        type: 'button',
        'data-section': FAVOURITES,
        'aria-pressed': state.section === FAVOURITES ? 'true' : 'false',
        style: '--tab-color:#fbbf24',
        title: 'Topics you saved with the star button'
      }, [
        el('span', { text: '⭐ Favourites' }),
        el('span', { class: 'tab-count', text: C.countBookmarks(state.bookmarks) })
      ])
    );

    state.sections.forEach(function (section) {
      var stats = p.bySection[section.id] || { total: section.topics.length, completed: 0 };
      refs.tabs.appendChild(
        el('button', {
          class: 'tab',
          type: 'button',
          'data-section': section.id,
          'aria-pressed': state.section === section.id ? 'true' : 'false',
          style: '--tab-color:' + section.color,
          title: section.blurb
        }, [
          el('span', { text: section.icon + ' ' + section.no + '. ' + section.title }),
          el('span', { class: 'tab-count', text: stats.completed + '/' + stats.total })
        ])
      );
    });
  }

  /* --------------------------------------------------------------- cards */

  function buildCard(section, topic, index) {
    var topicId = C.topicId(section, topic);
    var done = !!state.done[topicId];
    var starred = !!state.bookmarks[topicId];
    var card = el('article', {
      class: 'card' + (done ? ' is-done' : '') + (starred ? ' is-starred' : ''),
      style: '--section-color:' + section.color,
      'data-topic': topicId
    });

    // stretched link: tapping anywhere on the card opens YouTube
    card.appendChild(
      el('a', {
        class: 'card-link',
        href: C.mainUrl(topic),
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Open YouTube videos: ' + C.mainQuery(topic),
        title: 'Open on YouTube: ' + C.mainQuery(topic)
      })
    );

    card.appendChild(
      el('div', { class: 'card-top' }, [
        el('span', { class: 'card-index', text: String(index + 1).padStart(2, '0') }),
        el('h3', { class: 'card-title', text: topic.t }),
        el('button', {
          class: 'star-btn',
          type: 'button',
          'data-action': 'toggle-bookmark',
          'aria-pressed': starred ? 'true' : 'false',
          'aria-label': (starred ? 'Remove from favourites: ' : 'Save to favourites: ') + topic.t,
          title: starred ? 'Remove from favourites' : 'Save to favourites',
          text: starred ? '★' : '☆'
        })
      ])
    );

    card.appendChild(el('p', { class: 'card-desc', text: topic.d }));

    if (topic.f && topic.f.length) {
      var list = el('ul', { class: 'features' });
      topic.f.forEach(function (feature) {
        list.appendChild(el('li', { text: feature }));
      });
      card.appendChild(list);
    }

    var chips = el('div', { class: 'chips' });
    chips.appendChild(
      el('a', {
        class: 'chip chip-primary',
        href: C.mainUrl(topic),
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'YouTube: ' + C.mainQuery(topic)
      }, [el('span', { text: '▶ Watch on YouTube' })])
    );
    (topic.ch || []).forEach(function (channel) {
      chips.appendChild(
        el('a', {
          class: 'chip',
          href: C.channelUrl(topic, channel),
          target: '_blank',
          rel: 'noopener noreferrer',
          title: 'Search ' + channel + ' for ' + topic.t
        }, [el('span', { text: channel })])
      );
    });
    card.appendChild(chips);

    var toggle = el('button', {
      class: 'done-toggle',
      type: 'button',
      'data-action': 'toggle-done',
      'aria-pressed': done ? 'true' : 'false',
      title: done ? 'Mark as not done' : 'Mark as completed'
    }, [
      el('span', { class: 'tick', text: done ? '✓' : '' }),
      el('span', { class: 'done-label', text: done ? 'Completed' : 'Mark done' })
    ]);

    card.appendChild(
      el('div', { class: 'card-foot' }, [
        toggle,
        el('span', { class: 'card-meta', text: C.plural((topic.ch || []).length, 'channel') })
      ])
    );

    return card;
  }

  /* ------------------------------------------------------------ sections */

  function currentFilter() {
    var favourites = state.section === FAVOURITES;
    return {
      query: state.query,
      sectionId: favourites ? 'all' : state.section,
      hideDone: state.hideDone,
      done: state.done,
      bookmarks: state.bookmarks,
      onlyBookmarked: favourites
    };
  }

  function renderContent() {
    var result = C.filterSections(state.sections, currentFilter());
    state.lastResult = result;

    refs.content.textContent = '';

    if (!result.matched) {
      refs.content.appendChild(buildEmptyState(result));
    } else {
      result.sections.forEach(function (section) {
        // progress must describe the whole section, never just the filtered cards
        var full = state.sections.filter(function (s) { return s.id === section.id; })[0] || section;
        var progress = C.progress([full], state.done).bySection[section.id];
        var shown = section.topics.length;
        var everyShownDone = C.allDone(section, section.topics, state.done);
        var block = el('section', { class: 'section', id: 'section-' + section.id, style: '--section-color:' + section.color });

        block.appendChild(
          el('div', { class: 'section-head' }, [
            el('span', { class: 'section-badge', text: section.icon }),
            el('div', { class: 'section-title' }, [
              el('h2', {}, [
                el('span', { text: section.no + '. ' + section.title }),
                el('span', { text: C.plural(section.topics.length, 'topic') })
              ]),
              el('p', { text: section.blurb })
            ]),
            el('button', {
              class: 'btn section-action' + (everyShownDone ? ' is-clear' : ''),
              type: 'button',
              'data-action': 'section-done',
              'data-section-id': section.id,
              'aria-pressed': everyShownDone ? 'true' : 'false',
              title: everyShownDone
                ? 'Mark the ' + C.plural(shown, 'topic') + ' shown here as not done'
                : 'Mark the ' + C.plural(shown, 'topic') + ' shown here as done'
            }, [
              el('span', { class: 'section-action-icon', 'aria-hidden': 'true', text: everyShownDone ? '↺' : '✓' }),
              el('span', { text: everyShownDone ? 'Clear section' : 'Mark all done' })
            ]),
            el('div', { class: 'section-progress' }, [
              el('div', { class: 'bar' }, [
                el('span', { style: 'width:' + progress.percent + '%' })
              ]),
              el('small', { text: progress.completed + '/' + progress.total + ' done · ' + progress.percent + '%' })
            ])
          ])
        );

        var grid = el('div', { class: 'grid' });
        section.topics.forEach(function (topic, index) {
          grid.appendChild(buildCard(section, topic, index));
        });
        block.appendChild(grid);
        refs.content.appendChild(block);
      });
    }

    updateStats(result);
  }

  function buildEmptyState() {
    var box = el('div', { class: 'empty' });
    var icon = '🎉';
    var heading = 'Nothing left here';
    var message = 'Every topic in this view is marked done. Great work!';

    if (state.query) {
      icon = '🔍';
      heading = 'No topics match “' + state.query + '”';
      message = 'Try a shorter word like “array”, “join”, “docker” — or clear the filters below.';
    } else if (state.section === FAVOURITES) {
      icon = '⭐';
      heading = 'No favourites yet';
      message = 'Tap the ☆ on any topic card to save it here, so your must-watch topics are always one tap away.';
    } else if (state.hideDone) {
      heading = 'Nothing left here';
      message = 'Every topic in this view is marked done. Great work!';
    }

    box.appendChild(el('div', { class: 'empty-icon', text: icon }));
    box.appendChild(el('h2', { text: heading }));
    box.appendChild(el('p', { text: message }));

    var actions = el('div', { class: 'stats-actions', style: 'justify-content:center' });
    if (state.query) {
      actions.appendChild(el('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'clear-query' }, ['Clear search']));
    }
    if (state.hideDone) {
      actions.appendChild(el('button', { class: 'btn', type: 'button', 'data-action': 'show-done' }, ['Show completed']));
    }
    if (state.section !== 'all') {
      actions.appendChild(
        el('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'show-all' },
          [state.section === FAVOURITES ? 'Browse all topics' : 'Go to all topics'])
      );
    }
    box.appendChild(actions);
    return box;
  }

  /* --------------------------------------------------------------- stats */

  function updateStats(result) {
    var p = C.progress(state.sections, state.done);
    var filtered = result || C.filterSections(state.sections, currentFilter());
    var circumference = 2 * Math.PI * Number(refs.ringValue.getAttribute('r') || 28);
    refs.ringValue.setAttribute('stroke-dasharray', circumference.toFixed(2));
    refs.ringValue.setAttribute('stroke-dashoffset', (circumference * (1 - p.percent / 100)).toFixed(2));
    refs.ringText.textContent = p.percent + '%';

    refs.statText.textContent = p.completed + ' of ' + p.total + ' topics completed';
    refs.statBar.style.width = p.percent + '%';

    var shown = filtered.matched;
    if (state.section === FAVOURITES) {
      refs.statHint.textContent =
        C.plural(C.countBookmarks(state.bookmarks), 'saved favourite') +
        ' · tap the ☆ on any card to save more';
    } else if (state.query || state.hideDone || state.section !== 'all') {
      refs.statHint.textContent = 'Showing ' + shown + ' of ' + p.total + ' topics · ' + data.tip;
    } else {
      refs.statHint.textContent = data.tip;
    }

    var next = C.nextUp(state.sections, state.done);
    if (next) {
      refs.btnContinue.hidden = false;
      refs.btnContinue.textContent = '▶ Continue: ' + next.topic.t;
      refs.btnContinue.setAttribute('data-next-topic', C.topicId(next.section, next.topic));
    } else {
      refs.btnContinue.hidden = true;
      refs.btnContinue.removeAttribute('data-next-topic');
    }

    if (refs.footStats) {
      refs.footStats.textContent =
        'CodePath v' + (data.version || '1.0') + ' · ' + C.plural(state.sections.length, 'section') +
        ' · ' + C.plural(p.total, 'topic') + ' · ' + p.completed + ' completed · ' +
        C.countBookmarks(state.bookmarks) + ' starred';
    }
  }

  /* -------------------------------------------------------------- render */

  function renderAll() {
    renderTabs();
    renderContent();
  }

  /** Valid targets for the section buttons and for deep links. */
  function isKnownSection(id) {
    if (id === 'all' || id === FAVOURITES) return true;
    return state.sections.some(function (section) { return section.id === id; });
  }

  function setSection(id, opts) {
    if (!isKnownSection(id)) id = 'all';
    state.section = id;
    if (!opts || opts.hash !== false) {
      try {
        window.history.replaceState(null, '', id === 'all' ? location.pathname + location.search : '#' + id);
      } catch (err) {
        // file:// or sandboxed: ignore
      }
    }
    renderAll();
    if (!opts || opts.scroll !== false) {
      var top = document.querySelector('.tabs');
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
    }
  }

  /* -------------------------------------------------------------- events */

  function wireEvents() {
    refs.tabs.addEventListener('click', function (event) {
      var tab = event.target.closest('.tab');
      if (!tab) return;
      if (tab.getAttribute('data-section') === state.section) return;
      setSection(tab.getAttribute('data-section'));
      toast('Showing ' + tab.querySelector('span').textContent.trim(), 'info');
    });

    refs.content.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      if (action) {
        var name = action.getAttribute('data-action');
        if (name === 'toggle-done') {
          event.preventDefault();
          toggleDone(action.closest('.card').getAttribute('data-topic'));
          return;
        }
        if (name === 'toggle-bookmark') {
          event.preventDefault();
          toggleBookmark(action.closest('.card').getAttribute('data-topic'));
          return;
        }
        if (name === 'section-done') {
          event.preventDefault();
          toggleSectionDone(action.getAttribute('data-section-id'));
          return;
        }
        if (name === 'clear-query') {
          refs.search.value = '';
          state.query = '';
          refs.btnClearSearch.hidden = true;
          renderAll();
          return;
        }
        if (name === 'show-done') {
          refs.hideDone.checked = false;
          state.hideDone = false;
          renderAll();
          return;
        }
        if (name === 'show-all') {
          setSection('all');
          return;
        }
      }
    });

    refs.search.addEventListener('input', function () {
      state.query = refs.search.value.trim();
      refs.btnClearSearch.hidden = !state.query;
      renderContent();
    });

    refs.search.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        refs.search.value = '';
        state.query = '';
        refs.btnClearSearch.hidden = true;
        renderContent();
      }
    });

    refs.btnClearSearch.addEventListener('click', function () {
      refs.search.value = '';
      state.query = '';
      refs.btnClearSearch.hidden = true;
      refs.search.focus();
      renderContent();
    });

    refs.hideDone.addEventListener('change', function () {
      state.hideDone = refs.hideDone.checked;
      renderContent();
    });

    refs.btnExport.addEventListener('click', exportBackup);

    refs.btnImport.addEventListener('click', function () {
      refs.importFile.value = ''; // so the same file can be picked twice in a row
      if (typeof refs.importFile.click === 'function') refs.importFile.click();
      else toast('This browser cannot open a file picker here — use a desktop browser.', 'warn');
    });

    refs.importFile.addEventListener('change', function () {
      var file = refs.importFile.files && refs.importFile.files[0];
      importBackup(file);
      refs.importFile.value = '';
    });

    window.addEventListener('storage', function (event) {
      // another tab changed the progress: pick it up
      if (!event.key || event.key === DONE_KEY || event.key === BOOKMARK_KEY) {
        state.done = store(DONE_KEY) || {};
        state.bookmarks = store(BOOKMARK_KEY) || {};
        renderAll();
      }
    });

    refs.btnReload.addEventListener('click', function () {
      refs.btnReload.classList.add('spin');
      window.setTimeout(function () {
        refs.btnReload.classList.remove('spin');
      }, 620);
      reload();
    });

    refs.btnRefresh.addEventListener('click', function () {
      toast('Refreshing the page…', 'info');
      window.setTimeout(function () {
        window.location.reload();
      }, 160);
    });

    refs.btnTheme.addEventListener('click', function () {
      var next = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      store(THEME_KEY, next);
      toast(next === 'light' ? 'Light theme on' : 'Dark theme on', 'info');
    });

    refs.btnReset.addEventListener('click', function () {
      var answered = true;
      try {
        answered = window.confirm('Reset all completed topics? Your starred favourites are kept.');
      } catch (err) {
        answered = true;
      }
      if (!answered) return;
      state.done = {};
      store(DONE_KEY, state.done);
      renderAll();
      toast('Progress reset · ' + C.plural(C.countBookmarks(state.bookmarks), 'favourite') + ' kept', 'warn');
    });

    refs.btnContinue.addEventListener('click', function () {
      var id = refs.btnContinue.getAttribute('data-next-topic');
      var found = null;
      C.allTopics(state.sections).some(function (entry) {
        if (C.topicId(entry.section, entry.topic) === id) {
          found = entry;
          return true;
        }
        return false;
      });
      if (!found) return;
      if (state.section !== 'all' && state.section !== found.section.id) setSection(found.section.id, { scroll: false });
      window.open(C.mainUrl(found.topic), '_blank', 'noopener,noreferrer');
      var card = findCard(id);
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('Next up: ' + found.topic.t, 'good');
    });

    document.addEventListener('keydown', function (event) {
      var tag = (event.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || event.target.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        refs.search.focus();
      }
    });

    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#', '') || 'all';
      if (id !== state.section && isKnownSection(id)) setSection(id, { hash: false, scroll: false });
    });

    window.addEventListener('error', function (event) {
      if (event && event.message) toast('Something went wrong: ' + event.message, 'error');
    });

    window.addEventListener('unhandledrejection', function () {
      toast('Something went wrong while loading data', 'error');
    });
  }

  /**
   * Mark every topic currently shown in one section as done — or clear them
   * again when the whole section is already finished. Respects active filters,
   * so it only touches what the user can see.
   */
  function toggleSectionDone(sectionId) {
    if (!sectionId || !state.lastResult) return;
    var block = state.lastResult.sections.filter(function (s) { return s.id === sectionId; })[0];
    if (!block || !block.topics.length) return;

    var ref = { id: sectionId };
    var wasAllDone = C.allDone(ref, block.topics, state.done);
    state.done = C.setManyDone(ref, block.topics, state.done, !wasAllDone);
    store(DONE_KEY, state.done);

    renderTabs();
    renderContent();
    toast(
      (wasAllDone ? 'Cleared ' : '✓ Marked ') + C.plural(block.topics.length, 'topic') +
        (wasAllDone ? '' : ' done') + ' in ' + block.title,
      wasAllDone ? 'warn' : 'good'
    );
  }

  /** Star / un-star a topic and keep every view in sync. */
  function toggleBookmark(topicId) {
    if (!topicId) return;
    var wasStarred = !!state.bookmarks[topicId];
    if (wasStarred) delete state.bookmarks[topicId];
    else state.bookmarks[topicId] = true;
    store(BOOKMARK_KEY, state.bookmarks);

    var card = findCard(topicId);
    var title = card ? card.querySelector('.card-title').textContent : 'Topic';
    if (card) {
      card.classList.toggle('is-starred', !wasStarred);
      var star = card.querySelector('.star-btn');
      if (star) {
        star.textContent = wasStarred ? '☆' : '★';
        star.setAttribute('aria-pressed', wasStarred ? 'false' : 'true');
        star.setAttribute('title', wasStarred ? 'Save to favourites' : 'Remove from favourites');
        star.setAttribute('aria-label', (wasStarred ? 'Save to favourites: ' : 'Remove from favourites: ') + title);
      }
    }

    renderTabs();
    updateStats();
    if (state.section === FAVOURITES) renderContent();

    toast(
      wasStarred ? 'Removed from favourites: ' + title : '★ Saved to favourites: ' + title,
      wasStarred ? 'warn' : 'good'
    );
  }

  /** The card for a topic — scoped to the list, so header buttons can't shadow it. */
  function findCard(topicId) {
    if (!topicId || !refs.content) return null;
    return refs.content.querySelector('[data-topic="' + topicId.replace(/"/g, '\\"') + '"]');
  }

  function toggleDone(topicId) {
    if (!topicId) return;
    var wasDone = !!state.done[topicId];
    if (wasDone) delete state.done[topicId];
    else state.done[topicId] = true;
    store(DONE_KEY, state.done);

    var card = findCard(topicId);
    if (card) {
      var button = card.querySelector('.done-toggle');
      card.classList.toggle('is-done', !wasDone);
      if (button) {
        button.setAttribute('aria-pressed', wasDone ? 'false' : 'true');
        button.setAttribute('title', wasDone ? 'Mark as completed' : 'Mark as not done');
        button.querySelector('.tick').textContent = wasDone ? '' : '✓';
        button.querySelector('.done-label').textContent = wasDone ? 'Mark done' : 'Completed';
      }
    }

    var title = card ? (card.querySelector('.card-title') || {}).textContent : '';
    renderTabs();
    updateStats();

    if (state.hideDone && !wasDone) {
      renderContent();
    } else if (card) {
      // keep the card visible; only the section bars change
      updateSectionBars();
    }
    toast(wasDone ? 'Unmarked: ' + title : '✓ Done: ' + title, wasDone ? 'warn' : 'good');
  }

  function updateSectionBars() {
    var p = C.progress(state.sections, state.done);
    Object.keys(p.bySection).forEach(function (id) {
      var stats = p.bySection[id];
      var block = document.getElementById('section-' + id);
      if (!block) return;
      var bar = block.querySelector('.section-progress .bar span');
      var small = block.querySelector('.section-progress small');
      if (bar) bar.style.width = stats.percent + '%';
      if (small) small.textContent = stats.completed + '/' + stats.total + ' done · ' + stats.percent + '%';
    });
  }

  /* ------------------------------------------------------ backup/restore */

  /** The object written to the export file. */
  function collectBackup() {
    return C.buildBackup({
      done: state.done,
      bookmarks: state.bookmarks,
      version: data.version
    });
  }

  /** Save text to the user's downloads, falling back to a data URI. */
  function downloadFile(filename, text, mime) {
    var blob = null;
    try {
      blob = new Blob([text], { type: mime });
    } catch (err) {
      blob = null;
    }

    var anchor = el('a', { href: '#', download: filename, class: 'sr-only' });
    var objectUrl = null;
    if (blob && window.URL && typeof window.URL.createObjectURL === 'function') {
      objectUrl = window.URL.createObjectURL(blob);
      anchor.setAttribute('href', objectUrl);
    } else {
      anchor.setAttribute('href', 'data:' + mime + ',' + encodeURIComponent(text));
    }

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (objectUrl) {
      window.setTimeout(function () {
        try {
          window.URL.revokeObjectURL(objectUrl);
        } catch (err) {
          // already gone
        }
      }, 4000);
    }
  }

  /**
   * The Android shell (android/java/.../MainActivity.java) exposes
   * window.CodePathAndroid. Blob downloads cannot be captured by a WebView's
   * DownloadListener, so the APK saves backups through this bridge instead.
   */
  function androidBridge() {
    var bridge = window.CodePathAndroid;
    return bridge && typeof bridge.saveBackup === 'function' ? bridge : null;
  }

  function exportBackup() {
    var backup = collectBackup();
    var filename = C.backupFilename();
    var json = C.serializeBackup(backup);
    var summary =
      C.plural(backup.counts.completed, 'completed topic') + ' and ' +
      C.plural(backup.counts.favourites, 'favourite');

    var bridge = androidBridge();
    if (bridge) {
      try {
        var saved = bridge.saveBackup(filename, json, 'application/json');
        toast('💾 ' + (saved || 'Saved ' + filename) + ' (' + summary + ')', 'good');
      } catch (err) {
        toast('Export failed: ' + (err && err.message ? err.message : 'the app could not save the file'), 'error');
      }
      return;
    }

    try {
      downloadFile(filename, json, 'application/json;charset=utf-8');
      toast('💾 Saved ' + filename + ' (' + summary + ')', 'good');
    } catch (err) {
      toast('Export failed: ' + (err && err.message ? err.message : 'downloads are blocked here'), 'error');
    }
  }

  /**
   * Import a backup file. Merges instead of replacing, so restoring an old file
   * can never wipe progress made after it was exported.
   */
  function importBackup(file) {
    if (!file) return;

    function finish(text) {
      var parsed = C.parseBackup(text, C.knownTopicIds(state.sections));
      if (!parsed.ok) {
        toast('Import failed: ' + parsed.error, 'error');
        return;
      }
      if (!parsed.completed && !parsed.favourites) {
        toast('Import failed: that backup contains no topics from this roadmap.', 'error');
        return;
      }

      Object.keys(parsed.done).forEach(function (id) {
        state.done[id] = true;
      });
      Object.keys(parsed.bookmarks).forEach(function (id) {
        state.bookmarks[id] = true;
      });
      store(DONE_KEY, state.done);
      store(BOOKMARK_KEY, state.bookmarks);
      renderAll();

      toast(
        '📂 Merged ' + C.plural(parsed.completed, 'completed topic') + ' and ' +
          C.plural(parsed.favourites, 'favourite') +
          (parsed.ignored ? ' · ' + C.plural(parsed.ignored, 'unknown entry') + ' skipped' : ''),
        'good'
      );
    }

    function failed() {
      toast('Import failed: that file could not be read.', 'error');
    }

    if (typeof file.text === 'function') {
      file.text().then(finish).catch(failed);
      return;
    }
    try {
      var reader = new FileReader();
      reader.onload = function () {
        finish(String(reader.result));
      };
      reader.onerror = failed;
      reader.readAsText(file);
    } catch (err) {
      failed();
    }
  }

  /* -------------------------------------------------------------- reload */

  function reload() {
    var fresh = window.APP_DATA;
    if (!fresh || !Array.isArray(fresh.sections)) {
      toast('Could not reload: curriculum data is missing', 'error');
      return;
    }
    state.sections = fresh.sections;
    state.query = '';
    state.hideDone = false;
    state.section = 'all';
    refs.search.value = '';
    refs.btnClearSearch.hidden = true;
    refs.hideDone.checked = false;
    setSection('all');
    toast('Reloaded ' + C.plural(C.allTopics(state.sections).length, 'topic') + ' · all filters cleared', 'good');
  }

  /* --------------------------------------------------------------- theme */

  function initInstall() {
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferred = event;
      refs.btnInstall.hidden = false;
    });

    refs.btnInstall.addEventListener('click', function () {
      if (!deferred) {
        toast('Use your browser menu → “Add to Home screen / Install app”.', 'info');
        return;
      }
      deferred.prompt();
      deferred.userChoice.then(function (choice) {
        toast(choice.outcome === 'accepted' ? 'Installing CodePath…' : 'Install cancelled', choice.outcome === 'accepted' ? 'good' : 'info');
        deferred = null;
        refs.btnInstall.hidden = true;
      }).catch(function () {
        toast('Install was interrupted', 'warn');
      });
    });

    window.addEventListener('appinstalled', function () {
      refs.btnInstall.hidden = true;
      toast('CodePath installed — open it from your home screen!', 'good');
    });

    if (mediaMatches('(display-mode: standalone)') || window.navigator.standalone === true) {
      refs.btnInstall.hidden = true;
    }
  }

  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // offline caching is a bonus; never block the app
      });
    });
  }

  /* ----------------------------------------------------------------- init */

  var started = false;

  function init() {
    if (started) return; // never wire the UI twice
    started = true;

    ['tabs', 'content', 'search', 'btnClearSearch', 'hideDone', 'btnReload', 'btnRefresh', 'btnInstall',
      'btnTheme', 'btnReset', 'btnContinue', 'ringValue', 'ringText', 'statText', 'statBar', 'statHint',
      'toasts', 'footStats', 'brandTagline', 'btnExport', 'btnImport', 'importFile'
    ].forEach(function (id) {
      refs[id] = $(id);
    });

    if (!C) {
      refs.content.textContent = 'Fatal: js/core.js failed to load.';
      return;
    }
    if (!data || !Array.isArray(data.sections)) {
      refs.content.textContent = 'Fatal: js/data.js failed to load.';
      return;
    }

    state.sections = data.sections;
    state.done = plainObject(store(DONE_KEY));
    state.bookmarks = plainObject(store(BOOKMARK_KEY));
    refs.brandTagline.textContent = data.tagline;
    refs.search.setAttribute('placeholder', 'Search ' + C.plural(C.allTopics(state.sections).length, 'topic') + ' — try “recursion”, “joins”, “docker”…');
    applyTheme(store(THEME_KEY) || (mediaMatches('(prefers-color-scheme: light)') ? 'light' : 'dark'));

    var hash = (location.hash || '').replace('#', '');
    if (hash && isKnownSection(hash)) state.section = hash;

    wireEvents();
    renderAll();
    initInstall();
    initServiceWorker();
  }

  // small public surface: handy for debugging, deep links and tests
  window.CodePathApp = {
    init: init,
    reload: reload,
    exportBackup: exportBackup,
    importBackup: importBackup,
    renderAll: renderAll,
    setSection: setSection,
    state: state,
    refs: refs
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
