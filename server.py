"""Paper reading notes: same-origin static app, authentication and SQLite storage.

Run: python server.py --host 127.0.0.1 --port 4173
Deploy behind an HTTPS reverse proxy; keep NOTES_DATA_DIR on persistent storage.
"""
import argparse
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import threading
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('NOTES_DATA_DIR', ROOT / 'storage')).resolve()
SESSION_SECONDS = 30 * 86400
MAX_BODY = 16 * 1024 * 1024
ITERATIONS = 600000
RATE_LOCK = threading.Lock()
ATTEMPTS = {}


@contextmanager
def database():
    conn = sqlite3.connect(DATA_DIR / 'notes.sqlite3', timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def initialize():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with database() as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE NOT NULL,
          display_name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS libraries (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        db.execute("INSERT OR IGNORE INTO settings (key,value) VALUES ('registration_code',?)", ('108084',))
        columns = {r['name'] for r in db.execute('PRAGMA table_info(users)')}
        if 'role' not in columns:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        if 'disabled' not in columns:
            db.execute('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), ITERATIONS).hex()


def public_user(row):
    return {'id': row['id'], 'username': row['username'], 'displayName': row['display_name'], 'role': row['role']}


def validate_library(lib):
    if not isinstance(lib, dict) or not isinstance(lib.get('folders'), list) or not isinstance(lib.get('documents'), list):
        raise ValueError('文档库格式不正确。')
    folders, docs = lib['folders'], lib['documents']
    if len(folders) > 5000 or not 1 <= len(docs) <= 10000:
        raise ValueError('文档库数量超出限制。')
    def valid_id(value):
        return isinstance(value, str) and 0 < len(value) <= 100
    if any(not isinstance(f, dict) or not valid_id(f.get('id')) or not isinstance(f.get('name'), str) or len(f['name']) > 160 for f in folders):
        raise ValueError('文件夹格式不正确。')
    parents = {f['id']: f.get('parentId', '') for f in folders}
    if len(parents) != len(folders):
        raise ValueError('文件夹编号重复。')
    for fid in parents:
        seen = set()
        cursor = fid
        while cursor:
            if cursor in seen or cursor not in parents:
                raise ValueError('文件夹层级不正确。')
            seen.add(cursor)
            cursor = parents[cursor]
    ids = set()
    for doc in docs:
        if not isinstance(doc, dict) or not valid_id(doc.get('id')) or doc['id'] in ids or not isinstance(doc.get('data'), dict):
            raise ValueError('文档格式不正确。')
        ids.add(doc['id'])
        if doc.get('folderId', '') and doc['folderId'] not in parents:
            raise ValueError('文档所在文件夹不存在。')
        if not isinstance(doc.get('title'), str) or len(doc['title']) > 1000:
            raise ValueError('文档名称格式不正确。')
    if lib.get('activeId') not in ids:
        raise ValueError('当前文档不存在。')


class Handler(SimpleHTTPRequestHandler):
    server_version = 'PaperNotes'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def reply(self, status, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        if not self.headers.get('Content-Type', '').startswith('application/json'):
            raise ValueError('请求需要使用 JSON。')
        size = int(self.headers.get('Content-Length', '0'))
        if size <= 0 or size > MAX_BODY:
            raise ValueError('请求过大或内容为空。')
        value = json.loads(self.rfile.read(size))
        if not isinstance(value, dict):
            raise ValueError('请求格式不正确。')
        return value

    def same_origin(self):
        origin = self.headers.get('Origin')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return False
        return not origin or urlsplit(origin).netloc.lower() == self.headers.get('Host', '').lower()

    def token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            return cookie['paper_session'].value if 'paper_session' in cookie else ''
        except Exception:
            return ''

    def token_hash(self):
        return hashlib.sha256(self.token().encode()).hexdigest()

    def current_user(self, db):
        return db.execute('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>? AND users.disabled=0', (self.token_hash(), int(time.time()))).fetchone()

    def session_cookie(self, token='', max_age=SESSION_SECONDS):
        secure = '; Secure' if os.environ.get('NOTES_SECURE_COOKIES') == '1' else ''
        return f'paper_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}{secure}'

    def rate_allowed(self, name):
        # Count all attempts, including nonexistent usernames, without retaining passwords.
        now = time.time()
        ip = self.client_address[0]
        with RATE_LOCK:
            for key in list(ATTEMPTS):
                if now - ATTEMPTS[key][0] > 600:
                    del ATTEMPTS[key]
            keys = [('ip', ip), ('name', name.lower())]
            if any(ATTEMPTS.get(k, (now, 0))[1] >= (60 if k[0] == 'ip' else 20) for k in keys):
                return False
            for key in keys:
                start, count = ATTEMPTS.get(key, (now, 0))
                ATTEMPTS[key] = (start, count + 1)
            return True

    def api(self):
        path = urlsplit(self.path).path
        if self.command != 'GET' and not self.same_origin():
            return self.reply(403, {'error': '请求来源不正确。'})
        try:
            with database() as db:
                user = self.current_user(db)
                setup_required = not db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone()
                if path == '/api/setup' and self.command == 'GET':
                    return self.reply(200, {'required': setup_required})
                if path == '/api/session' and self.command == 'GET':
                    return self.reply(200, {'user': public_user(user) if user else None, 'setupRequired': setup_required})
                if path in ('/api/setup', '/api/register', '/api/login') and self.command == 'POST':
                    data = self.body()
                    name, password = data.get('username', ''), data.get('password', '')
                    if not isinstance(name, str) or not isinstance(password, str):
                        raise ValueError('请填写用户名和密码。')
                    name = name.strip()
                    if not 2 <= len(name) <= 32 or not 8 <= len(password) <= 256:
                        raise ValueError('用户名为 2–32 个字符，密码为 8–256 个字符。')
                    if not self.rate_allowed(name):
                        return self.reply(429, {'error': '尝试次数较多，请 10 分钟后重试。'})
                    found = db.execute('SELECT * FROM users WHERE username=? COLLATE NOCASE', (name,)).fetchone()
                    if path in ('/api/setup', '/api/register'):
                        db.execute('BEGIN IMMEDIATE')
                        setup_required = not db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone()
                        if path == '/api/setup' and not setup_required:
                            return self.reply(409, {'error': '管理员账号已设置，请直接登录。'})
                        if path == '/api/register' and setup_required:
                            return self.reply(428, {'error': '请先设置管理员账号。'})
                        if path == '/api/register':
                            code = data.get('registrationCode', '')
                            expected = db.execute("SELECT value FROM settings WHERE key='registration_code'").fetchone()['value']
                            if not isinstance(code, str) or len(code) > 64 or not hmac.compare_digest(code.strip().encode('utf-8'), expected.encode('utf-8')):
                                return self.reply(403, {'error': '注册码不正确，请向管理员获取有效注册码。', 'field': 'registrationCode'})
                        if found:
                            return self.reply(409, {'error': '这个用户名已存在。'})
                        uid, salt = secrets.token_hex(16), secrets.token_hex(24)
                        db.execute('INSERT INTO users (id,username,display_name,salt,password_hash,created_at,role) VALUES (?,?,?,?,?,?,?)', (uid, name, name, salt, password_hash(password, salt), int(time.time()), 'admin' if path == '/api/setup' else 'user'))
                        found = db.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
                    else:
                        computed = password_hash(password, found['salt'] if found else '00' * 24)
                        if not found or found['disabled'] or not hmac.compare_digest(computed, found['password_hash']):
                            return self.reply(401, {'error': '用户名或密码不正确。'})
                    db.execute('DELETE FROM sessions WHERE expires_at<? OR token_hash=?', (int(time.time()), self.token_hash()))
                    token = secrets.token_urlsafe(40)
                    db.execute('INSERT INTO sessions VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), found['id'], int(time.time()) + SESSION_SECONDS))
                    db.commit()
                    return self.reply(200, {'user': public_user(found)}, self.session_cookie(token))
                if path == '/api/logout' and self.command == 'POST':
                    db.execute('DELETE FROM sessions WHERE token_hash=?', (self.token_hash(),))
                    db.commit()
                    return self.reply(200, {'ok': True}, self.session_cookie(max_age=0))
                if not user:
                    return self.reply(401, {'error': '请先登录。'})
                if path.startswith('/api/admin/'):
                    if user['role'] != 'admin':
                        return self.reply(403, {'error': '需要管理员权限。'})
                    if path == '/api/admin/settings':
                        if self.command == 'GET':
                            code = db.execute("SELECT value FROM settings WHERE key='registration_code'").fetchone()['value']
                            return self.reply(200, {'registrationCode': code})
                        if self.command == 'PATCH':
                            code = self.body().get('registrationCode', '')
                            if not isinstance(code, str) or not 4 <= len(code.strip()) <= 64:
                                return self.reply(400, {'error': '注册码需为 4–64 个字符。'})
                            db.execute("UPDATE settings SET value=? WHERE key='registration_code'", (code.strip(),))
                            db.commit()
                            return self.reply(200, {'registrationCode': code.strip()})
                    if path == '/api/admin/users' and self.command == 'GET':
                        users = []
                        for row in db.execute('SELECT users.*,libraries.content,libraries.updated_at FROM users LEFT JOIN libraries ON libraries.user_id=users.id ORDER BY users.created_at,users.id'):
                            library = json.loads(row['content']) if row['content'] else {}
                            users.append({**public_user(row), 'disabled': bool(row['disabled']), 'createdAt': row['created_at'], 'updatedAt': row['updated_at'], 'documentCount': len(library.get('documents', [])), 'folderCount': len(library.get('folders', []))})
                        return self.reply(200, {'users': users})
                    if path == '/api/admin/users' and self.command == 'POST':
                        data = self.body()
                        name, password = data.get('username', ''), data.get('password', '')
                        if not isinstance(name, str) or not isinstance(password, str) or not 2 <= len(name.strip()) <= 32 or not 8 <= len(password) <= 256:
                            raise ValueError('账号格式不正确。')
                        uid, salt = secrets.token_hex(16), secrets.token_hex(24)
                        db.execute('INSERT INTO users (id,username,display_name,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)', (uid, name.strip(), name.strip(), salt, password_hash(password, salt), int(time.time())))
                        db.commit()
                        return self.reply(201, {'user': public_user(db.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone())})
                    if path.startswith('/api/admin/users/') and self.command in ('PATCH', 'DELETE'):
                        target_id = path.rsplit('/', 1)[1]
                        target = db.execute('SELECT * FROM users WHERE id=?', (target_id,)).fetchone()
                        if not target:
                            return self.reply(404, {'error': '账号不存在。'})
                        if target['role'] == 'admin':
                            return self.reply(403, {'error': '管理员账号请在自己的账号设置中修改；不能停用或删除管理员。'})
                        if self.command == 'DELETE':
                            db.execute('DELETE FROM users WHERE id=?', (target_id,))
                            db.commit()
                            return self.reply(200, {'ok': True})
                        data = self.body()
                        name = data.get('displayName', target['display_name'])
                        password = data.get('password', '')
                        disabled = data.get('disabled', bool(target['disabled']))
                        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 32 or not isinstance(password, str) or (password and not 8 <= len(password) <= 256) or not isinstance(disabled, bool):
                            raise ValueError('账号设置格式不正确。')
                        salt = secrets.token_hex(24) if password else target['salt']
                        hashed = password_hash(password, salt) if password else target['password_hash']
                        db.execute('UPDATE users SET display_name=?,disabled=?,salt=?,password_hash=? WHERE id=?', (name.strip(), int(disabled), salt, hashed, target_id))
                        if disabled or password:
                            db.execute('DELETE FROM sessions WHERE user_id=?', (target_id,))
                        db.commit()
                        return self.reply(200, {'ok': True})
                    return self.reply(404, {'error': '管理接口不存在。'})
                if path == '/api/library':
                    if self.command == 'GET':
                        row = db.execute('SELECT * FROM libraries WHERE user_id=?', (user['id'],)).fetchone()
                        return self.reply(200, {'library': json.loads(row['content']) if row else None, 'revision': row['revision'] if row else 0, 'updatedAt': row['updated_at'] if row else None})
                    if self.command == 'PUT':
                        data = self.body()
                        validate_library(data.get('library'))
                        if type(data.get('revision')) is not int:
                            raise ValueError('同步版本不正确。')
                        content = json.dumps(data['library'], ensure_ascii=False, separators=(',', ':'))
                        db.execute('BEGIN IMMEDIATE')
                        row = db.execute('SELECT revision FROM libraries WHERE user_id=?', (user['id'],)).fetchone()
                        version = row['revision'] if row else 0
                        if version != data['revision']:
                            db.rollback()
                            return self.reply(409, {'error': '其他设备已修改文档，请先处理同步冲突。', 'revision': version})
                        now = int(time.time())
                        db.execute('INSERT INTO libraries VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content,revision=excluded.revision,updated_at=excluded.updated_at', (user['id'], content, version + 1, now))
                        db.commit()
                        return self.reply(200, {'revision': version + 1, 'updatedAt': now})
                if path == '/api/account' and self.command in ('PATCH', 'DELETE'):
                    data = self.body()
                    old = data.get('password', '')
                    if not isinstance(old, str) or len(old) > 256 or not hmac.compare_digest(password_hash(old, user['salt']), user['password_hash']):
                        return self.reply(401, {'error': '当前密码不正确。'})
                    if self.command == 'DELETE':
                        if user['role'] == 'admin':
                            return self.reply(403, {'error': '管理员账号不能注销，请保留站点管理权限。'})
                        db.execute('DELETE FROM users WHERE id=?', (user['id'],))
                        db.commit()
                        return self.reply(200, {'ok': True}, self.session_cookie(max_age=0))
                    display = data.get('displayName', user['display_name'])
                    if not isinstance(display, str) or not 1 <= len(display.strip()) <= 32:
                        raise ValueError('显示名称为 1–32 个字符。')
                    next_password = data.get('newPassword', '')
                    if not isinstance(next_password, str) or (next_password and not 8 <= len(next_password) <= 256):
                        raise ValueError('新密码为 8–256 个字符。')
                    salt = secrets.token_hex(24) if next_password else user['salt']
                    hashed = password_hash(next_password, salt) if next_password else user['password_hash']
                    db.execute('UPDATE users SET display_name=?, salt=?, password_hash=? WHERE id=?', (display.strip(), salt, hashed, user['id']))
                    if next_password:
                        db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?', (user['id'], self.token_hash()))
                    db.commit()
                    return self.reply(200, {'user': public_user(db.execute('SELECT * FROM users WHERE id=?', (user['id'],)).fetchone())})
                return self.reply(404, {'error': '接口不存在。'})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            return self.reply(400, {'error': '提交内容不正确，请检查后重试。'})
        except sqlite3.IntegrityError:
            return self.reply(409, {'error': '数据已存在，请刷新后重试。'})
        except sqlite3.Error:
            return self.reply(503, {'error': '存储暂时不可用，请稍后重试。'})

    def do_GET(self):
        if urlsplit(self.path).path.startswith('/api/'):
            return self.api()
        # Static serving is allowlisted: never expose database, scripts, backups or tests.
        path = urlsplit(self.path).path
        allowed = {'/', '/index.html', '/login.html', '/admin.html', '/styles.css', '/editor.css', '/workspace.css', '/auth.css', '/admin.css', '/shortcuts.css', '/engine.js', '/workspace.js', '/library-order.js', '/cloud.js', '/login.js', '/admin.js', '/shortcuts.js', '/favicon.ico'}
        if path not in allowed and not (path.startswith(('/fonts/', '/vendor/', '/data/')) and '..' not in path and '\\' not in path and '%' not in path):
            return self.send_error(HTTPStatus.NOT_FOUND)
        resolved = Path(self.translate_path(self.path)).resolve()
        if not resolved.is_relative_to(ROOT) or (path != '/' and resolved.is_dir()):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_HEAD(self):
        if urlsplit(self.path).path.startswith('/api/'):
            return self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)
        # Use the same file allowlist as GET; HEAD responses have no static body.
        return self.do_GET()

    def do_POST(self):
        return self.api()

    def do_PUT(self):
        return self.api()

    def do_PATCH(self):
        return self.api()

    def do_DELETE(self):
        return self.api()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    initialize()
    print(f'Paper Notes: http://{args.host}:{args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
