#!/usr/bin/env python3
"""Portable, offline smoke/regression suite. Standard library only."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess, json, re, hashlib
ENGINE=Path(__file__).resolve().parents[1] / 'scripts' / 'bbs.mjs'

def run(where,*args,success=True):
    p=subprocess.run(['node',str(ENGINE),*args],cwd=where,text=True,capture_output=True)
    if success and p.returncode!=0:raise AssertionError(f'{args}: {p.stdout}\n{p.stderr}')
    if not success and p.returncode==0:raise AssertionError(f'Expected rejection: {args}')
    return p

with TemporaryDirectory(prefix='talc-standalone-') as tmp:
    w=Path(tmp)
    for theme in ('bbs','editorial','technique'):
        name='demo-'+theme
        run(w,'init',name,theme)
        run(w,'check',name)
        run(w,'views',name)
        run(w,'check',name)
        p=w/name
        manifest=json.loads((p/'bbs.json').read_text())
        assert manifest['multiViews'] is True
        views=('perso','bbs','technique','editorial','brut')
        for view in views:
            html=(p/'vues'/view/'index.html').read_text()
            assert 'archive-theme-picker' in html and '<details ' in html
            assert len(re.findall(r'<!doctype',html,re.I))==1
            assert not re.search(r'<script\b',html,re.I)
            for other in views:assert f'../{other}/index.html' in html
        pages=list((p/'vues').glob('*/*.html'))
        before={str(x.relative_to(p)):hashlib.sha256(x.read_bytes()).hexdigest() for x in pages}
        run(w,'rebuild',name)
        after={str(x.relative_to(p)):hashlib.sha256(x.read_bytes()).hexdigest() for x in pages}
        assert before==after, 'rebuild must be deterministic'
        run(w,'add',name,'research','Research','**bold *and* italic**\n\n2026. A year')
        run(w,'check',name)
        assert '<strong>' in (p/'site'/'research.html').read_text()
        run(w,'theme',name,'technique')
        run(w,'check',name)
        # Unknown files must never be deleted automatically
        manual=p/'vues'/'bbs'/'my-notes.html'
        manual.write_text('private manual file')
        r=run(w,'rebuild',name)
        assert manual.read_text()=='private manual file'
        assert 'my-notes.html' in (r.stdout+r.stderr)
        r=run(w,'check',name,success=False)
        assert 'my-notes.html' in (r.stdout+r.stderr)
        manual.unlink()
        run(w,'check',name)
        # Refuse executable SVG in source
        malicious=p/'site'/'evil.svg'
        malicious.write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
        run(w,'check',name,success=False)
        run(w,'rebuild',name,success=False)
        malicious.unlink()
        run(w,'check',name)
    run(w,'init','bad-alpine','alpine',success=False)
print('PASS: 3 legacy themes; 5 interfaces; rebuild stable; navigation; no JS; orphan protected; untrusted SVG rejected; CLI backwards-compatible')
