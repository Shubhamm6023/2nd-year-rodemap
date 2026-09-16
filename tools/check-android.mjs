/**
 * Android project integrity check:  node tools/check-android.mjs
 *
 * Runs offline (no SDK needed) and fails when the manifest, the activity, the
 * resources, the launcher icons or the staged web assets drift apart — for
 * example when app.js and MainActivity stop sharing the same JS bridge name.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (message) => problems.push(message);
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const has = (path) => existsSync(join(ROOT, path));

/* ------------------------------------------------------------- manifest --- */

const manifestPath = 'android/AndroidManifest.xml';
if (!has(manifestPath)) fail('android/AndroidManifest.xml is missing');
const manifest = has(manifestPath) ? read(manifestPath) : '';

const pkg = (manifest.match(/package="([^"]+)"/) || [])[1];
if (!pkg) fail('manifest has no package attribute');

const manifestRules = [
  ['the INTERNET permission (YouTube links)', /uses-permission[^>]+INTERNET/],
  ['the MainActivity declaration', /<activity[^>]*android:name="\.MainActivity"/],
  ['an exported activity (required from API 31)', /android:exported="true"/],
  ['a LAUNCHER intent filter', /android\.intent\.category\.LAUNCHER/],
  ['a versionCode', /android:versionCode="\d+"/],
  ['a versionName', /android:versionName="[^"]+"/],
  ['the launcher icon', /android:icon="@mipmap\/ic_launcher"/],
  ['the round launcher icon', /android:roundIcon="@mipmap\/ic_launcher_round"/],
  ['the app theme', /android:theme="@style\/AppTheme"/],
  ['configChanges so rotation does not reload the app', /android:configChanges="[^"]*orientation[^"]*screenSize/],
  ['cleartext traffic disabled', /android:usesCleartextTraffic="false"/],
];
for (const [label, pattern] of manifestRules) {
  if (!pattern.test(manifest)) fail(`manifest is missing: ${label}`);
}

/* ------------------------------------------------------------- activity --- */

const activityPath = 'android/java/com/codepath/app/MainActivity.java';
const activity = has(activityPath) ? read(activityPath) : '';
if (!activity) fail(`${activityPath} is missing`);

const activityRules = [
  ['the packaged web app URL', /file:\/\/\/android_asset\/www\/index\.html/],
  ['JavaScript enabled', /setJavaScriptEnabled\(true\)/],
  ['DOM storage enabled (progress + favourites)', /setDomStorageEnabled\(true\)/],
  ['the file picker for importing backups', /onShowFileChooser/],
  ['the file picker result handling', /onActivityResult/],
  ['a download listener', /setDownloadListener/],
  ['external links opening outside the app', /ACTION_VIEW/],
  ['the Android back button handling', /onBackPressed/],
  ['local content staying in the WebView', /scheme\.equals\("file"\)/],
];
for (const [label, pattern] of activityRules) {
  if (!pattern.test(activity)) fail(`MainActivity is missing: ${label}`);
}
if (/import\s+androidx\./.test(activity)) {
  fail('MainActivity imports androidx — this build has no support libraries');
}
if (!/^package\s+com\.codepath\.app;/m.test(activity)) {
  fail('MainActivity should live in the com.codepath.app package');
}

/* --------------------------------------------------- bridge consistency --- */

const bridgeName = (activity.match(/BRIDGE_NAME\s*=\s*"([^"]+)"/) || [])[1];
const appJs = read('js/app.js');

if (!bridgeName) {
  fail('MainActivity does not define BRIDGE_NAME');
} else {
  if (!appJs.includes(`window.${bridgeName}`)) {
    fail(`js/app.js never looks for window.${bridgeName} (bridge names must match)`);
  }
  // the registration call, e.g. addJavascriptInterface(new BackupBridge(), BRIDGE_NAME)
  const afterAdd = activity.split('addJavascriptInterface')[1] || '';
  const call = afterAdd.slice(0, 60);
  if (!call.includes(bridgeName) && !call.includes('BRIDGE_NAME')) {
    fail(`MainActivity does not register the ${bridgeName} bridge`);
  }
}

const bridgeMethod =
  (appJs.match(/typeof bridge\.(\w+) === 'function'/) || [])[1] ||
  (appJs.match(new RegExp(`window\\.${bridgeName}\\.(\\w+)`)) || [])[1];

if (!bridgeMethod) {
  fail('js/app.js does not check for a concrete bridge method');
} else {
  const exposed = activity
    .split('@JavascriptInterface')
    .slice(1)
    .map((chunk) => chunk.slice(0, 90))
    .some((chunk) => chunk.includes(bridgeMethod + '('));
  if (!exposed) {
    fail(`MainActivity does not expose ${bridgeMethod}() through @JavascriptInterface`);
  }
}

/* ------------------------------------------------------------ resources --- */

const strings = has('android/res/values/strings.xml') ? read('android/res/values/strings.xml') : '';
if (!strings) fail('android/res/values/strings.xml is missing');
for (const ref of new Set([...activity.matchAll(/R\.string\.(\w+)/g)].map((m) => m[1]))) {
  if (!strings.includes(`<string name="${ref}"`)) {
    fail(`MainActivity uses R.string.${ref} but it is not defined in strings.xml`);
  }
}

const colors = has('android/res/values/colors.xml') ? read('android/res/values/colors.xml') : '';
for (const ref of new Set([...manifest.matchAll(/@color\/(\w+)/g)].map((m) => m[1]))) {
  if (!colors.includes(`<color name="${ref}"`)) {
    fail(`@color/${ref} is referenced but not defined in colors.xml`);
  }
}

const baseTheme = has('android/res/values/themes.xml') ? read('android/res/values/themes.xml') : '';
const v31Theme = has('android/res/values-v31/themes.xml') ? read('android/res/values-v31/themes.xml') : '';
const themeItems = (theme) => [...theme.matchAll(/<item name="([^"]+)"/g)].map((m) => m[1]);

for (const [label, theme] of [['themes.xml', baseTheme], ['values-v31/themes.xml', v31Theme]]) {
  if (!theme) {
    fail(`${label} is missing`);
    continue;
  }
  if (!theme.includes('<style name="AppTheme"')) fail(`${label} does not define AppTheme`);
  if (!theme.includes('parent="@android:style/')) {
    fail(`${label} must use a framework theme parent (no AppCompat available)`);
  }
  if (theme.includes('AppCompat') || theme.includes('MaterialComponents')) {
    fail(`${label} needs a support library theme`);
  }
}
for (const item of themeItems(baseTheme)) {
  // a config-specific style replaces the base one entirely
  if (!themeItems(v31Theme).includes(item)) {
    fail(`values-v31/themes.xml drops <item ${item}> that the base theme sets`);
  }
}

/* ------------------------------------------------------ launcher icons --- */

const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

for (const [density, scale] of DENSITIES) {
  for (const [name, size] of [
    ['ic_launcher.png', 48 * scale],
    ['ic_launcher_round.png', 48 * scale],
    ['ic_launcher_background.png', 108 * scale],
    ['ic_launcher_foreground.png', 108 * scale],
  ]) {
    const path = `android/res/mipmap-${density}/${name}`;
    if (!has(path)) {
      fail(`missing launcher icon: ${path}`);
      continue;
    }
    const buf = readFileSync(join(ROOT, path));
    if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      fail(`${path} is not a PNG`);
      continue;
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width !== size || height !== size) {
      fail(`${path} is ${width}x${height}, expected ${size}x${size}`);
    }
  }
}

const adaptiveDir = 'android/res/mipmap-anydpi-v26';
if (!has(adaptiveDir)) {
  fail('android/res/mipmap-anydpi-v26 is missing (adaptive icons for Android 8+)');
} else {
  const files = readdirSync(join(ROOT, adaptiveDir));
  for (const wanted of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    if (!files.includes(wanted)) {
      fail(`missing ${adaptiveDir}/${wanted}`);
      continue;
    }
    const xml = read(`${adaptiveDir}/${wanted}`);
    for (const layer of ['background', 'foreground']) {
      const ref = (xml.match(new RegExp(`<${layer} android:drawable="@mipmap/(\\w+)"`)) || [])[1];
      if (!ref) {
        fail(`${wanted} has no ${layer} layer`);
      } else if (!has(`android/res/mipmap-xxxhdpi/${ref}.png`)) {
        fail(`${wanted} references @mipmap/${ref} which does not exist`);
      }
    }
  }
}

/* -------------------------------------------------------- staged assets --- */

const build = read('tools/build-android.mjs');
const stageBlock = build.match(/const STAGE = \[([^\]]+)\]/);
if (!stageBlock) {
  fail('tools/build-android.mjs has no STAGE list');
} else {
  const staged = [...stageBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const entry of ['index.html', 'styles.css', 'js', 'icons']) {
    if (!staged.includes(entry)) fail(`the APK would not include ${entry}`);
  }
  for (const entry of staged) {
    if (!has(entry)) fail(`STAGE lists ${entry} but it does not exist`);
  }

  // every asset index.html loads must be reachable inside assets/www
  const html = read('index.html');
  const isStaged = (file) => staged.some((entry) => entry === file || file.startsWith(entry + '/'));
  for (const match of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(ref)) continue;
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean || clean === './') continue;
    if (!has(clean)) {
      fail(`index.html references ${clean} which does not exist`);
    } else if (!isStaged(clean)) {
      fail(`index.html loads ${clean} but the APK does not stage it`);
    }
  }
}

/* ----------------------------------------------------------- script list --- */

const pkgJson = JSON.parse(read('package.json'));
for (const script of ['android:build', 'android:check', 'android:icons', 'icons']) {
  if (!pkgJson.scripts || !pkgJson.scripts[script]) {
    fail(`package.json has no "${script}" script`);
  }
}

/* --------------------------------------------------------------- report --- */

if (problems.length) {
  console.error('FAILED:');
  problems.forEach((p) => console.error(`  x ${p}`));
  process.exit(1);
}
console.log(`OK: android project is valid (package ${pkg}).`);
console.log('    21 launcher icons · manifest, activity, resources and JS bridge all consistent.');
