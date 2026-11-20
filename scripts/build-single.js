/* Builds dist/unitask.html — the whole app in ONE file (CSS and JS inlined).
 * Handy for e-mailing the demo or hosting it anywhere as a single page.
 * Usage: node scripts/build-single.js [--embed]
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  `<style>\n${fs.readFileSync(path.join(root, href), 'utf8')}\n</style>`);

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${code}\n</script>`;
});

const embed = process.argv.includes('--embed');
if (embed) {
  html = html
    .replace(/#\/settings/g, '#prefs')
    .replace(/(["'])#\//g, '$1#')
    .replace(/<title>[^<]*<\/title>/, '<title>UniTask Demo</title>')
    .replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '')
    .replace(/<\/head>\s*<body>/i, '')
    .replace(/<\/body>\s*<\/html>\s*$/i, '');
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', embed ? 'unitask-embed.html' : 'unitask.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(1)} KB)`);
