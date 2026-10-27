"""Stamp assets and fingerprint the runtime files before committing a release."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def prepare(version):
    if not re.fullmatch(r'[\w.-]{1,64}', version):
        raise ValueError('Invalid version')
    for page in ROOT.glob('*.html'):
        source = page.read_text(encoding='utf-8')
        source = re.sub(r'((?:src|href)="[^"?:]+\.(?:js|css|ico|png))(?:\?v=[^"\s]+)?"', lambda m: m[1] + '?v=' + version + '"', source)
        with page.open('w', encoding='utf-8', newline='\n') as output:
            output.write(source)
    paths = {ROOT / 'server.py'}
    paths.update(ROOT / name for name in ('favicon.ico', 'favicon.png'))
    for suffix in ('*.html', '*.css', '*.js'):
        paths.update(ROOT.glob(suffix))
    paths.discard(ROOT / 'app.js')  # Retired editor, not loaded by any page.
    for directory in ('data', 'fonts', 'vendor'):
        paths.update(path for path in (ROOT / directory).rglob('*') if path.is_file())
    files = {}
    for path in sorted(paths):
        content = path.read_bytes()
        if path.suffix in ('.html', '.css', '.js', '.py', '.csv'):
            content = content.replace(b'\r\n', b'\n')
        files[path.relative_to(ROOT).as_posix()] = hashlib.sha256(content).hexdigest()
    (ROOT / 'release.json').write_text(json.dumps({'version': version, 'files': files}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Release {version}: {len(files)} runtime files fingerprinted')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('version')
    prepare(parser.parse_args().version)
