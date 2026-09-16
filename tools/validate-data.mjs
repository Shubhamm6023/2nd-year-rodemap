/**
 * Curriculum integrity check:  node tools/validate-data.mjs
 *
 * Fails (exit 1) when a topic is missing required fields, ids/titles collide,
 * or any item from the requested syllabus has no matching topic.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const data = require('../js/data.js');
const core = require('../js/core.js');

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

/* ---------------------------------------------------- structural checks */

if (!data || !Array.isArray(data.sections) || !data.sections.length) {
  fail('APP_DATA.sections is missing or empty');
}

const sectionIds = new Set();
const topicIds = new Set();
let topicCount = 0;
let linkCount = 0;

for (const section of data.sections || []) {
  for (const key of ['id', 'title', 'icon', 'color', 'blurb']) {
    if (!section[key]) fail(`section "${section.id || '?'}" is missing ${key}`);
  }
  if (sectionIds.has(section.id)) fail(`duplicate section id: ${section.id}`);
  sectionIds.add(section.id);
  if (!/^#[0-9a-f]{6}$/i.test(section.color || '')) {
    fail(`section ${section.id}: color must be a #rrggbb hex value`);
  }
  if (!Array.isArray(section.topics) || !section.topics.length) {
    fail(`section ${section.id} has no topics`);
    continue;
  }
  for (const topic of section.topics) {
    topicCount++;
    if (!topic.t || !topic.d || !topic.q) {
      fail(`topic "${topic.t || '(untitled)'}" in ${section.id} is missing t/d/q`);
    }
    if (!Array.isArray(topic.ch) || !topic.ch.length) {
      fail(`topic "${topic.t}" in ${section.id} has no channels`);
    } else if (topic.ch.length < 2) {
      warnings.push(`topic "${topic.t}" only has one channel`);
    }
    if (topic.f && !Array.isArray(topic.f)) fail(`topic "${topic.t}": f must be an array`);
    const id = core.topicId(section, topic);
    if (topicIds.has(id)) fail(`duplicate topic id: ${id}`);
    topicIds.add(id);

    // every generated link must be a well-formed YouTube search URL
    for (const url of [core.mainUrl(topic)].concat((topic.ch || []).map((c) => core.channelUrl(topic, c)))) {
      linkCount++;
      if (!/^https:\/\/www\.youtube\.com\/results\?search_query=[^\s"<>]+$/.test(url)) {
        fail(`topic "${topic.t}" produced a malformed link: ${url}`);
      }
      if (core.mainQuery(topic).length > 120) {
        warnings.push(`topic "${topic.t}" has a very long search query`);
      }
    }
  }
}

const numbers = (data.sections || []).map((s) => s.no);
numbers.forEach((n, i) => {
  if (n !== i + 1) fail(`section numbering is not sequential at index ${i} (got ${n})`);
});

/* ------------------------------------------- requested syllabus coverage */

const REQUIRED = {
  'Section 1 · Programming': [
    'Variables', 'Input / Output', 'Operators', 'If-Else', 'Loops', 'Functions', 'Arrays',
    'Strings', 'Recursion', 'Class & Object', 'Inheritance', 'Polymorphism',
    'Encapsulation', 'Abstraction', 'Exception Handling', 'Collections',
  ],
  'Section 2 · DSA': [
    'Time & Space Complexity', 'Array', 'String', 'Linked List', 'Stack', 'Queue',
    'HashMap / HashSet', 'Sorting', 'Searching', 'Binary Search', 'Tree',
    'Binary Search Tree', 'Heap', 'Graph', 'Greedy', 'Dynamic Programming',
  ],
  'Section 3 · Web': ['HTML', 'CSS', 'JavaScript', 'React', 'REST API', 'JSON', 'Authentication'],
  'Section 4 · Backend (Java)': [
    'Java Core', 'Spring Core', 'Spring Boot', 'Spring MVC', 'Spring Security',
    'REST', 'Hibernate / Spring Data JPA',
  ],
  'Section 5 · Database': [
    'SQL Basics', 'MySQL / PostgreSQL', 'DBMS', 'Normalization', 'Joins', 'Indexing', 'Transactions',
  ],
  'Section 6 · CS Fundamentals': [
    'Operating System', 'Computer Networks', 'DBMS', 'OOP', 'Software Engineering',
  ],
  'Section 7 · Tools': ['Git', 'GitHub', 'Linux', 'Docker Basics', 'Cloud Basics'],
  'Section 8 · Projects': ['E-commerce', 'Chat Application', 'Job / College Management System'],
};

const allTitles = (data.sections || []).flatMap((s) => s.topics.map((t) => t.t));
const allText = allTitles.join(' | ').toLowerCase();

for (const [group, items] of Object.entries(REQUIRED)) {
  for (const item of items) {
    const needle = item.toLowerCase();
    const hit = allText.includes(needle) ||
      // allow close-enough wording (e.g. "Joins" -> "SQL Joins")
      needle.split(/\s*\/\s*/).some((part) => part && allText.includes(part));
    if (!hit) fail(`${group}: no topic found for "${item}"`);
  }
}

/* ------------------------------------------------------------------ report */

console.log(`Sections : ${(data.sections || []).length}`);
console.log(`Topics   : ${topicCount}`);
console.log(`Links    : ${linkCount} verified YouTube URLs`);
for (const section of data.sections) {
  console.log(
    `  ${String(section.no).padStart(2)}. ${section.icon} ${section.title.padEnd(20)} ${core.plural(section.topics.length, 'topic')}`,
  );
}

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log(`  ! ${w}`));
}

if (errors.length) {
  console.error('\nFAILED:');
  errors.forEach((e) => console.error(`  x ${e}`));
  process.exit(1);
}
console.log('\nOK: curriculum data is valid.');
