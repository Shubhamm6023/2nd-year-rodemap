/**
 * CodePath core logic: pure, DOM-free helpers.
 * Loaded in the browser (attaches to window.CodePathCore) and required by the
 * Node test suite, so it must never touch document / window APIs.
 */
(function (root) {
  'use strict';

  var YOUTUBE_SEARCH = 'https://www.youtube.com/results?search_query=';

  /** Build a YouTube search URL. Spaces become %20, symbols are escaped. */
  function searchUrl(query) {
    return YOUTUBE_SEARCH + encodeURIComponent(String(query).trim());
  }

  /** Best single query for a topic: its curated query + the top channel. */
  function mainQuery(topic) {
    var channel = topic.ch && topic.ch.length ? topic.ch[0] : '';
    return channel ? topic.q + ' ' + channel : topic.q;
  }

  function mainUrl(topic) {
    return searchUrl(mainQuery(topic));
  }

  /** Channel-scoped search, used by the chip buttons on each card. */
  function channelUrl(topic, channel) {
    return searchUrl(topic.t + ' ' + channel);
  }

  /** Stable id for a topic, used as the localStorage progress key. */
  function topicId(section, topic) {
    return section.id + '::' + topic.t;
  }

  /** Lowercase + strip accents so "Jenny's" and "jennys" both match. */
  function normalize(value) {
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** All searchable text of one topic, including its feature list. */
  function haystack(section, topic) {
    var parts = [topic.t, topic.d, section.title, section.blurb];
    if (topic.f) parts = parts.concat(topic.f);
    if (topic.ch) parts = parts.concat(topic.ch);
    return normalize(parts.join(' '));
  }

  /** True when every whitespace-separated word of the query appears. */
  function matchesQuery(section, topic, query) {
    var words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    var text = haystack(section, topic);
    return words.every(function (word) {
      return text.indexOf(word) !== -1;
    });
  }

  /**
   * Filter the curriculum.
   * opts: { query, sectionId, hideDone, done, bookmarks, onlyBookmarked }
   * Returns { sections, total, completed, matched }. `total`/`completed` are
   * scoped to the sections that passed the section filter, so a single tab can
   * say "3 of 17 done". Use progress() for whole-curriculum numbers. Sections
   * that end up with no topics are dropped so the UI never shows an empty tab.
   */
  function filterSections(sections, opts) {
    opts = opts || {};
    var query = opts.query || '';
    var sectionId = opts.sectionId || 'all';
    var hideDone = !!opts.hideDone;
    var done = opts.done || {};
    var bookmarks = opts.bookmarks || {};
    var onlyBookmarked = !!opts.onlyBookmarked;
    var out = [];
    var matched = 0;
    var total = 0;
    var completed = 0;

    sections.forEach(function (section) {
      if (sectionId !== 'all' && section.id !== sectionId) return;
      var topics = section.topics.filter(function (topic) {
        if (!matchesQuery(section, topic, query)) return false;
        if (onlyBookmarked && !bookmarks[topicId(section, topic)]) return false;
        if (hideDone && done[topicId(section, topic)]) return false;
        return true;
      });
      section.topics.forEach(function (topic) {
        total++;
        if (done[topicId(section, topic)]) completed++;
      });
      matched += topics.length;
      if (topics.length) {
        out.push({
          id: section.id,
          no: section.no,
          title: section.title,
          icon: section.icon,
          color: section.color,
          blurb: section.blurb,
          topics: topics
        });
      }
    });

    return { sections: out, total: total, completed: completed, matched: matched };
  }

  /** Percentage complete, rounded to a whole number. */
  function percent(completed, total) {
    if (!total) return 0;
    return Math.round((completed / total) * 100);
  }

  /** Overall + per-section progress. */
  function progress(sections, done) {
    done = done || {};
    var total = 0;
    var completed = 0;
    var bySection = {};

    sections.forEach(function (section) {
      var sTotal = section.topics.length;
      var sDone = section.topics.filter(function (topic) {
        return !!done[topicId(section, topic)];
      }).length;
      bySection[section.id] = {
        total: sTotal,
        completed: sDone,
        percent: percent(sDone, sTotal)
      };
      total += sTotal;
      completed += sDone;
    });

    return { total: total, completed: completed, percent: percent(completed, total), bySection: bySection };
  }

  /** How many topics are bookmarked (falsy/removed entries do not count). */
  function countBookmarks(bookmarks) {
    if (!bookmarks) return 0;
    return Object.keys(bookmarks).filter(function (key) {
      return !!bookmarks[key];
    }).length;
  }

  /** True when every topic in the list is marked done. Empty lists are false. */
  function allDone(section, topics, done) {
    if (!topics || !topics.length) return false;
    return topics.every(function (topic) {
      return !!done[topicId(section, topic)];
    });
  }

  /** Mark (or unmark) a whole list of topics. Returns a new done map. */
  function setManyDone(section, topics, done, value) {
    var next = {};
    Object.keys(done || {}).forEach(function (key) {
      next[key] = done[key];
    });
    (topics || []).forEach(function (topic) {
      var id = topicId(section, topic);
      if (value) next[id] = true;
      else delete next[id];
    });
    return next;
  }

  /** First unfinished topic in curriculum order — powers the "Continue" button. */
  function nextUp(sections, done) {
    done = done || {};
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      for (var j = 0; j < section.topics.length; j++) {
        var topic = section.topics[j];
        if (!done[topicId(section, topic)]) {
          return { section: section, topic: topic };
        }
      }
    }
    return null;
  }

  /** Flatten every topic with its section, in curriculum order. */
  function allTopics(sections) {
    var out = [];
    sections.forEach(function (section) {
      section.topics.forEach(function (topic) {
        out.push({ section: section, topic: topic });
      });
    });
    return out;
  }

  /* ----------------------------------------------------- backup / restore */

  /** A value counts as "on" only for real truthy markers, so "false" is off. */
  function isOn(value) {
    return value === true || value === 1 || value === 'true';
  }

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** Copy only the enabled entries of a done/bookmark map. */
  function pickOn(map) {
    var out = {};
    if (!isPlainObject(map)) return out;
    Object.keys(map).forEach(function (key) {
      if (key && isOn(map[key])) out[key] = true;
    });
    return out;
  }

  /** Every valid topic id, so imports can never invent progress. */
  function knownTopicIds(sections) {
    var ids = {};
    allTopics(sections || []).forEach(function (entry) {
      ids[topicId(entry.section, entry.topic)] = true;
    });
    return ids;
  }

  /** The object we write to the export file. */
  function buildBackup(opts) {
    opts = opts || {};
    var done = pickOn(opts.done);
    var bookmarks = pickOn(opts.bookmarks);
    return {
      app: 'codepath',
      kind: 'progress-backup',
      version: String(opts.version || '1.0.0'),
      exportedAt: opts.exportedAt || new Date().toISOString(),
      counts: { completed: Object.keys(done).length, favourites: Object.keys(bookmarks).length },
      done: done,
      bookmarks: bookmarks
    };
  }

  /** Pretty-printed so the file stays readable and hand-editable. */
  function serializeBackup(backup) {
    return JSON.stringify(backup, null, 2) + '\n';
  }

  /** codepath-backup-2026-09-16.json */
  function backupFilename(when) {
    var date = when ? new Date(when) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return 'codepath-backup-' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + '.json';
  }

  /**
   * Parse a backup file. Never throws: returns { ok, error } instead, so a bad
   * file can only ever show a message, never break the app.
   *
   * Accepts our export format and a bare { "sectionId::Topic": true } map.
   * Entries whose id is not in `validIds` (or whose value is not "on") are
   * dropped and counted in `ignored`, so a corrupt file cannot inflate progress.
   */
  function parseBackup(text, validIds) {
    var raw = text;
    if (typeof text === 'string') {
      try {
        raw = JSON.parse(text);
      } catch (err) {
        return { ok: false, error: 'That file is not valid JSON.' };
      }
    }
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (err) {
        return { ok: false, error: 'That file is not valid JSON.' };
      }
    }
    if (!isPlainObject(raw)) {
      return { ok: false, error: 'Expected a CodePath backup object, got ' + (Array.isArray(raw) ? 'an array' : typeof raw) + '.' };
    }

    var hasDone = isPlainObject(raw.done);
    var hasBookmarks = isPlainObject(raw.bookmarks) || isPlainObject(raw.favourites);
    var doneSource = hasDone ? raw.done : null;
    var bookmarkSource = isPlainObject(raw.bookmarks) ? raw.bookmarks : isPlainObject(raw.favourites) ? raw.favourites : null;

    if (!hasDone && !hasBookmarks) {
      // a bare map of topic ids -> true is the other supported shape
      var bare = Object.keys(raw).filter(function (key) { return key.indexOf('::') !== -1; });
      if (!bare.length) {
        return { ok: false, error: 'No progress or favourites found in that file.' };
      }
      doneSource = raw;
      bookmarkSource = {};
    }

    var done = sanitize(doneSource, validIds);
    var bookmarks = sanitize(bookmarkSource, validIds);
    return {
      ok: true,
      done: done.map,
      bookmarks: bookmarks.map,
      completed: Object.keys(done.map).length,
      favourites: Object.keys(bookmarks.map).length,
      ignored: done.ignored + bookmarks.ignored,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null
    };
  }

  /** Keep only ids that exist in the curriculum and values that mean "on". */
  function sanitize(map, validIds) {
    var out = {};
    var ignored = 0;
    if (!isPlainObject(map)) return { map: out, ignored: ignored };
    Object.keys(map).forEach(function (key) {
      if (!isOn(map[key]) || (validIds && !validIds[key])) {
        ignored++;
        return;
      }
      out[key] = true;
    });
    return { map: out, ignored: ignored };
  }

  /** "1 topic" / "12 topics" / "3 matches" / "2 unknown entries" */
  function plural(count, word) {
    if (count === 1) return '1 ' + word;
    if (/(s|x|z|ch|sh)$/i.test(word)) return count + ' ' + word + 'es';
    if (/[^aeiou]y$/i.test(word)) return count + ' ' + word.slice(0, -1) + 'ies';
    return count + ' ' + word + 's';
  }

  var api = {
    YOUTUBE_SEARCH: YOUTUBE_SEARCH,
    searchUrl: searchUrl,
    mainQuery: mainQuery,
    mainUrl: mainUrl,
    channelUrl: channelUrl,
    topicId: topicId,
    isOn: isOn,
    knownTopicIds: knownTopicIds,
    buildBackup: buildBackup,
    serializeBackup: serializeBackup,
    parseBackup: parseBackup,
    backupFilename: backupFilename,
    countBookmarks: countBookmarks,
    allDone: allDone,
    setManyDone: setManyDone,
    normalize: normalize,
    matchesQuery: matchesQuery,
    filterSections: filterSections,
    percent: percent,
    progress: progress,
    nextUp: nextUp,
    allTopics: allTopics,
    plural: plural
  };

  root.CodePathCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
