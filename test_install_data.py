from pathlib import Path
from contextlib import closing
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from deploy import install_data


class InstallDataTests(unittest.TestCase):
    def test_dedicated_absolute_paths(self):
        self.assertEqual(install_data.validate('/srv/纸间 数据', inspect=False), '/srv/纸间 数据')
        self.assertEqual(install_data.validate('/data/notes/../paper-bound', inspect=False), '/data/paper-bound')
        for value in ('relative', '/', '/opt', '/var/lib', '/root', '/data', '/tmp/notes', '/etc/notes', '/opt/paper-bound/storage', '/opt/paper-bound/fonts', '/data/bad\nvalue', '/data/percent%dir'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                install_data.validate(value, inspect=False)

    def test_old_and_quoted_service_configuration(self):
        template = Path('deploy/paper-bound.service').read_text(encoding='utf-8')
        with tempfile.TemporaryDirectory() as temporary:
            service = Path(temporary) / 'paper-bound.service'
            self.assertEqual(install_data.previous(service), ('8080', '/var/lib/paper-bound'))
            service.write_text(template, encoding='utf-8')
            self.assertEqual(install_data.previous(service), ('8080', '/var/lib/paper-bound'))
            unit = install_data.configure_unit(template, '/srv/纸间 数据')
            unit = unit.replace('NOTES_PORT=8080', 'NOTES_PORT=9188')
            service.write_text(unit, encoding='utf-8')
            self.assertEqual(install_data.previous(service), ('9188', '/srv/纸间 数据'))
            self.assertIn('ReadWritePaths="/srv/纸间 数据"', unit)
            self.assertIn('RequiresMountsFor="/srv/纸间 数据"', unit)
            protected = install_data.configure_unit(template, '/root/纸间 数据')
            self.assertIn('ProtectHome=tmpfs', protected)
            self.assertIn('BindPaths="/root/纸间 数据"', protected)

    def test_migration_keeps_source_and_backup(self):
        with tempfile.TemporaryDirectory() as temporary:
            old, new = Path(temporary) / 'old', Path(temporary) / 'new'
            old.mkdir(); new.mkdir()
            database = old / 'notes.sqlite3'
            with closing(sqlite3.connect(str(database))) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.executescript("CREATE TABLE users(id TEXT); CREATE TABLE libraries(content TEXT); INSERT INTO users VALUES ('owner'); INSERT INTO libraries VALUES ('document and template');")
            original = database.read_bytes()
            install_data.prepare(old, new)
            self.assertEqual(database.read_bytes(), original)
            with closing(sqlite3.connect(str(new / 'notes.sqlite3'))) as db:
                self.assertEqual(db.execute('SELECT content FROM libraries').fetchone()[0], 'document and template')
            self.assertTrue(list((new / 'backups').glob('notes-*.sqlite3')))
            self.assertTrue(list((old / 'backups').glob('notes-*.sqlite3')))
            self.assertEqual({path.name for path in new.iterdir()}, {'notes.sqlite3', 'backups'})
            self.assertTrue(all(path.suffix == '.sqlite3' for path in (new / 'backups').iterdir()))
            install_data.prepare(new, new)
            self.assertGreaterEqual(len(list((new / 'backups').glob('notes-*.sqlite3'))), 2)
            target_before = (new / 'notes.sqlite3').read_bytes()
            with self.assertRaises(ValueError):
                install_data.prepare(old, new)
            self.assertEqual(database.read_bytes(), original)
            self.assertEqual((new / 'notes.sqlite3').read_bytes(), target_before)

    @unittest.skipUnless(os.name == 'posix', 'Inspect Linux filesystem paths')
    def test_running_service_configuration_takes_precedence(self):
        with patch.object(Path, 'is_file', return_value=False), patch.object(Path, 'read_bytes', return_value=b'OTHER=ignored\0NOTES_PORT=9189\0NOTES_DATA_DIR=/srv/live data\0'), patch.object(install_data.subprocess, 'run') as command:
            command.return_value.returncode = 0
            command.return_value.stdout = '123\n'
            self.assertEqual(install_data.previous(), ('9189', '/srv/live data'))
            command.return_value.stdout = '0\n'
            self.assertEqual(install_data.previous(), ('8080', '/var/lib/paper-bound'))

    @unittest.skipUnless(os.name == 'posix', 'Inspect systemd failure journal')
    def test_first_start_failure_is_recoverable_only_for_matching_data_path(self):
        with patch.object(install_data.subprocess, 'run') as command:
            command.side_effect = [
                type('Result', (), {'returncode': 0, 'stdout': 'failed'})(),
                type('Result', (), {'returncode': 0, 'stdout': "PermissionError: [Errno 13] Permission denied: '/volume1/paper-bound'"})(),
            ]
            self.assertTrue(install_data.recoverable_first_start('/volume1/paper-bound'))
            command.side_effect = [
                type('Result', (), {'returncode': 0, 'stdout': 'failed'})(),
                type('Result', (), {'returncode': 0, 'stdout': "PermissionError: [Errno 13] Permission denied: '/volume1/paper-bound'"})(),
            ]
            self.assertFalse(install_data.recoverable_first_start('/volume1/other'))

    @unittest.skipUnless(os.name == 'posix', 'Inspect Linux filesystem paths')
    def test_reserved_data_entries_have_expected_types(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as temporary:
            root = Path(temporary)
            (root / 'backups').write_text('not a folder', encoding='utf-8')
            with self.assertRaises(ValueError):
                install_data.validate(temporary)
            (root / 'backups').unlink()
            (root / 'notes.sqlite3').mkdir()
            with self.assertRaises(ValueError):
                install_data.validate(temporary)

    @unittest.skipUnless(os.name == 'posix', 'Inspect Linux filesystem paths')
    def test_unrelated_existing_directory_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as temporary:
            self.assertEqual(install_data.validate(temporary), str(Path(temporary).resolve()))
            (Path(temporary) / 'unrelated.txt').write_text('keep this file', encoding='utf-8')
            with self.assertRaises(ValueError):
                install_data.validate(temporary)


if __name__ == '__main__':
    unittest.main()
