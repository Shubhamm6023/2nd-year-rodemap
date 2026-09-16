/**
 * Unit tests for the DOM-free core (node --test tools).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../js/core.js');
const data = require('../js/data.js');

const sections = data.sections;
const programming = sections[0];
const dsa = sections.find((s) => s.id === 'dsa');
const database = sections.find((s) => s.id === 'database');

test('searchUrl builds a valid YouTube search link', () => {
  const url = core.searchUrl('java full course');
  assert.match(url, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  assert.ok(!url.includes(' '), 'spaces must be encoded');
  assert.equal(core.searchUrl('  spaced  '), core.YOUTUBE_SEARCH + 'spaced');
});

test('searchUrl escapes symbols so links never break', () => {
  const url = core.searchUrl('C++ & C# "hello" 100%');
  assert.ok(!url.includes('"'), 'quotes must be encoded');
  assert.ok(!url.includes(' '), 'spaces must be encoded');
  assert.ok(url.includes('%26'), 'ampersand must be encoded');
  assert.equal(decodeURIComponent(url.split('=')[1]), 'C++ & C# "hello" 100%');
});

test('mainQuery appends the top channel, channelUrl is channel scoped', () => {
  const topic = dsa.topics.find((t) => t.t === 'Graph');
  assert.equal(core.mainQuery(topic), topic.q + ' ' + topic.ch[0]);
  assert.equal(core.mainQuery({ q: 'x', t: 'X' }), 'x', 'works without channels');
  assert.ok(core.channelUrl(topic, 'Abdul Bari').includes('Graph%20Abdul%20Bari'));
});

test('topicId is stable and unique per section', () => {
  const a = core.topicId({ id: 'dsa' }, { t: 'Stack' });
  const b = core.topicId({ id: 'programming' }, { t: 'Stack' });
  assert.equal(a, 'dsa::Stack');
  assert.notEqual(a, b);
});

test('matchesQuery is case-insensitive and matches descriptions too', () => {
  const topic = database.topics.find((t) => t.t === 'SQL Joins');
  assert.ok(core.matchesQuery(database, topic, 'JOINS'));
  assert.ok(core.matchesQuery(database, topic, 'inner'));
  assert.ok(core.matchesQuery(database, topic, 'sql joins'));
  assert.ok(core.matchesQuery(database, topic, '   '), 'empty query matches everything');
  assert.ok(!core.matchesQuery(database, topic, 'zzzz'));
});

test('matchesQuery requires every word to match', () => {
  const topic = dsa.topics.find((t) => t.t === 'Dynamic Programming');
  assert.ok(core.matchesQuery(dsa, topic, 'dynamic programming'));
  assert.ok(!core.matchesQuery(dsa, topic, 'dynamic hashing'));
});

test('filterSections filters by section', () => {
  const result = core.filterSections(sections, { sectionId: 'dsa' });
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].id, 'dsa');
  assert.equal(result.matched, dsa.topics.length);
  // total/completed are scoped to the selected tab, progress() is global
  assert.equal(result.total, dsa.topics.length);
  assert.equal(result.completed, 0);

  const all = core.filterSections(sections, {});
  assert.equal(all.total, sections.reduce((n, s) => n + s.topics.length, 0));
  assert.equal(all.sections.length, sections.length);
});

test('filterSections filters by query across all sections', () => {
  const result = core.filterSections(sections, { query: 'recursion' });
  assert.ok(result.matched >= 2, 'programming + dsa should both match');
  const titles = result.sections.flatMap((s) => s.topics.map((t) => t.t));
  assert.ok(titles.some((t) => t.includes('Recursion')));
  assert.ok(!titles.includes('CSS'));
});

test('filterSections hides finished topics and drops empty sections', () => {
  const first = programming.topics[0];
  const done = { [core.topicId(programming, first)]: true };
  const result = core.filterSections(sections, { sectionId: 'programming', hideDone: true, done });
  const visible = result.sections[0].topics.map((t) => t.t);
  assert.ok(!visible.includes(first.t));
  assert.equal(result.sections[0].topics.length, programming.topics.length - 1);

  // marking everything in a section done removes that whole section
  const allDone = {};
  programming.topics.forEach((t) => (allDone[core.topicId(programming, t)] = true));
  const emptied = core.filterSections(sections, { sectionId: 'programming', hideDone: true, done: allDone });
  assert.equal(emptied.sections.length, 0);
  assert.equal(emptied.matched, 0);
});

test('filterSections reports 0 matches for gibberish instead of crashing', () => {
  const result = core.filterSections(sections, { query: 'qqqzzz' });
  assert.deepEqual(result.sections, []);
  assert.equal(result.matched, 0);
  assert.ok(result.total > 0);
});

test('progress counts overall and per section', () => {
  const done = {
    [core.topicId(programming, programming.topics[0])]: true,
    [core.topicId(programming, programming.topics[1])]: true,
  };
  const p = core.progress(sections, done);
  assert.equal(p.completed, 2);
  assert.equal(p.total, sections.reduce((n, s) => n + s.topics.length, 0));
  assert.equal(p.bySection.programming.completed, 2);
  assert.equal(p.bySection.programming.total, programming.topics.length);
  assert.equal(p.percent, Math.round((2 / p.total) * 100));
  assert.equal(core.progress(sections, {}).percent, 0);
  assert.equal(core.progress([], {}).percent, 0, 'no divide by zero');
});

test('filterSections can show only bookmarked topics', () => {
  const stack = dsa.topics.find((t) => t.t === 'Stack');
  const joins = database.topics.find((t) => t.t === 'SQL Joins');
  const bookmarks = {
    [core.topicId(dsa, stack)]: true,
    [core.topicId(database, joins)]: true,
  };

  const result = core.filterSections(sections, { onlyBookmarked: true, bookmarks });
  assert.equal(result.matched, 2);
  assert.equal(result.sections.length, 2, 'keeps the section grouping');
  assert.deepEqual(result.sections[0].topics.map((t) => t.t), ['Stack']);
  assert.deepEqual(result.sections[1].topics.map((t) => t.t), ['SQL Joins']);
  assert.equal(result.total, 92, 'totals still describe the whole curriculum');

  // combined with a search query
  const narrowed = core.filterSections(sections, { onlyBookmarked: true, bookmarks, query: 'sql' });
  assert.equal(narrowed.matched, 1);
  assert.equal(narrowed.sections[0].topics[0].t, 'SQL Joins');

  // no bookmarks at all
  assert.equal(core.filterSections(sections, { onlyBookmarked: true, bookmarks: {} }).matched, 0);
});

test('countBookmarks ignores empty and falsy entries', () => {
  assert.equal(core.countBookmarks(null), 0);
  assert.equal(core.countBookmarks({}), 0);
  assert.equal(core.countBookmarks({ a: true, b: false, c: undefined }), 1);
  assert.equal(core.countBookmarks({ a: true, b: true, c: true }), 3);
});

test('allDone and setManyDone drive the per-section bulk action', () => {
  const ref = dsa;
  const topics = dsa.topics.slice(0, 3);

  assert.equal(core.allDone(ref, topics, {}), false);
  assert.equal(core.allDone(ref, [], {}), false, 'an empty list is never "all done"');

  const marked = core.setManyDone(ref, topics, {}, true);
  assert.equal(core.allDone(ref, topics, marked), true);
  assert.equal(Object.keys(marked).length, 3);
  assert.equal(marked[core.topicId(ref, topics[0])], true);

  // clearing leaves other topics untouched
  const other = dsa.topics[9];
  const withOther = Object.assign({}, marked, { [core.topicId(ref, other)]: true });
  const cleared = core.setManyDone(ref, topics, withOther, false);
  assert.equal(core.allDone(ref, topics, cleared), false);
  assert.equal(cleared[core.topicId(ref, other)], true, 'unrelated progress survives');
  assert.equal(Object.keys(cleared).length, 1);

  // does not mutate the input map
  assert.equal(Object.keys(marked).length, 3);
});

test('nextUp returns the first unfinished topic, null when all done', () => {
  const next = core.nextUp(sections, {});
  assert.equal(next.topic.t, programming.topics[0].t);
  const done = {};
  core.allTopics(sections).forEach(({ section, topic }) => (done[core.topicId(section, topic)] = true));
  assert.equal(core.nextUp(sections, done), null);
});

test('buildBackup keeps only real entries and reports counts', () => {
  const backup = core.buildBackup({
    done: { 'dsa::Stack': true, 'dsa::Queue': false, 'x': 'false', 'dsa::Graph': 1 },
    bookmarks: { 'tools::Git': true, 'tools::Docker Basics': undefined },
    version: '9.9.9',
    exportedAt: '2026-09-16T10:00:00.000Z',
  });

  assert.equal(backup.app, 'codepath');
  assert.equal(backup.kind, 'progress-backup');
  assert.equal(backup.version, '9.9.9');
  assert.equal(backup.exportedAt, '2026-09-16T10:00:00.000Z');
  assert.deepEqual(Object.keys(backup.done).sort(), ['dsa::Graph', 'dsa::Stack']);
  assert.deepEqual(Object.keys(backup.bookmarks), ['tools::Git']);
  assert.deepEqual(backup.counts, { completed: 2, favourites: 1 });

  const empty = core.buildBackup({});
  assert.deepEqual(empty.counts, { completed: 0, favourites: 0 });
  assert.deepEqual(empty.done, {});
  assert.ok(empty.exportedAt, 'stamps the export time');
});

test('serializeBackup is readable and round-trips through parseBackup', () => {
  const backup = core.buildBackup({ done: { 'dsa::Stack': true }, bookmarks: { 'web::CSS': true } });
  const json = core.serializeBackup(backup);
  assert.match(json, /\n {2}"app"/, 'pretty printed with 2 spaces');
  assert.ok(json.endsWith('\n'));

  const parsed = core.parseBackup(json);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.done, { 'dsa::Stack': true });
  assert.deepEqual(parsed.bookmarks, { 'web::CSS': true });
  assert.equal(parsed.completed, 1);
  assert.equal(parsed.favourites, 1);
});

test('parseBackup accepts a bare topicId map (and the favourites alias)', () => {
  const bare = core.parseBackup('{"dsa::Stack": true, "dsa::Heap": true}');
  assert.equal(bare.ok, true);
  assert.deepEqual(Object.keys(bare.done).sort(), ['dsa::Heap', 'dsa::Stack']);
  assert.deepEqual(bare.bookmarks, {});

  const alias = core.parseBackup({ favourites: { 'dsa::Stack': true } });
  assert.equal(alias.ok, true);
  assert.equal(alias.favourites, 1);
});

test('parseBackup drops unknown ids and junk values instead of trusting them', () => {
  const valid = core.knownTopicIds(sections);
  const parsed = core.parseBackup(
    JSON.stringify({
      done: { 'dsa::Stack': true, 'not-a-real-topic': true, 'dsa::Queue': 'yes' },
      bookmarks: { 'tools::Git': true, 'ghost::Thing': true },
    }),
    valid,
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.done, { 'dsa::Stack': true }, 'unknown id and "yes" were dropped');
  assert.deepEqual(parsed.bookmarks, { 'tools::Git': true });
  assert.equal(parsed.ignored, 3);
  assert.equal(parsed.completed, 1);
  assert.equal(parsed.favourites, 1);
});

test('parseBackup never throws on bad input', () => {
  const cases = ["not json at all", '[1,2,3]', '"just a string"', 'null', '42', '{}', '{"hello":"world"}'];
  for (const input of cases) {
    const parsed = core.parseBackup(input, core.knownTopicIds(sections));
    assert.equal(parsed.ok, false, 'rejected: ' + input);
    assert.equal(typeof parsed.error, 'string');
    assert.ok(parsed.error.length > 10, 'has a helpful message');
  }
  assert.match(core.parseBackup('[[[').error, /not valid JSON/);
  assert.match(core.parseBackup({ done: [] }).error, /array|No progress/);
});

test('backupFilename is dated and safe to download', () => {
  const name = core.backupFilename(new Date(2026, 8, 6, 12, 0, 0));
  assert.equal(name, 'codepath-backup-2026-09-06.json');
  assert.match(core.backupFilename(), /^codepath-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(core.backupFilename('nonsense'), core.backupFilename(), 'falls back to now');
});

test('plural handles singular and plural', () => {
  assert.equal(core.plural(1, 'topic'), '1 topic');
  assert.equal(core.plural(3, 'topic'), '3 topics');
  assert.equal(core.plural(0, 'match'), '0 matches');
  assert.equal(core.plural(2, 'unknown entry'), '2 unknown entries');
  assert.equal(core.plural(1, 'unknown entry'), '1 unknown entry');
  assert.equal(core.plural(5, 'saved favourite'), '5 saved favourites');
  assert.equal(core.plural(2, 'section'), '2 sections');
});
