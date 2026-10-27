"""Data-directory configuration and offline SQLite migration for the installer."""
import argparse
from contextlib import closing
import os
from pathlib import Path
import posixpath
import shlex
import shutil
import sqlite3
import subprocess
import sys
import time

DEFAULT_DATA = '/var/lib/paper-bound'
APP = '/opt/paper-bound'


def previous(service=Path('/etc/systemd/system/paper-bound.service')):
    values = {}
    if service.is_file():
        for line in service.read_text(encoding='utf-8').splitlines():
            if line.startswith('Environment='):
                assignments = shlex.split(line.partition('=')[2])
                if not assignments:
                    values.clear()
                for item in assignments:
                    key, _, value = item.partition('=')
                    values[key] = value
    if os.name == 'posix' and service == Path('/etc/systemd/system/paper-bound.service'):
        try:
            result = subprocess.run(['systemctl', 'show', 'paper-bound', '--property=MainPID', '--value'], capture_output=True, text=True, timeout=5)
            pid = result.stdout.strip()
            if result.returncode == 0 and pid.isdigit() and int(pid) > 0:
                for item in Path('/proc', pid, 'environ').read_bytes().split(b'\0'):
                    key, separator, value = item.partition(b'=')
                    if separator and key in (b'NOTES_DATA_DIR', b'NOTES_PORT'):
                        values[key.decode()] = value.decode('utf-8')
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    return values.get('NOTES_PORT', '8080'), values.get('NOTES_DATA_DIR', DEFAULT_DATA)


def validate(value, *, inspect=True):
    value = value.strip()
    if not value.startswith('/') or any(ord(c) < 32 for c in value) or any(c in value for c in '\\"%:'):
        raise ValueError('数据目录请使用 Linux 绝对路径；不支持控制字符、反斜杠、双引号、百分号或冒号。')
    value = posixpath.normpath(value)
    if os.name == 'posix':
        value = str(Path(value).resolve())
    if value in ('/', '/opt', '/var', '/var/lib', '/srv', '/mnt', '/media', '/home', '/root', '/data'):
        raise ValueError('请指定纸间专用子文件夹，例如 /data/paper-bound，不要直接使用公共目录。')
    for root in (APP, '/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/proc', '/sys', '/dev', '/run', '/tmp', '/var/tmp', '/boot'):
        if value == root or value.startswith(root + '/'):
            raise ValueError('数据目录不能放在程序、系统或临时目录内，请选择单独的持久化文件夹。')
    if inspect and os.name == 'posix':
        path = Path(value)
        if path.exists():
            if not path.is_dir():
                raise ValueError('所选数据位置不是文件夹。')
            allowed = {'notes.sqlite3', 'notes.sqlite3-wal', 'notes.sqlite3-shm', 'backups'}
            for child in path.iterdir():
                if child.name not in allowed or child.is_symlink():
                    raise ValueError('请选择空文件夹或已有纸间数据文件夹，避免修改其他文件的权限：' + str(child))
                if (child.name == 'backups' and not child.is_dir()) or (child.name != 'backups' and not child.is_file()):
                    raise ValueError('数据文件夹结构异常：' + str(child))
    return value


def inspect_database(path):
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('数据库完整性检查失败：' + str(path))
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'users', 'libraries'}.issubset(tables):
            raise ValueError('目标不是纸间数据库：' + str(path))


def preflight(old, new):
    if os.name != 'posix':
        return
    source, target = Path(old) / 'notes.sqlite3', Path(new) / 'notes.sqlite3'
    if old != new and source.exists() and target.exists():
        raise ValueError('目标目录已有数据库，已停止迁移，原服务和数据不会被覆盖。请另选空文件夹。')
    for path in {source, target}:
        if path.exists():
            inspect_database(path)


def copy_database(source, target):
    temporary = target.with_name(target.name + '.copy-' + str(time.time_ns()))
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as incoming, closing(sqlite3.connect(str(temporary))) as outgoing:
            incoming.backup(outgoing)
            # Keep each backup/migration self-contained before checking and renaming.
            outgoing.execute('PRAGMA journal_mode=DELETE')
        inspect_database(temporary)
        temporary.chmod(0o600)
        if target.exists():
            raise ValueError('目标数据库已存在，迁移已停止，不会覆盖。')
        temporary.rename(target)
    finally:
        if temporary.exists():
            temporary.unlink()


def backup(root):
    database = root / 'notes.sqlite3'
    if not database.exists():
        return
    directory = root / 'backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    destination = directory / ('notes-' + str(time.time_ns()) + '.sqlite3')
    copy_database(database, destination)
    print('更新前数据库备份：' + str(destination))


def prepare(old, new):
    preflight(str(old), str(new))
    if old != new and (old / 'notes.sqlite3').exists():
        backup(old)
        copy_database(old / 'notes.sqlite3', new / 'notes.sqlite3')
        if (old / 'backups').is_dir():
            backups = new / 'backups'
            backups.mkdir(mode=0o700, exist_ok=True)
            for source in (old / 'backups').glob('notes-*.sqlite3'):
                target = backups / source.name
                if target.exists():
                    target = backups / ('migrated-' + str(time.time_ns()) + '-' + source.name)
                shutil.copy2(source, target)
                target.chmod(0o600)
        print('数据已迁移到：' + str(new))
        print('原目录仍保留：' + str(old) + '（确认新目录正常前不要删除）')
    else:
        backup(new)


def quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def configure_unit(unit, data):
    unit = unit.replace('Environment=NOTES_DATA_DIR=' + DEFAULT_DATA, 'Environment=' + quote('NOTES_DATA_DIR=' + data))
    unit = unit.replace('ReadWritePaths=' + DEFAULT_DATA, 'ReadWritePaths=' + quote(data))
    unit = unit.replace('After=network.target', 'After=network.target\nRequiresMountsFor=' + quote(data))
    # A narrow bind exposes only the selected directory inside protected home paths.
    if data.startswith(('/root/', '/home/')):
        unit = unit.replace('ProtectHome=true', 'ProtectHome=tmpfs\nBindPaths=' + quote(data))
    return unit


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['previous', 'validate', 'preflight', 'prepare'])
    parser.add_argument('paths', nargs='*')
    args = parser.parse_args()
    try:
        if args.action == 'previous':
            print('\n'.join(previous()))
        elif args.action == 'validate':
            print(validate(args.paths[0]))
        elif args.action == 'preflight':
            preflight(*args.paths)
        else:
            prepare(*(Path(value) for value in args.paths))
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(str(error))
