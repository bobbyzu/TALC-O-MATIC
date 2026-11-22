#!/usr/bin/env node
// TALC-O-MATIC BBS : générateur statique local.
// Fichier nouveau, non issu du code d'Hypervibe 3.4.17 (voir MODIFICATIONS.md).
// Version 0.1 écrite par Aël. Modifié par Silex le 2026-11-09 (contre-audit, v0.1.1) :
// les liens symboliques sont refusés et les écritures sont atomiques, le manifeste est validé
// et écrit en premier, une commande `rebuild` répare un état partiel, et le serveur est durci
// (contrôle de l'en-tête Host, port occupé signalé). Détail dans MODIFICATIONS.md.
import { mkdir, writeFile, readFile, lstat, rename, rm, open, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const title = 'TALC-O-MATIC 0.3.0';
const THEMES = ['bbs', 'editorial', 'technique'];
const VIEWS = ['perso', 'bbs', 'technique', 'editorial', 'brut'];
const VIEW_LABELS = { perso: 'Personal Web', bbs: 'BBS lisible', technique: 'Technique', editorial: 'Éditorial', brut: 'HTML essentiel' };
function validTheme(x) { return THEMES.includes(x); }
function themeOf(m) { return m.theme ?? 'bbs'; }
const PORT = 8765;
const BIND = '127.0.0.1';
const MAX_LABEL = 120;
const MAX_BODY = 20000;

const args = process.argv.slice(2);
const [cmd, project, ...rest] = args;

class UserError extends Error {}
function fail(msg) { console.error(`ERREUR: ${msg}`); process.exitCode = 1; }
function safeSlug(s) { return typeof s === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(s) && !s.endsWith('-'); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// --- Système de fichiers : aucun lien symbolique n'est suivi -----------------------------------

// Le dossier doit être un vrai dossier, pas un lien symbolique.
async function assertRealDir(p) {
  let s;
  try { s = await lstat(p); } catch (e) { throw new UserError(`Dossier introuvable : ${p}`); }
  if (!s.isDirectory()) throw new UserError(`Pas un dossier réel (lien symbolique refusé) : ${p}`);
}

// Si le chemin existe, ce doit être un fichier ordinaire. Un lien symbolique est refusé.
async function assertRegularOrAbsent(p) {
  try {
    const s = await lstat(p);
    if (!s.isFile()) throw new UserError(`Fichier non ordinaire refusé (lien symbolique ?) : ${p}`);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}

// Création exclusive : échoue si le chemin existe, même sous forme de lien symbolique (O_EXCL).
async function putNew(p, data) { await writeFile(p, data, { encoding: 'utf8', flag: 'wx', mode: 0o644 }); }

// Remplacement atomique : écrit dans un fichier temporaire du même dossier, le synchronise sur
// le disque, puis le renomme. rename() remplace l'entrée elle-même sans suivre de lien : un fichier
// n'est jamais à moitié écrit, et aucune cible extérieure n'est touchée.
async function atomicWrite(p, data) {
  await assertRegularOrAbsent(p);
  const tmp = `${p}.tmp-${randomBytes(6).toString('hex')}`;
  const fh = await open(tmp, 'wx', 0o644);
  try { await fh.writeFile(data, 'utf8'); await fh.sync(); } finally { await fh.close(); }
  try { await rename(tmp, p); } catch (e) { await rm(tmp, { force: true }); throw e; }
}

// --- Projet et manifeste ------------------------------------------------------------------------

async function projectRoot(name) {
  if (!safeSlug(name)) throw new UserError('Nom de projet invalide');
  const root = resolve(name);
  await assertRealDir(root);
  await assertRealDir(join(root, 'site'));
  return root;
}

function validateManifest(m) {
  if (!m || typeof m !== 'object' || !Array.isArray(m.pages)) throw new UserError('Manifeste invalide : "pages" manquant');
  if (m.theme !== undefined && !validTheme(m.theme)) throw new UserError('Manifeste invalide : thème inconnu');
  if (m.multiViews !== undefined && typeof m.multiViews !== 'boolean') throw new UserError('Manifeste invalide : multiViews');
  const seen = new Set();
  for (const p of m.pages) {
    if (!p || typeof p !== 'object') throw new UserError('Manifeste invalide : entrée de page incorrecte');
    if (!safeSlug(p.slug)) throw new UserError(`Manifeste invalide : slug non conforme (${String(p.slug).slice(0, 60)})`);
    if (seen.has(p.slug)) throw new UserError(`Manifeste invalide : slug en double (${p.slug})`);
    seen.add(p.slug);
    if (typeof p.label !== 'string' || !p.label || p.label.length > MAX_LABEL) throw new UserError(`Manifeste invalide : titre incorrect (${p.slug})`);
    if (typeof p.body !== 'string' || p.body.length > MAX_BODY) throw new UserError(`Manifeste invalide : texte incorrect (${p.slug})`);
    if (p.lede !== undefined && (typeof p.lede !== 'string' || p.lede.length > 240)) throw new UserError(`Manifeste invalide : accroche incorrecte (${p.slug})`);
  }
  if (!seen.has('index')) throw new UserError('Manifeste invalide : page "index" absente');
  return m;
}

async function readManifest(root) {
  const f = join(root, 'bbs.json');
  if (!(await assertRegularOrAbsent(f))) throw new UserError('Manifeste bbs.json absent');
  let m;
  try { m = JSON.parse(await readFile(f, 'utf8')); } catch { throw new UserError('Manifeste bbs.json illisible (JSON invalide) : rien n\'a été modifié'); }
  return validateManifest(m);
}

function manifestText(m) { return JSON.stringify(m, null, 2) + '\n'; }

// --- Rendu HTML ---------------------------------------------------------------------------------

// Mini-Markdown à base de liste blanche : jamais de HTML arbitraire.
// Le texte et les attributs sont échappés avant le rendu des syntaxes autorisées.
function inlineMd(s) {
  const tokens = [];
  const protect = value => { const k = `\u0000${tokens.length}\u0000`; tokens.push(value); return k; };
  // Les NUL servent de délimiteurs de jetons : ils sont retirés du texte source (durcissement du rendu Markdown).
  let v = String(s).replace(/\u0000/g, '').replace(/`([^`\n]+)`/g, (_m, x) => protect(`<code>${esc(x)}</code>`));
  v = esc(v);
  // Gras d'abord, en autorisant un italique à l'intérieur ; puis italique sans espace collé aux astérisques.
  v = v.replace(/\*\*(?!\s)(.+?)(?<!\s)\*\*/g, '<strong>$1</strong>');
  v = v.replace(/\*(?![\s*])([^*\n]+?)(?<!\s)\*/g, '<em>$1</em>');
  return v.replace(/\u0000(\d+)\u0000/g, (_m, n) => tokens[Number(n)] ?? '');
}
function renderMd(input) {
  const lines = String(input).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let i = 0;
  while (i < lines.length) {
    const x = lines[i];
    if (!x.trim()) { i++; continue; }
    if (/^```/.test(x)) {
      const mode = x.slice(3).trim(); const payload = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) payload.push(lines[i++]);
      if (i < lines.length) i++;
      out.push(`<pre><code>${esc(payload.join('\n'))}</code></pre>`);
      continue;
    }
    const img = x.trim().match(/^!\[([^\]\n]{0,120})\]\(([a-z0-9-]+\.svg)\)$/i);
    if (img) { out.push(`<figure><img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy"></figure>`); i++; continue; }
    const heading = x.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const level=Math.min(heading[1].length+1, 6); out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`); i++; continue; }
    if (/^\s*---+\s*$/.test(x)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>\s?/.test(x)) {
      const group=[]; while(i<lines.length && /^\s*>\s?/.test(lines[i])) group.push(lines[i++].replace(/^\s*>\s?/,''));
      out.push(`<blockquote><p>${inlineMd(group.join(' '))}</p></blockquote>`); continue;
    }
    if (/^\|/.test(x) && i+1<lines.length && /^\|[\s:|\-]+\|\s*$/.test(lines[i+1])) {
      const cells = row => row.trim().replace(/^\||\|$/g,'').split('|').map(c=>inlineMd(c.trim()));
      const head = cells(x); i+=2; const rows=[];
      while (i<lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i++])); }
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${head.map((_h,j)=>`<td>${row[j]??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const li=x.match(/^\s*(?:([-*])|(1)\.)\s+(.+)$/);
    if (li) {
      const ordered=Boolean(li[2]), tag=ordered?'ol':'ul', entries=[];
      while (i<lines.length) {
        const match=lines[i].match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);
        if (!match || Boolean(match[2])!==ordered) break;
        entries.push(`<li>${inlineMd(match[3])}</li>`);i++;
      }
      out.push(`<${tag}>${entries.join('')}</${tag}>`); continue;
    }
    const para=[];
    while(i<lines.length && lines[i].trim() && !/^(?:#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s|\s*>\s?|\|)/.test(lines[i])) {
      para.push(lines[i++].trim());
    }
    if (para.length) out.push(`<p>${inlineMd(para.join(' '))}</p>`);
    else {out.push(`<p>${inlineMd(lines[i])}</p>`); i++;}
  }
  return out.join('\n');
}

function page(slug, label, body, pages, theme = 'bbs', lede = '') {
  const nav = pages.map(p => `<a href="${esc(p.slug)}.html"${p.slug === slug ? ' aria-current="page"' : ''}>${theme === 'bbs' ? '[' : ''}${esc(p.label)}${theme === 'bbs' ? ']' : ''}</a>`).join(' ');
  const text = renderMd(body);
  const intro = lede ? `<p class="lede">${esc(lede)}</p>` : ''; 
  if (theme === 'bbs') return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · BBS</title><link rel="stylesheet" href="style.css"></head>\n<body><header><pre aria-hidden="true">+----------------------------------------+\n|     TALC-O-MATIC : BULLETIN BOARD      |\n+----------------------------------------+</pre><h1>${esc(label)}</h1><nav aria-label="Rubriques">${nav}</nav></header>\n<main>${intro}<article>${text}</article></main><footer>LOCAL BBS · HTML + CSS · NO TRACKERS</footer></body></html>\n`;
  if (theme === 'editorial') return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · TALC-O-MATIC</title><link rel="stylesheet" href="style.css"></head>\n<body><header class="topbar"><a class="brand" href="index.html">TALC—O—MATIC</a><nav aria-label="Rubriques">${nav}</nav></header><main><section class="hero"><span class="eyebrow">CARNETS · ÉDITORIAL</span><h1>${esc(label)}</h1>${intro}</section><div class="content"><aside><span class="eyebrow">PROTOTYPE LOCAL</span><p>HTML et CSS indépendants</p></aside><article>${text}<div class="rule"></div><small>TALC-O-MATIC · Aucun script · Aucune ressource externe</small></article></div></main><footer>Des outils simples, pour ceux qui les utilisent.</footer></body></html>\n`;
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · TALC-O-MATIC</title><link rel="stylesheet" href="style.css"></head>\n<body><div class="shell"><header class="top"><a href="index.html" class="logo"><span class="mark">◆</span> TALC-O-MATIC</a><nav aria-label="Rubriques">${nav}</nav></header><section class="banner"><span class="kicker">LIGHTWEIGHT · LOCAL · OPEN</span><h1>${esc(label)}</h1><p>Simple. Lisible. Reproductible.</p>${intro}</section><main class="panel"><article>${text}</article></main><footer>Prototype technique · HTML + CSS · sans dépendance externe</footer></div></body></html>\n`;
}

const styles = {
  bbs: `:root{color-scheme:dark;--fg:#b7ffab;--bg:#07140d;--border:#3d995e}*{box-sizing:border-box}body{margin:0 auto;max-width:68rem;padding:1.5rem;background:var(--bg);color:var(--fg);font:1.08rem/1.7 ui-monospace,Consolas,monospace}header,main,footer{margin:1.3rem 0;border:1px solid var(--border);padding:1.2rem}pre{overflow:auto;line-height:1.2}h1{font-size:1.5rem}a{color:#f8d782;display:inline-block;margin:.3rem}a:focus-visible{outline:3px solid #fff}nav{border-top:1px dashed var(--border);padding-top:1rem}footer{font-size:.75rem}::selection{background:#356a4a;color:white}\n`,
  editorial: `:root{--paper:#f5f1e8;--ink:#242b28;--muted:#647168;--line:#d8d5cb;--accent:#416854}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.7 system-ui,sans-serif}a{color:inherit;text-underline-offset:4px}a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.topbar{max-width:1150px;margin:auto;padding:1.4rem 1.6rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--line)}.brand{font-weight:800;letter-spacing:.11em;text-decoration:none;font-size:.85rem}nav{display:flex;flex-wrap:wrap;gap:1rem}nav a{font-size:.85rem;text-decoration:none}nav a[aria-current]{text-decoration:underline}.hero{max-width:1150px;margin:auto;padding:5rem 1.6rem 4rem;border-bottom:1px solid var(--line)}.eyebrow{font:.72rem/1.5 system-ui,sans-serif;letter-spacing:.16em;color:var(--accent);font-weight:750}.hero h1{font:normal clamp(3rem,7vw,6rem)/1.07 Georgia,serif;letter-spacing:-.05em;margin:1.2rem 0}.lede{color:var(--muted);font-size:1.25rem}.content{max-width:1150px;margin:auto;padding:4rem 1.6rem 6rem;display:grid;grid-template-columns:180px minmax(0,740px);gap:4rem}.content aside{font-size:.85rem;color:var(--muted)}article h2{font:normal 2.4rem/1.2 Georgia,serif;margin:0 0 1.8rem}article p{white-space:normal;font-size:1.15rem}article .rule{border-top:1px solid var(--line);margin:3rem 0 1rem}article small{color:var(--muted)}footer{background:#26332d;color:#e6eadd;padding:2rem max(1.6rem,calc((100% - 1100px)/2));font-size:.85rem}@media(max-width:760px){.topbar{align-items:flex-start;flex-direction:column}.hero{padding-top:3rem}.content{display:block;padding-top:2.5rem}.content aside{margin-bottom:2rem}}\n`,
  technique: `:root{--blue:#1673a6;--ink:#354a56;--line:#d9e5eb;--bg:#f6f9fb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,sans-serif}a{color:var(--blue)}a:focus-visible{outline:3px solid #187ba7;outline-offset:4px}.shell{max-width:1160px;margin:auto;background:#fff;min-height:100vh;box-shadow:0 0 2rem #1c506013}.top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.4rem 2rem;border-bottom:1px solid var(--line)}.logo{font-weight:800;text-decoration:none;color:#174c69;letter-spacing:.03em}.mark{font-size:1.5rem;color:var(--blue)}nav{display:flex;flex-wrap:wrap;gap:1.2rem}nav a{text-decoration:none;font-weight:600;font-size:.88rem}nav a[aria-current]{border-bottom:2px solid var(--blue)}.banner{background:linear-gradient(125deg,#125379,#2e8aaa);color:white;padding:4.5rem 2.2rem}.kicker{font-size:.75rem;letter-spacing:.18em;font-weight:700}.banner h1{font-size:clamp(2.4rem,6vw,4rem);line-height:1.12;margin:1rem 0}.banner p{font-size:1.25rem;opacity:.94}.panel{max-width:820px;padding:3rem 2.2rem 6rem}.panel h2{color:#184964}.panel p{font-size:1.12rem}footer{border-top:1px solid var(--line);padding:1.6rem 2.2rem;color:#617680;font-size:.82rem}@media(max-width:750px){.top{align-items:flex-start;flex-direction:column}.banner{padding:3rem 1.4rem}.panel{padding:2rem 1.4rem}}\n`
};

const richCss = `
article{max-width:80ch}article p{margin:0 0 1.2rem;line-height:1.78}article h2,article h3,article h4,article h5{line-height:1.25;margin:2rem 0 .75rem}article ul,article ol{padding-left:1.8rem;margin:0 0 1.3rem}article li{margin:.35rem 0}article blockquote{margin:1rem 0;padding:.7rem 1.2rem;border-left:3px solid currentColor;opacity:.85}article pre{overflow:auto;white-space:pre;font-size:.85rem;padding:1rem;border:1px solid currentColor}article code{font-size:.91em}article figure{margin:2rem 0}article img{display:block;max-width:100%;height:auto;margin:auto}article .table-wrap{overflow-x:auto;margin:1.5rem 0}article table{border-collapse:collapse;min-width:420px;width:100%}article th,article td{border-bottom:1px solid currentColor;padding:.65rem;text-align:left;vertical-align:top}article th{font-weight:700}article hr{border:0;border-top:1px solid currentColor;margin:2rem 0}.lede{font-size:1.12rem;line-height:1.6;opacity:.82}main>article{max-width:80ch}
`;
async function writeAllPages(root, pages, theme = 'bbs') {
  for (const x of pages) await atomicWrite(join(root, 'site', x.slug + '.html'), page(x.slug, x.label, x.body, pages, theme, x.lede ?? ''));
}

// --- Cinq vues statiques du même manifeste (expérience locale, sans JavaScript) -------------------
// Les commandes historiques restent inchangées. Les vues vont dans <projet>/vues/.
// Les fichiers de même nom que des pages générées seront remplacés lors de rebuild ; aucune suppression automatique des orphelins.
const viewCss = {
  perso: `:root{color-scheme:light;--bg:#f0efdf;--fg:#26354a;--link:#1649a4}body{font:17px/1.65 system-ui,sans-serif;max-width:74rem;margin:0 auto;padding:1rem 1.5rem;background:var(--bg);color:var(--fg)}a{color:var(--link);text-decoration:underline}.archive-header,.archive-main,.archive-footer{border:2px solid #9cacb4;background:#fff;padding:1.25rem;margin:1rem 0}.archive-header h1{font-size:2rem}.archive-content{max-width:75ch}`,
  bbs: styles.bbs,
  technique: styles.technique,
  editorial: styles.editorial,
  brut: `:root{color-scheme:light}body{max-width:76ch;margin:auto;padding:1rem;font:1.05rem/1.65 system-ui,sans-serif}a{text-decoration:underline}nav{margin:1rem 0}.archive-content{max-width:72ch}`,
};
const choiceCss = `
*{box-sizing:border-box}body{overflow-wrap:break-word}a:focus-visible,summary:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.archive-header,.archive-main,.archive-footer{max-width:75rem;margin-left:auto;margin-right:auto}
.archive-nav{display:flex;flex-wrap:wrap;gap:.35rem .8rem;padding:.75rem 0;line-height:1.7}
.archive-nav a[aria-current="page"],.archive-theme-picker a[aria-current="page"]{font-weight:bold;text-decoration:underline 2px}
.archive-theme-picker{border:1px solid currentColor;padding:.5rem 1rem;margin:1rem 0;max-width:35rem}
.archive-theme-picker summary{cursor:pointer;font-weight:bold;padding:.35rem}.archive-theme-picker nav{display:flex;flex-wrap:wrap;gap:.45rem .75rem;padding:.65rem 0}
.archive-intro{max-width:70ch}.archive-content{max-width:75ch}.archive-content img{max-width:100%;height:auto}.archive-content figure{overflow-x:auto}
.archive-content pre{white-space:pre;overflow-x:auto}.archive-content .table-wrap{max-width:100%;overflow-x:auto}
.archive-content table{border-collapse:collapse}.archive-content td,.archive-content th{padding:.45rem;border:1px solid currentColor;text-align:left}
.archive-footer{padding:1rem 0;font-size:.8rem}
@media(max-width:600px){body{padding:.8rem!important}.archive-header,.archive-main{padding:.7rem!important}.archive-nav{font-size:.93rem}.archive-theme-picker{max-width:100%}}
@media(prefers-contrast:more){body,.archive-header,.archive-main,.archive-footer{background:Canvas!important;color:CanvasText!important;border-color:CanvasText!important}a{color:LinkText!important;text-decoration:underline!important}}
@media(forced-colors:active){a:focus-visible,summary:focus-visible{outline:3px solid Highlight!important}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{.archive-theme-picker{display:none}body{background:white!important;color:black!important}}
` + richCss;
function viewPage(p, pages, view) {
  const nav = pages.map(q=>`<a href="${esc(q.slug)}.html"${p.slug===q.slug?' aria-current="page"':''}>${esc(q.label)}</a>`).join(' ');
  const choices = VIEWS.map(v=>`<a href="../${v}/${esc(p.slug)}.html"${view===v?' aria-current="page"':''}>${esc(VIEW_LABELS[v])}</a>`).join(' ');
  const intro = p.lede ? `<p class="archive-intro">${esc(p.lede)}</p>` : '';
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.label)} · ${esc(VIEW_LABELS[view])}</title><link rel="stylesheet" href="style.css"></head>\n<body class="archive-page theme-${view}"><header class="archive-header"><p><a href="../index.html">TALC-O-MATIC / Interfaces</a></p><h1>${esc(p.label)}</h1><nav class="archive-nav" aria-label="Rubriques">${nav}</nav><details class="archive-theme-picker"><summary>Interface : ${esc(VIEW_LABELS[view])}</summary><nav aria-label="Changer d'interface">${choices}</nav></details></header><main class="archive-main">${intro}<article class="archive-content">${renderMd(p.body)}</article></main><footer class="archive-footer">TALC-O-MATIC · HTML statique · sans script ni traceur</footer></body></html>\n`;
}
// Fichiers .html/.svg d'une vue qui ne correspondent à aucune rubrique ni à aucune image de site/.
async function orphansIn(dir, root, m) {
  const expected = new Set(m.pages.map(p => p.slug + '.html'));
  for (const f of await readdir(join(root, 'site'))) if (/^[a-z0-9-]+\.svg$/.test(f)) expected.add(f);
  return (await readdir(dir)).filter(n => /^[a-z0-9-]+\.(?:html|svg)$/.test(n) && !expected.has(n));
}

async function buildViews(root, m) {
  const target=join(root, 'vues');
  // Refuser les liens symboliques dans les répertoires visés.
  try {await mkdir(target);} catch(e){if(e.code!=='EEXIST') throw e;await assertRealDir(target);}
  for (const view of VIEWS) {
    const dir=join(target,view);
    try {await mkdir(dir);} catch(e){if(e.code!=='EEXIST') throw e;await assertRealDir(dir);}
    for (const p of m.pages) await assertRegularOrAbsent(join(dir,p.slug+'.html'));
    await assertRegularOrAbsent(join(dir,'style.css'));
    for (const p of m.pages) await atomicWrite(join(dir,p.slug+'.html'),viewPage(p,m.pages,view));
    await atomicWrite(join(dir,'style.css'),viewCss[view]+choiceCss);
    // Images de confiance déjà validées dans site/, copiées sans altérer le moteur classique.
    for(const filename of await readdir(join(root,'site'))) {
      if (!/^[a-z0-9-]+\.svg$/.test(filename)) continue;
      const source=join(root,'site',filename);
      if (!(await assertRegularOrAbsent(source))) throw new UserError('SVG source non ordinaire : '+filename);
      const data=await readFile(source,'utf8');
      if(!svgAllowed(data)) throw new UserError('SVG source non autorisé : '+filename);
      await atomicWrite(join(dir,filename),data);
    }
    // Ne jamais effacer silencieusement un document ajouté dans vues/.
    const orphanNames = await orphansIn(dir, root, m);
    if (orphanNames.length) console.warn(`AVERTISSEMENT : ${view} contient ${orphanNames.length} fichier(s) non référencé(s) : ${orphanNames.join(', ')}. Aucun fichier supprimé.`);
  }
  const entries=VIEWS.map(v=>`<li><a href="${v}/index.html">${esc(VIEW_LABELS[v])}</a></li>`).join('');
  await atomicWrite(join(target,'index.html'),`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choix d'interface</title><style>body{font:1.15rem/1.7 system-ui,sans-serif;max-width:50rem;margin:3rem auto;padding:1rem}a:focus-visible{outline:3px solid}</style><h1>Choisis ton interface</h1><p>Un contenu, cinq présentations, sans JavaScript.</p><nav aria-label="Interfaces"><ul>${entries}</ul></nav></html>\n`);
}
async function views() {
  if (rest.length) throw new UserError('Usage: views <projet>');
  const root=await projectRoot(project),m=await readManifest(root);
  m.multiViews=true;
  // Les vues sont d'abord construites ; en cas d'interruption le prochain `views` ou `rebuild` répare.
  await buildViews(root,m);
  await atomicWrite(join(root,'bbs.json'),manifestText(m));
  console.log(`VUES: ${VIEWS.length} interfaces × ${m.pages.length} pages · ouvrir ${join(root,'vues','index.html')}`);
}

// --- Commandes ----------------------------------------------------------------------------------

async function initProject(name, chosenTheme) {
  if (!safeSlug(name)) throw new UserError('Nom : lettres minuscules, chiffres, tirets ; commencer par une lettre.');
  const theme = chosenTheme;
  if (!validTheme(theme)) throw new UserError('Thème attendu : bbs, editorial ou technique');
  const root = resolve(name);
  const pages = [
    { slug: 'index', label: 'Accueil', body: theme === 'bbs' ? 'Bienvenue sur votre BBS local.' : theme === 'editorial' ? 'Bienvenue dans votre espace éditorial.' : 'Bienvenue dans votre espace de documentation technique.' },
    { slug: 'archives', label: 'Archives', body: 'Index des archives à compléter.' },
    { slug: 'messages', label: 'Messages', body: 'Rubrique des messages à compléter.' },
  ];
  try { await mkdir(root, { recursive: false }); } catch (e) { throw new UserError('Dossier existant ou impossible à créer : ' + e.code); }
  try {
    await mkdir(join(root, 'site'));
    await putNew(join(root, 'site', 'style.css'), styles[theme] + richCss);
    for (const p of pages) await putNew(join(root, 'site', p.slug + '.html'), page(p.slug, p.label, p.body, pages, theme, p.lede ?? ''));
    // Le manifeste est écrit en dernier : sans manifeste, le projet n'est pas considéré comme créé.
    await putNew(join(root, 'bbs.json'), manifestText({ name, kind: 'bbs-static', theme, pages }));
  } catch (e) {
    throw new UserError(`Création interrompue (${e.code || e.message}). Le dossier ${root} est incomplet : supprimez-le à la main avant de recommencer.`);
  }
  console.log('CRÉÉ:', root, '\nPour voir: node ' + JSON.stringify(process.argv[1]) + ' serve ' + name);
}

async function init() {
  if (rest.length > 1) throw new UserError('Usage: init <projet> [bbs|editorial|technique]');
  await initProject(project, rest[0] ?? 'bbs');
}

async function menu() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  const answers = rl[Symbol.asyncIterator]();
  const ask = async prompt => {
    process.stdout.write(prompt);
    const result = await answers.next();
    if (result.done) throw new UserError('Saisie interrompue');
    return result.value.trim();
  };
  try {
    console.log('TALC-O-MATIC — choix du style\n1. BBS rétro (défaut)\n2. Éditorial chaud (inspiration éditoriale)\n3. Minimal technique (inspiration Alpine)');
    const answer = (await ask('Modèle [1/2/3] : ')) || '1';
    const choice = { '1': 'bbs', '2': 'editorial', '3': 'technique' }[answer];
    if (!choice) throw new UserError('Choix invalide');
    const name = await ask('Nom du nouveau projet (a-z, 0-9, tiret) : ');
    await initProject(name, choice);
    console.log('Aperçu : node ' + JSON.stringify(process.argv[1]) + ' serve ' + name);
  } finally { rl.close(); }
}

async function add() {
  const [slug, label, ...content] = rest;
  const body = content.join(' ');
  if (!safeSlug(slug) || !label || !content.length) throw new UserError('Usage: add <projet> <slug> <titre> <texte>');
  if (label.length > MAX_LABEL || body.length > MAX_BODY) throw new UserError(`Titre (max ${MAX_LABEL}) ou texte (max ${MAX_BODY}) trop long`);
  const root = await projectRoot(project);
  const m = await readManifest(root);
  if (m.pages.some(p => p.slug === slug)) throw new UserError('Page déjà présente dans le manifeste');
  const target = join(root, 'site', slug + '.html');
  if (await assertRegularOrAbsent(target)) throw new UserError(`Le fichier site/${slug}.html existe déjà hors manifeste : supprimez-le ou choisissez un autre slug`);
  m.pages.push({ slug, label, body });
  validateManifest(m);
  // Précontrôle de toutes les pages AVANT de valider le manifeste :
  // un lien symbolique préexistant ne doit pas laisser une nouvelle page déclarée.
  for (const p of m.pages) await assertRegularOrAbsent(join(root, 'site', p.slug + '.html'));
  // 1) Le manifeste d'abord, de façon atomique : c'est la source de vérité.
  await atomicWrite(join(root, 'bbs.json'), manifestText(m));
  // 2) Puis les pages. En cas d'interruption ici, `rebuild` les régénère depuis le manifeste.
  try { await writeAllPages(root, m.pages, themeOf(m)); } catch (e) {
    throw new UserError(`Manifeste à jour mais pages incomplètes (${e.code || e.message}). Lancez : node scripts/bbs.mjs rebuild ${project}`);
  }
  if (m.multiViews) await buildViews(root,m);
  console.log('PAGE AJOUTÉE:', slug);
}

async function rebuild() {
  const root = await projectRoot(project);
  const m = await readManifest(root);
  await writeAllPages(root, m.pages, themeOf(m));
  await atomicWrite(join(root, 'site', 'style.css'), styles[themeOf(m)] + richCss);
  if(m.multiViews) await buildViews(root,m);
  console.log(`RÉGÉNÉRÉ: ${m.pages.length} pages depuis bbs.json`);
}

async function theme() {
  const [choice, ...extra] = rest;
  if (!validTheme(choice) || extra.length) throw new UserError('Usage: theme <projet> <bbs|editorial|technique>');
  const root = await projectRoot(project);
  const m = await readManifest(root);
  for (const p of m.pages) await assertRegularOrAbsent(join(root, 'site', p.slug + '.html'));
  await assertRegularOrAbsent(join(root, 'site', 'style.css'));
  m.theme = choice;
  // Le manifeste est la source de vérité ; rebuild répare une interruption.
  await atomicWrite(join(root, 'bbs.json'), manifestText(m));
  await writeAllPages(root, m.pages, choice);
  await atomicWrite(join(root, 'site', 'style.css'), styles[choice] + richCss);
  if(m.multiViews) await buildViews(root,m);
  console.log('THÈME:', choice, '·', m.pages.length, 'pages régénérées');
}

// Règle unique pour tout SVG (check, copie vers les vues, contrôle des vues) — validation des ressources locales.
// En-tête toléré avant <svg> : déclaration XML, DOCTYPE public SVG 1.1 exact (Graphviz), commentaires.
const SVG_HEAD = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE\s+svg\s+PUBLIC\s+"-\/\/W3C\/\/DTD SVG 1\.1\/\/EN"\s+"http:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd"\s*>\s*)?(?:<!--(?:(?!-->)[\s\S])*-->\s*)*<svg\b/;
function svgAllowed(svg) { return SVG_HEAD.test(svg) && !unsafeSvg(svg); }

function unsafeSvg(svg) {
  // Namespace declarations are standard metadata, not outbound fetches.
  // Seul le DOCTYPE public SVG 1.1 exact (celui de Graphviz), sans sous-ensemble interne, est toléré.
  // Tout autre DOCTYPE, ou une déclaration d'entité, reste refusé plus bas.
  svg = svg.replace(/<!DOCTYPE\s+svg\s+PUBLIC\s+"-\/\/W3C\/\/DTD SVG 1\.1\/\/EN"\s+"http:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd"\s*>/, '');
  const withoutNamespaces = svg.replace(/\sxmlns(?::[A-Za-z][\w.-]*)?=(["'])https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)\1/g, '');
  return /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<animate\b|<set\b|<animateMotion\b|<animateTransform\b|\son[a-z]+\s*=|(?:href|src)\s*=|url\s*\(|javascript\s*:|data\s*:|https?:\/\/|<\?xml-stylesheet|<style\b|<image\b/i.test(withoutNamespaces);
}

async function check() {
  const root = await projectRoot(project);
  const m = await readManifest(root);
  const problems = [];
  for (const p of m.pages) {
    const f = join(root, 'site', p.slug + '.html');
    try {
      if (!(await assertRegularOrAbsent(f))) { problems.push('page absente ' + p.slug); continue; }
      const html = await readFile(f, 'utf8');
      if (!html.includes('href="style.css"')) problems.push('CSS absent ' + p.slug);
      for (const q of m.pages) if (!html.includes('href="' + q.slug + '.html"')) problems.push('navigation manquante ' + p.slug + ' → ' + q.slug);
      if (/<script\b/i.test(html)) problems.push('JavaScript présent (non généré par l\'atelier) ' + p.slug);
    } catch (e) { problems.push(e instanceof UserError ? e.message : 'page illisible ' + p.slug); }
  }
  try { if (!(await assertRegularOrAbsent(join(root, 'site', 'style.css')))) problems.push('CSS absent'); } catch (e) { problems.push(e.message); }

  // SVG are validated even if not linked from a page.
  const { readdir } = await import('node:fs/promises');
  for (const name of await readdir(join(root, 'site'))) {
    if (!name.endsWith('.svg')) continue;
    if (!/^[a-z0-9-]+\.svg$/.test(name)) { problems.push('nom SVG invalide ' + name); continue; }
    try {
      const file = join(root, 'site', name);
      if (!(await assertRegularOrAbsent(file))) { problems.push('SVG absent ' + name); continue; }
      const svg = await readFile(file, 'utf8');
      if (!svgAllowed(svg)) problems.push('SVG non autorisé ' + name);
    } catch(e) { problems.push(e instanceof UserError ? e.message : 'SVG illisible ' + name); }
  }

  if (m.multiViews) {
    try {
      await assertRealDir(join(root,'vues'));
      if (!(await assertRegularOrAbsent(join(root,'vues','index.html')))) problems.push('index des vues absent');
      for (const view of VIEWS) {
       try {
        const dir=join(root,'vues',view);await assertRealDir(dir);
        for (const o of await orphansIn(dir, root, m)) problems.push('fichier orphelin '+view+'/'+o+' (aucune suppression automatique ; déplacer ou supprimer manuellement après vérification)');
        if (!(await assertRegularOrAbsent(join(dir,'style.css')))) problems.push('CSS de vue absent '+view);
        for(const p of m.pages) {
          const fp=join(dir,p.slug+'.html');
          if (!(await assertRegularOrAbsent(fp))) {problems.push('page de vue absente '+view+'/'+p.slug);continue;}
          const html=await readFile(fp,'utf8');
          for(const image of html.matchAll(/<img\s+[^>]*src="([a-z0-9-]+\.svg)"/gi)) {
            const imgFile=join(dir,image[1]);
            if(!(await assertRegularOrAbsent(imgFile))) problems.push('image manquante '+view+'/'+p.slug+' → '+image[1]);
            else if(!svgAllowed(await readFile(imgFile,'utf8'))) problems.push('SVG de vue non autorisé '+view+'/'+image[1]);
          }
          if ((html.match(/<!doctype/gi)||[]).length!==1) problems.push('DOCTYPE incohérent '+view+'/'+p.slug);
          if (/<script\b/i.test(html)) problems.push('script '+view+'/'+p.slug);
          for(const q of m.pages) if(!html.includes('href="'+q.slug+'.html"')) problems.push('navigation manquante '+view+'/'+p.slug+' → '+q.slug);
          for(const other of VIEWS) if(!html.includes('href="../'+other+'/'+p.slug+'.html"')) problems.push('interface absente '+view+'/'+p.slug+' → '+other);
        }
       } catch(e) {problems.push('vue '+view+' illisible : '+e.message);}
      }
    } catch(e) {problems.push('vues illisibles '+e.message);}
  }
  if (problems.length) { for (const p of problems) console.error(p); process.exitCode = 1; }
  else console.log(`OK ${m.pages.length} pages · vérification basique HTML/CSS`);
}

async function serve() {
  const root = await projectRoot(project);
  const site = join(root, 'site');
  const allowedHosts = new Set([`${BIND}:${PORT}`, `localhost:${PORT}`]);
  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };
  const deny = (res, code, text) => { res.writeHead(code, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); };
  const server = createServer(async (req, res) => {
    try {
      // Contre le DNS rebinding : seules les adresses locales attendues sont servies.
      if (!allowedHosts.has(req.headers.host)) return deny(res, 421, 'Hôte refusé');
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return deny(res, 405, 'Méthode refusée'); }
      // Contrôle du chemin BRUT avant toute normalisation d'URL : URL() transforme
      // notamment /%2e%2e/ en /, ce qui masquerait une traversée encodée.
      const rawPath = req.url.split('?')[0];
      if (!/^\/(?:[a-z0-9-]+\.(?:html|css|svg))?$/.test(rawPath)) return deny(res, 400, 'Chemin invalide');
      const name = rawPath === '/' ? 'index.html' : rawPath.slice(1);
      const file = join(site, name);
      const stat = await lstat(file);
      if (!stat.isFile()) return deny(res, 404, 'Not found');
      const contents = await readFile(file);
      res.writeHead(200, { ...baseHeaders, 'Content-Type': name.endsWith('.css') ? 'text/css; charset=utf-8' : name.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch { deny(res, 404, 'Not found'); }
  });
  server.on('error', e => fail(e.code === 'EADDRINUSE' ? `Port ${PORT} déjà utilisé : arrêtez l'autre aperçu (aucun autre port n'est essayé).` : e.message));
  server.listen(PORT, BIND, () => console.log(`Aperçu local http://${BIND}:${PORT}/  (Ctrl+C pour arrêter)`));
}

const commands = { init, menu, add, rebuild, theme, check, serve, views };
const usage = `${title}
node scripts/bbs.mjs menu
node scripts/bbs.mjs init <projet> [bbs|editorial|technique]
node scripts/bbs.mjs add <projet> <slug> <titre> <texte>
node scripts/bbs.mjs rebuild <projet>
node scripts/bbs.mjs views <projet>  # produit 5 vues statiques
node scripts/bbs.mjs theme <projet> <bbs|editorial|technique>
node scripts/bbs.mjs check <projet>
node scripts/bbs.mjs serve <projet>`;

if (!cmd) console.log(usage);
else if (!Object.hasOwn(commands, cmd) || (!project && cmd !== 'menu')) { console.error(usage); process.exitCode = 1; }
else {
  try { await commands[cmd](); }
  catch (e) { fail(e instanceof UserError ? e.message : `${e.code || ''} ${e.message}`.trim()); }
}
