#!/usr/bin/env node
// TALC-O-MATIC BBS : générateur statique local.
// Fichier nouveau, non issu du code d'Hypervibe 3.4.17 (voir MODIFICATIONS.md).
// Version 0.1 écrite par Aël. Modifié par Silex le 2026-11-09 (contre-audit, v0.1.1) :
// les liens symboliques sont refusés et les écritures sont atomiques, le manifeste est validé
// et écrit en premier, une commande `rebuild` répare un état partiel, et le serveur est durci
// (contrôle de l'en-tête Host, port occupé signalé). Détail dans MODIFICATIONS.md.
import { mkdir, writeFile, readFile, lstat, rename, rm, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const title = 'TALC-O-MATIC 0.2.1';
const THEMES = ['bbs', 'editorial', 'technique'];
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
  const seen = new Set();
  for (const p of m.pages) {
    if (!p || typeof p !== 'object') throw new UserError('Manifeste invalide : entrée de page incorrecte');
    if (!safeSlug(p.slug)) throw new UserError(`Manifeste invalide : slug non conforme (${String(p.slug).slice(0, 60)})`);
    if (seen.has(p.slug)) throw new UserError(`Manifeste invalide : slug en double (${p.slug})`);
    seen.add(p.slug);
    if (typeof p.label !== 'string' || !p.label || p.label.length > MAX_LABEL) throw new UserError(`Manifeste invalide : titre incorrect (${p.slug})`);
    if (typeof p.body !== 'string' || p.body.length > MAX_BODY) throw new UserError(`Manifeste invalide : texte incorrect (${p.slug})`);
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

function page(slug, label, body, pages, theme = 'bbs') {
  const nav = pages.map(p => `<a href="${esc(p.slug)}.html"${p.slug === slug ? ' aria-current="page"' : ''}>${theme === 'bbs' ? '[' : ''}${esc(p.label)}${theme === 'bbs' ? ']' : ''}</a>`).join(' ');
  const text = esc(body).replace(/\r?\n/g, '<br>');
  if (theme === 'bbs') return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · BBS</title><link rel="stylesheet" href="style.css"></head>\n<body><header><pre aria-hidden="true">+----------------------------------------+\n|     TALC-O-MATIC : BULLETIN BOARD      |\n+----------------------------------------+</pre><h1>${esc(label)}</h1><nav aria-label="Rubriques">${nav}</nav></header>\n<main><p>${text}</p></main><footer>LOCAL BBS · HTML + CSS · NO TRACKERS</footer></body></html>\n`;
  if (theme === 'editorial') return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · TALC-O-MATIC</title><link rel="stylesheet" href="style.css"></head>\n<body><header class="topbar"><a class="brand" href="index.html">TALC—O—MATIC</a><nav aria-label="Rubriques">${nav}</nav></header><main><section class="hero"><span class="eyebrow">LES CAHIERS DE L’ARCHE · ÉDITORIAL</span><h1>${esc(label)}</h1><p class="lede">Un espace calme pour les idées et les expériences.</p></section><div class="content"><aside><span class="eyebrow">PROTOTYPE LOCAL</span><p>HTML et CSS indépendants</p></aside><article><h2>${esc(label)}</h2><p>${text}</p><div class="rule"></div><small>TALC-O-MATIC · Aucun script · Aucune ressource externe</small></article></div></main><footer>Des outils simples, pour ceux qui les utilisent.</footer></body></html>\n`;
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} · TALC-O-MATIC</title><link rel="stylesheet" href="style.css"></head>\n<body><div class="shell"><header class="top"><a href="index.html" class="logo"><span class="mark">◆</span> TALC-O-MATIC</a><nav aria-label="Rubriques">${nav}</nav></header><section class="banner"><span class="kicker">LIGHTWEIGHT · LOCAL · OPEN</span><h1>${esc(label)}</h1><p>Simple. Lisible. Reproductible.</p></section><main class="panel"><h2>${esc(label)}</h2><p>${text}</p></main><footer>Prototype technique · HTML + CSS · sans dépendance externe</footer></div></body></html>\n`;
}

const styles = {
  bbs: `:root{color-scheme:dark;--fg:#b7ffab;--bg:#07140d;--border:#3d995e}*{box-sizing:border-box}body{margin:0 auto;max-width:68rem;padding:1.5rem;background:var(--bg);color:var(--fg);font:1.08rem/1.7 ui-monospace,Consolas,monospace}header,main,footer{margin:1.3rem 0;border:1px solid var(--border);padding:1.2rem}pre{overflow:auto;line-height:1.2}h1{font-size:1.5rem}a{color:#f8d782;display:inline-block;margin:.3rem}a:focus-visible{outline:3px solid #fff}nav{border-top:1px dashed var(--border);padding-top:1rem}footer{font-size:.75rem}::selection{background:#356a4a;color:white}\n`,
  editorial: `:root{--paper:#f5f1e8;--ink:#242b28;--muted:#647168;--line:#d8d5cb;--accent:#416854}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.7 system-ui,sans-serif}a{color:inherit;text-underline-offset:4px}a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.topbar{max-width:1150px;margin:auto;padding:1.4rem 1.6rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--line)}.brand{font-weight:800;letter-spacing:.11em;text-decoration:none;font-size:.85rem}nav{display:flex;flex-wrap:wrap;gap:1rem}nav a{font-size:.85rem;text-decoration:none}nav a[aria-current]{text-decoration:underline}.hero{max-width:1150px;margin:auto;padding:5rem 1.6rem 4rem;border-bottom:1px solid var(--line)}.eyebrow{font:.72rem/1.5 system-ui,sans-serif;letter-spacing:.16em;color:var(--accent);font-weight:750}.hero h1{font:normal clamp(3rem,7vw,6rem)/1.07 Georgia,serif;letter-spacing:-.05em;margin:1.2rem 0}.lede{color:var(--muted);font-size:1.25rem}.content{max-width:1150px;margin:auto;padding:4rem 1.6rem 6rem;display:grid;grid-template-columns:180px minmax(0,740px);gap:4rem}.content aside{font-size:.85rem;color:var(--muted)}article h2{font:normal 2.4rem/1.2 Georgia,serif;margin:0 0 1.8rem}article p{white-space:normal;font-size:1.15rem}article .rule{border-top:1px solid var(--line);margin:3rem 0 1rem}article small{color:var(--muted)}footer{background:#26332d;color:#e6eadd;padding:2rem max(1.6rem,calc((100% - 1100px)/2));font-size:.85rem}@media(max-width:760px){.topbar{align-items:flex-start;flex-direction:column}.hero{padding-top:3rem}.content{display:block;padding-top:2.5rem}.content aside{margin-bottom:2rem}}\n`,
  technique: `:root{--blue:#1673a6;--ink:#354a56;--line:#d9e5eb;--bg:#f6f9fb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,sans-serif}a{color:var(--blue)}a:focus-visible{outline:3px solid #187ba7;outline-offset:4px}.shell{max-width:1160px;margin:auto;background:#fff;min-height:100vh;box-shadow:0 0 2rem #1c506013}.top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.4rem 2rem;border-bottom:1px solid var(--line)}.logo{font-weight:800;text-decoration:none;color:#174c69;letter-spacing:.03em}.mark{font-size:1.5rem;color:var(--blue)}nav{display:flex;flex-wrap:wrap;gap:1.2rem}nav a{text-decoration:none;font-weight:600;font-size:.88rem}nav a[aria-current]{border-bottom:2px solid var(--blue)}.banner{background:linear-gradient(125deg,#125379,#2e8aaa);color:white;padding:4.5rem 2.2rem}.kicker{font-size:.75rem;letter-spacing:.18em;font-weight:700}.banner h1{font-size:clamp(2.4rem,6vw,4rem);line-height:1.12;margin:1rem 0}.banner p{font-size:1.25rem;opacity:.94}.panel{max-width:820px;padding:3rem 2.2rem 6rem}.panel h2{color:#184964}.panel p{font-size:1.12rem}footer{border-top:1px solid var(--line);padding:1.6rem 2.2rem;color:#617680;font-size:.82rem}@media(max-width:750px){.top{align-items:flex-start;flex-direction:column}.banner{padding:3rem 1.4rem}.panel{padding:2rem 1.4rem}}\n`
};

async function writeAllPages(root, pages, theme = 'bbs') {
  for (const x of pages) await atomicWrite(join(root, 'site', x.slug + '.html'), page(x.slug, x.label, x.body, pages, theme));
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
    await putNew(join(root, 'site', 'style.css'), styles[theme]);
    for (const p of pages) await putNew(join(root, 'site', p.slug + '.html'), page(p.slug, p.label, p.body, pages, theme));
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
  console.log('PAGE AJOUTÉE:', slug);
}

async function rebuild() {
  const root = await projectRoot(project);
  const m = await readManifest(root);
  await writeAllPages(root, m.pages, themeOf(m));
  await atomicWrite(join(root, 'site', 'style.css'), styles[themeOf(m)]);
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
  await atomicWrite(join(root, 'site', 'style.css'), styles[choice]);
  console.log('THÈME:', choice, '·', m.pages.length, 'pages régénérées');
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
  if (problems.length) { for (const p of problems) console.error(p); process.exitCode = 1; }
  else console.log(`OK ${m.pages.length} pages · vérification basique HTML/CSS`);
}

async function serve() {
  const root = await projectRoot(project);
  const site = join(root, 'site');
  const allowedHosts = new Set([`${BIND}:${PORT}`, `localhost:${PORT}`]);
  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
      if (!/^\/(?:[a-z0-9-]+\.(?:html|css))?$/.test(rawPath)) return deny(res, 400, 'Chemin invalide');
      const name = rawPath === '/' ? 'index.html' : rawPath.slice(1);
      const file = join(site, name);
      const stat = await lstat(file);
      if (!stat.isFile()) return deny(res, 404, 'Not found');
      const contents = await readFile(file);
      res.writeHead(200, { ...baseHeaders, 'Content-Type': name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch { deny(res, 404, 'Not found'); }
  });
  server.on('error', e => fail(e.code === 'EADDRINUSE' ? `Port ${PORT} déjà utilisé : arrêtez l'autre aperçu (aucun autre port n'est essayé).` : e.message));
  server.listen(PORT, BIND, () => console.log(`Aperçu local http://${BIND}:${PORT}/  (Ctrl+C pour arrêter)`));
}

const commands = { init, menu, add, rebuild, theme, check, serve };
const usage = `${title}
node scripts/bbs.mjs menu
node scripts/bbs.mjs init <projet> [bbs|editorial|technique]
node scripts/bbs.mjs add <projet> <slug> <titre> <texte>
node scripts/bbs.mjs rebuild <projet>
node scripts/bbs.mjs theme <projet> <bbs|editorial|technique>
node scripts/bbs.mjs check <projet>
node scripts/bbs.mjs serve <projet>`;

if (!cmd) console.log(usage);
else if (!Object.hasOwn(commands, cmd) || (!project && cmd !== 'menu')) { console.error(usage); process.exitCode = 1; }
else {
  try { await commands[cmd](); }
  catch (e) { fail(e instanceof UserError ? e.message : `${e.code || ''} ${e.message}`.trim()); }
}
