/**
 * Builds a real, signed CodePath APK without Gradle.
 *
 *   node tools/build-android.mjs [--sdk <path to Android SDK>]
 *
 * Pipeline (build-tools only, no third-party libraries):
 *   1. stage the web app into assets/www
 *   2. aapt2 compile + link resources (also generates R.java)
 *   3. javac the single activity, then d8 it into classes.dex
 *   4. add classes.dex, zipalign, sign with a local debug keystore
 *   5. verify the signature and print the badging summary
 *
 * The SDK is looked up in ANDROID_HOME / ANDROID_SDK_ROOT / ./.android-sdk.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, cpSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');
const BUILD = join(ANDROID, 'build');
const ASSETS = join(BUILD, 'assets', 'www');
const OUT_APK = join(ROOT, 'codepath-debug.apk');

const MIN_SDK = 24;
const PACKAGE = 'com.codepath.app';

/** Everything the web app needs at runtime. */
const STAGE = ['index.html', 'styles.css', 'app.webmanifest', 'sw.js', 'js', 'icons'];

const KEYSTORE = join(BUILD, 'debug.keystore');
const KEY_ALIAS = 'androiddebugkey';
const KEY_PASS = 'android';

/* ------------------------------------------------------------- helpers --- */

const log = (message) => console.log(message);
const step = (n, message) => console.log(`\n[${n}] ${message}`);

function run(label, command, args) {
  const pretty = [command, ...args].join(' ');
  console.log(`  $ ${pretty}`);
  const isWindows = process.platform === 'win32';
  const result = isWindows
    ? spawnSync(`"${command}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`, {
        shell: true,
        stdio: 'inherit',
      })
    : spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function fail(message, hint) {
  console.error(`\nBUILD FAILED: ${message}`);
  if (hint) console.error(`\n${hint}`);
  process.exit(1);
}

function walk(dir, filter, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

function capture(command, args) {
  const isWindows = process.platform === 'win32';
  const result = isWindows
    ? spawnSync(`"${command}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`, {
        shell: true,
        encoding: 'utf8',
      })
    : spawnSync(command, args, { encoding: 'utf8' });
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function javaTool(name) {
  const home = process.env.JAVA_HOME;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  if (home && existsSync(join(home, 'bin', exe))) return join(home, 'bin', exe);
  return name; // rely on PATH
}

/* ---------------------------------------------------------- SDK lookup --- */

const sdkFlag = process.argv.indexOf('--sdk');
const sdkCandidates = [
  sdkFlag !== -1 ? process.argv[sdkFlag + 1] : null,
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  join(ROOT, '.android-sdk'),
  join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  join(process.env.HOME || process.env.USERPROFILE || '', 'Android', 'Sdk'),
].filter(Boolean);

const sdk = sdkCandidates.find((dir) => existsSync(join(dir, 'build-tools')));

if (!sdk) {
  fail(
    'no Android SDK found (looked for a build-tools folder).',
    `Install it once, then re-run this script:

  # 1. command line tools (about 150 MB)
  curl -L -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip
  unzip -q cmdline-tools.zip -d .android-sdk-tmp
  mkdir -p .android-sdk/cmdline-tools/latest
  mv .android-sdk-tmp/cmdline-tools/* .android-sdk/cmdline-tools/latest/
  rm -rf .android-sdk-tmp cmdline-tools.zip

  # 2. the pieces this build needs (a JDK 17 must be on JAVA_HOME)
  .android-sdk/cmdline-tools/latest/bin/sdkmanager.bat --sdk_root=.android-sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"

  # 3. build
  node tools/build-android.mjs

Or pass an existing SDK:  node tools/build-android.mjs --sdk "C:/path/to/Android/Sdk"`,
  );
}

const buildToolsDir = readdirSync(join(sdk, 'build-tools'))
  .map((name) => ({ name, path: join(sdk, 'build-tools', name) }))
  .filter((entry) => statSync(entry.path).isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  .pop();

if (!buildToolsDir) fail(`no build-tools installed in ${sdk}`);

const platformsDir = join(sdk, 'platforms');
if (!existsSync(platformsDir)) fail(`no platforms installed in ${sdk}`);

const platform = readdirSync(platformsDir)
  .filter((name) => name.startsWith('android-'))
  .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
  .pop();

if (!platform) fail(`no android platform installed in ${platformsDir}`);

const androidJar = join(platformsDir, platform, 'android.jar');
if (!existsSync(androidJar)) fail(`missing ${androidJar}`);

const aapt2 = join(buildToolsDir.path, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
const zipalign = join(buildToolsDir.path, process.platform === 'win32' ? 'zipalign.exe' : 'zipalign');
const apksigner = join(buildToolsDir.path, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
const d8 = join(buildToolsDir.path, process.platform === 'win32' ? 'd8.bat' : 'd8');

for (const [name, path] of Object.entries({ aapt2, zipalign, apksigner, d8 })) {
  if (!existsSync(path)) fail(`build-tools ${buildToolsDir.name} is missing ${name} (${path})`);
}

log('CodePath → Android APK');
log(`  SDK          ${sdk}`);
log(`  build-tools  ${buildToolsDir.name}`);
log(`  platform     ${platform}`);

/* ------------------------------------------------------ 0. icon refresh --- */

step(0, 'Android icons');
const iconsReady = [
  'mipmap-xxxhdpi/ic_launcher.png',
  'mipmap-xxxhdpi/ic_launcher_foreground.png',
  'mipmap-xxxhdpi/ic_launcher_background.png',
].every((file) => existsSync(join(ANDROID, 'res', file)));

if (iconsReady) {
  log('  launcher icons already generated');
} else {
  run('icon generation', process.execPath, [join(ROOT, 'tools', 'make-icons.mjs')]);
}

/* ----------------------------------------------------- 1. stage assets --- */

step(1, 'Staging the web app into assets/www');
rmSync(join(BUILD, 'assets'), { recursive: true, force: true });
mkdirSync(ASSETS, { recursive: true });

let staged = 0;
for (const entry of STAGE) {
  const from = join(ROOT, entry);
  if (!existsSync(from)) fail(`missing asset source: ${entry}`);
  if (statSync(from).isDirectory()) cpSync(from, join(ASSETS, entry), { recursive: true });
  else cpSync(from, join(ASSETS, entry));
}
staged = walk(ASSETS, () => true).length;
log(`  ${staged} files → assets/www`);

if (!existsSync(join(ASSETS, 'index.html'))) fail('assets/www/index.html was not staged');

/* ------------------------------------------------------- 2. resources --- */

step(2, 'Compiling resources (aapt2)');
mkdirSync(BUILD, { recursive: true });
const compiledRes = join(BUILD, 'res.zip');
const baseApk = join(BUILD, 'base.apk');
const genDir = join(BUILD, 'gen');
rmSync(compiledRes, { force: true });
rmSync(genDir, { recursive: true, force: true });

run('aapt2 compile', aapt2, ['compile', '--dir', join(ANDROID, 'res'), '-o', compiledRes]);

run('aapt2 link', aapt2, [
  'link',
  '-o', baseApk,
  '-I', androidJar,
  '--manifest', join(ANDROID, 'AndroidManifest.xml'),
  '-R', compiledRes,
  '-A', join(BUILD, 'assets'),
  '--java', genDir,
  '--min-sdk-version', String(MIN_SDK),
  '--target-sdk-version', platform.split('-')[1],
  '--auto-add-overlay',
]);

/* ------------------------------------------------- 3. java → classes.dex --- */

step(3, 'Compiling Java and dexing (javac + d8)');
const classesDir = join(BUILD, 'classes');
const dexDir = join(BUILD, 'dex');
rmSync(classesDir, { recursive: true, force: true });
rmSync(dexDir, { recursive: true, force: true });
mkdirSync(classesDir, { recursive: true });
mkdirSync(dexDir, { recursive: true });

const rJava = walk(genDir, (f) => f.endsWith('.java'));
const sources = [...walk(join(ANDROID, 'java'), (f) => f.endsWith('.java')), ...rJava];
log(`  ${sources.length} java sources`);

run('javac', javaTool('javac'), [
  '-source', '8',
  '-target', '8',
  '-nowarn',
  '-encoding', 'UTF-8',
  '-classpath', androidJar,
  '-d', classesDir,
  ...sources,
]);

const classFiles = walk(classesDir, (f) => f.endsWith('.class'));
if (!classFiles.length) fail('javac produced no class files');

run('d8', d8, [
  '--release',
  '--min-api', String(MIN_SDK),
  '--lib', androidJar,
  '--output', dexDir,
  ...classFiles,
]);

const dexFile = join(dexDir, 'classes.dex');
if (!existsSync(dexFile)) fail('d8 did not produce classes.dex');

/* ----------------------------------------------- 4. package, align, sign --- */

step(4, 'Packaging, aligning and signing');
run('add classes.dex', javaTool('jar'), ['uf', baseApk, '-C', dexDir, 'classes.dex']);

const unalignedApk = join(BUILD, 'unaligned.apk');
const alignedApk = join(BUILD, 'aligned.apk');
rmSync(unalignedApk, { force: true });
rmSync(alignedApk, { force: true });
cpSync(baseApk, unalignedApk);
run('zipalign', zipalign, ['-f', '-p', '4', unalignedApk, alignedApk]);

if (!existsSync(KEYSTORE)) {
  log('  creating a local debug keystore (android/build/debug.keystore)');
  run('keytool', javaTool('keytool'), [
    '-genkeypair',
    '-keystore', KEYSTORE,
    '-alias', KEY_ALIAS,
    '-storepass', KEY_PASS,
    '-keypass', KEY_PASS,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-dname', 'CN=Android Debug,O=Android,C=US',
  ]);
}

rmSync(OUT_APK, { force: true });
run('apksigner sign', apksigner, [
  'sign',
  '--ks', KEYSTORE,
  '--ks-key-alias', KEY_ALIAS,
  '--ks-pass', `pass:${KEY_PASS}`,
  '--key-pass', `pass:${KEY_PASS}`,
  '--v1-signing-enabled', 'false',
  '--v2-signing-enabled', 'true',
  '--v3-signing-enabled', 'true',
  '--out', OUT_APK,
  alignedApk,
]);

/* ------------------------------------------------------- 5. verify --- */

step(5, 'Verifying the APK');
run('apksigner verify', apksigner, ['verify', '--print-certs', '--verbose', OUT_APK]);

const badgingText = capture(aapt2, ['dump', 'badging', OUT_APK]);
for (const line of badgingText.split('\n')) {
  if (/^(package:|launchable-activity:|sdkVersion:|targetSdkVersion:|application-label:)/.test(line.trim())) {
    console.log('  ' + line.trim());
  }
}

const size = statSync(OUT_APK).size;
const apkEntries = capture(process.platform === 'win32' ? javaTool('jar') : 'unzip', ['tf', OUT_APK]);
const assets = apkEntries.includes('assets/www/index.html') ? 'yes' : 'unknown';

const manifest = readFileSync(join(ANDROID, 'AndroidManifest.xml'), 'utf8');
const pkg = (manifest.match(/package="([^"]+)"/) || [])[1];

log(`\nAPK ready: ${relative(ROOT, OUT_APK).replace(/\\/g, '/')}`);
log(`  package      ${pkg || PACKAGE}`);
log(`  size         ${(size / 1024).toFixed(1)} KB`);
log(`  web assets   ${assets}`);
log('\nInstall it with:');
log(`  adb install -r "${OUT_APK}"   (or copy the file to the phone and tap it)`);
