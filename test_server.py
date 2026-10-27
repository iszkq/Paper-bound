import copy
import http.cookiejar
import json
import hashlib
from pathlib import Path
import tempfile
import re
import threading
import unittest
import urllib.error
import urllib.request

import server


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DATA_DIR = Path(cls.temp.name)
        server.initialize()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.url = 'http://127.0.0.1:' + str(cls.http.server_port)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, client, path, method='GET', data=None, headers=None):
        req = urllib.request.Request(self.url + path, method=method, data=json.dumps(data).encode() if data is not None else None, headers={'Content-Type': 'application/json', **(headers or {})})
        try:
            response = client.open(req)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read()
            try:
                body = json.loads(body)
            except ValueError:
                pass
            return response.status, body, dict(response.headers)

    def test_deployment_pages_assets_and_version(self):
        client = self.client()
        status, version, headers = self.request(client, '/api/version')
        self.assertEqual(status, 200)
        self.assertTrue(version['filesValid'], version['changedFiles'])
        self.assertFalse(version['restartRequired'])
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertNotEqual(version['version'], 'development')
        for page in ('/', '/index.html', '/login.html', '/admin.html'):
            status, source, headers = self.request(client, page)
            self.assertEqual(status, 200)
            self.assertIn('no-cache', headers['Cache-Control'])
            source = source.decode('utf-8')
            self.assertIn('compat.js?v=', source)
            for asset in re.findall(r'(?:src|href)="([^"?#]+\.(?:css|js)\?v=[^"#]+)"', source):
                asset_status, _, asset_headers = self.request(client, '/' + asset)
                self.assertEqual(asset_status, 200, asset)
                self.assertIn('no-cache', asset_headers['Cache-Control'])

    def test_release_detects_missing_and_modified_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'example.js').write_bytes(b'const value = 1;\r\n')
            expected = hashlib.sha256(b'const value = 1;\n').hexdigest()
            (root / 'release.json').write_text(json.dumps({'version': 'test', 'files': {'example.js': expected}}), encoding='utf-8')
            self.assertTrue(server.release_info(root)['filesValid'])
            (root / 'example.js').write_bytes(b'const value = 2;\n')
            self.assertEqual(server.release_info(root)['changedFiles'], ['example.js'])
            (root / 'example.js').unlink()
            self.assertEqual(server.release_info(root)['changedFiles'], ['example.js'])

    def test_template_validation_and_legacy_libraries(self):
        legacy = {'folders': [], 'documents': [{'id': 'doc', 'title': '旧文档', 'data': {}}], 'activeId': 'doc'}
        server.validate_library(legacy)
        valid = {**legacy, 'templates': [{'id': 'tpl', 'name': '阅读模板', 'data': {'title': '阅读记录'}}], 'defaultTemplateId': 'tpl'}
        server.validate_library(valid)
        invalid = [
            {**valid, 'templates': {}},
            {**valid, 'templates': valid['templates'] * 2},
            {**valid, 'templates': [{'id': 'tpl', 'name': '', 'data': {}}]},
            {**valid, 'templates': [{'id': 'tpl', 'name': 'a' * 81, 'data': {}}]},
            {**valid, 'templates': [{'id': 'tpl', 'name': '模板', 'data': []}]},
            {**valid, 'defaultTemplateId': 'missing'},
            {**valid, 'defaultTemplateId': None},
        ]
        for index, library in enumerate(invalid):
            with self.subTest(case=index), self.assertRaises(ValueError):
                server.validate_library(library)

    def test_accounts_sync_isolation_conflicts_and_paths(self):
        a, b, second, guest = (self.client() for _ in range(4))
        admin = self.client()
        self.assertTrue(self.request(guest, '/api/setup')[1]['required'])
        self.assertEqual(self.request(a, '/api/register', 'POST', {'username': 'blocked_first', 'password': 'Password-123'})[0], 428)
        status, result, _ = self.request(admin, '/api/setup', 'POST', {'username': 'site_admin', 'password': 'Admin-12345'})
        self.assertEqual(status, 200)
        self.assertEqual(result['user']['role'], 'admin')
        self.assertFalse(self.request(guest, '/api/setup')[1]['required'])
        self.assertEqual(self.request(guest, '/api/setup', 'POST', {'username': 'another_admin', 'password': 'Admin-12345'})[0], 409)
        self.assertEqual(self.request(guest, '/api/library')[0], 401)
        self.assertEqual(self.request(guest, '/api/admin/settings')[0], 401)
        self.assertEqual(self.request(admin, '/api/admin/settings')[1]['registrationCode'], '108084')
        self.assertEqual(self.request(a, '/api/register', 'POST', {'username': 'reader_a', 'password': 'Password-123'})[0], 403)
        self.assertEqual(self.request(a, '/api/register', 'POST', {'username': 'reader_a', 'password': 'Password-123', 'registrationCode': 'wrong-code'})[0], 403)
        status, result, headers = self.request(a, '/api/register', 'POST', {'username': 'reader_a', 'password': 'Password-123', 'registrationCode': '108084', 'role': 'admin'})
        self.assertEqual(status, 200)
        self.assertEqual(result['user']['role'], 'user')
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', headers['Set-Cookie'])
        self.assertEqual(self.request(a, '/api/admin/settings')[0], 403)
        self.assertEqual(self.request(a, '/api/admin/settings', 'PATCH', {'registrationCode': 'hacked-code'})[0], 403)
        self.assertEqual(self.request(admin, '/api/admin/settings', 'PATCH', {'registrationCode': ''})[0], 400)
        self.assertEqual(self.request(admin, '/api/admin/settings', 'PATCH', {'registrationCode': 'x' * 65})[0], 400)
        self.assertEqual(self.request(admin, '/api/admin/settings')[1]['registrationCode'], '108084')
        self.assertEqual(self.request(admin, '/api/admin/settings', 'PATCH', {'registrationCode': 'new-code-2026'})[0], 200)
        # Schema initialization on restart must preserve the administrator's code.
        server.initialize()
        self.assertEqual(self.request(admin, '/api/admin/settings')[1]['registrationCode'], 'new-code-2026')
        self.assertEqual(self.request(b, '/api/register', 'POST', {'username': 'reader_b', 'password': 'Password-123', 'registrationCode': '108084'})[0], 403)
        self.assertEqual(self.request(b, '/api/register', 'POST', {'username': 'reader_b', 'password': 'Password-123', 'registrationCode': 'new-code-2026'})[0], 200)
        self.assertEqual(self.request(a, '/api/admin/users')[0], 403)
        status, child, _ = self.request(admin, '/api/admin/users', 'POST', {'username': 'child_user', 'password': 'Child-12345'})
        self.assertEqual(status, 201)
        self.assertEqual(child['user']['role'], 'user')
        child_id = child['user']['id']
        child_client = self.client()
        self.assertEqual(self.request(child_client, '/api/login', 'POST', {'username': 'child_user', 'password': 'Child-12345'})[0], 200)
        self.assertEqual(self.request(admin, '/api/admin/users/' + child_id, 'PATCH', {'disabled': True})[0], 200)
        self.assertEqual(self.request(child_client, '/api/library')[0], 401)
        self.assertEqual(self.request(child_client, '/api/login', 'POST', {'username': 'child_user', 'password': 'Child-12345'})[0], 401)
        self.assertEqual(self.request(admin, '/api/admin/users/' + child_id, 'PATCH', {'disabled': False, 'password': 'Reset-12345'})[0], 200)
        self.assertEqual(self.request(child_client, '/api/login', 'POST', {'username': 'child_user', 'password': 'Reset-12345'})[0], 200)
        self.assertEqual(self.request(admin, '/api/admin/users/' + child_id, 'DELETE', {})[0], 200)
        self.assertEqual(self.request(child_client, '/api/library')[0], 401)
        self.assertEqual(len(self.request(admin, '/api/admin/users')[1]['users']), 3)
        self.assertEqual(self.request(admin, '/api/account', 'DELETE', {'password': 'Admin-12345'})[0], 403)
        self.assertEqual(self.request(second, '/api/login', 'POST', {'username': 'reader_a', 'password': 'Bad-password'})[0], 401)
        self.assertEqual(self.request(second, '/api/login', 'POST', {'username': 'reader_a', 'password': 'Password-123'})[0], 200)
        self.assertEqual(self.request(second, '/api/session')[1]['user']['role'], 'user')
        library = {'folders': [{'id': 'folder', 'name': '阅读', 'parentId': ''}], 'documents': [{'id': 'doc', 'title': '用户 A 的笔记', 'folderId': 'folder', 'data': {'title': '用户 A 的笔记', 'paragraphs': [{'html': '独立存档'}]}}], 'activeId': 'doc', 'templates': [{'id': 'template', 'name': '用户 A 的模板', 'data': {'title': '固定标题', 'author': '固定作者', 'paragraphs': [{'html': '<b>保留格式</b>', 'noteHtml': '模板分析'}]}}], 'defaultTemplateId': 'template'}
        self.assertEqual(self.request(a, '/api/library', 'PUT', {'revision': 0, 'library': library})[0], 200)
        self.assertEqual(self.request(second, '/api/library')[1]['library'], library)
        self.assertIsNone(self.request(b, '/api/library')[1]['library'])
        self.assertEqual(self.request(a, '/api/library', 'PUT', {'revision': 0, 'library': library})[0], 409)
        self.assertEqual(self.request(a, '/api/library', 'PUT', {'revision': 1, 'library': library}, {'Origin': 'https://wrong.example'})[0], 403)
        broken = copy.deepcopy(library)
        broken['folders'][0]['parentId'] = 'folder'
        self.assertEqual(self.request(a, '/api/library', 'PUT', {'revision': 1, 'library': broken})[0], 400)
        broken = copy.deepcopy(library)
        broken['defaultTemplateId'] = 'missing'
        self.assertEqual(self.request(a, '/api/library', 'PUT', {'revision': 1, 'library': broken})[0], 400)
        # Concurrent writes share one expected revision: only one can commit.
        statuses = []
        workers = [threading.Thread(target=lambda c=c: statuses.append(self.request(c, '/api/library', 'PUT', {'revision': 1, 'library': library})[0])) for c in (a, second)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(self.request(a, '/api/account', 'PATCH', {'password': 'Password-123', 'displayName': '读者', 'newPassword': 'Changed-123'})[0], 200)
        self.assertEqual(self.request(second, '/api/library')[0], 401)
        self.assertEqual(self.request(second, '/api/login', 'POST', {'username': 'reader_a', 'password': 'Changed-123'})[0], 200)
        for path in ('/storage/notes.sqlite3', '/server.py', '/test_server.py', '/output/', '/fonts/../server.py', '/data/%2e%2e/server.py'):
            self.assertEqual(self.request(guest, path)[0], 404, path)
        self.assertEqual(self.request(a, '/api/account', 'DELETE', {'password': 'wrong-password'})[0], 401)
        self.assertEqual(self.request(a, '/api/account', 'DELETE', {'password': 'Changed-123'})[0], 200)
        self.assertEqual(self.request(second, '/api/library')[0], 401)
        self.assertEqual(self.request(b, '/api/session')[0], 200)
        self.assertIsNotNone(self.request(b, '/api/session')[1]['user'])
        self.assertEqual(self.request(b, '/api/logout', 'POST', {})[0], 200)
        self.assertEqual(self.request(b, '/api/library')[0], 401)


if __name__ == '__main__':
    unittest.main()
