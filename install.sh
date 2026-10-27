#!/usr/bin/env bash
# Native Linux installer: sudo bash install.sh [--port 8080]
set -euo pipefail
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP=/opt/paper-bound
DATA=/var/lib/paper-bound
PORT=${NOTES_PORT:-}
CHECK=0
while (($#)); do
  case "$1" in
    --check) CHECK=1; shift ;;
    --port) PORT=${2:?请在 --port 后填写端口}; shift 2 ;;
    *) echo '用法：sudo bash install.sh [--port 8080]；仅检查：bash install.sh --check' >&2; exit 1 ;;
  esac
done
DEFAULT_PORT=8080
if [[ -f /etc/systemd/system/paper-bound.service ]]; then
  SAVED_PORT=$(sed -n 's/^Environment=NOTES_PORT=\([0-9][0-9]*\)$/\1/p' /etc/systemd/system/paper-bound.service | head -n 1)
  [[ -z $SAVED_PORT ]] || DEFAULT_PORT=$SAVED_PORT
fi
if [[ -z $PORT ]]; then
  if [[ -t 0 && $CHECK == 0 ]]; then
    read -r -p "请输入访问端口（回车使用 $DEFAULT_PORT）：" PORT
  fi
  PORT=${PORT:-$DEFAULT_PORT}
fi
if [[ ! $PORT =~ ^[0-9]{1,5}$ ]] || ((10#$PORT < 1 || 10#$PORT > 65535)); then
  echo '端口应为 1–65535 的整数。' >&2; exit 1
fi
PORT=$((10#$PORT))
if [[ ! -f $SOURCE/release.json || ! -f $SOURCE/deploy/paper-bound.service ]]; then
  echo '请先完整解压项目，再在项目目录运行此脚本。' >&2; exit 1
fi
find_python() {
  PYTHON=''
  for candidate in "${NOTES_PYTHON:-}" /usr/bin/python3 /usr/local/bin/python3 python3 python3.13 python3.12 python3.11 python3.10; do
    [[ -n $candidate ]] || continue
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys;sys.exit(sys.version_info < (3,10))' >/dev/null 2>&1; then
      PYTHON=$(command -v "$candidate"); return
    fi
  done
}
find_python
if [[ -z $PYTHON && $CHECK == 0 && $(id -u) == 0 ]] && command -v apt-get >/dev/null 2>&1; then
  echo '正在安装宿主机 Python…'
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3
  find_python
fi
if [[ -z $PYTHON ]]; then
  echo '需要 Python 3.10 或更新版本。请通过服务器包管理器安装后重试。' >&2; exit 1
fi
(cd "$SOURCE"; "$PYTHON" - <<'PY'
import server
info = server.release_info()
if not info['filesValid']:
    raise SystemExit('项目文件不完整或已被修改，请重新下载完整版本：' + ', '.join(info['changedFiles']))
print('版本检查通过：' + info['version'] + ' / ' + info['build'])
PY
)
if [[ $CHECK == 1 ]]; then
  echo "安装检查通过。应用端口：$PORT；Python：$PYTHON。未修改系统配置。"; exit 0
fi
if [[ $(uname -s) != Linux || ! -d /run/systemd/system ]]; then
  echo '自动安装适用于使用 systemd 的 Linux。其他环境可直接运行 sh start.sh。' >&2; exit 1
fi
if [[ $(id -u) != 0 ]]; then
  echo '请使用 sudo bash install.sh，脚本需要创建系统服务。' >&2; exit 1
fi
for command in systemctl useradd install; do
  command -v "$command" >/dev/null 2>&1 || { echo "系统缺少 $command" >&2; exit 1; }
done
if command -v ss >/dev/null 2>&1; then
  LISTENERS=$(ss -H -ltnp "sport = :$PORT")
  MAIN_PID=$(systemctl show paper-bound -p MainPID --value 2>/dev/null || true)
  if [[ -n $LISTENERS && ( -z $MAIN_PID || $MAIN_PID == 0 || $LISTENERS != *"pid=$MAIN_PID,"* ) ]]; then
    echo "端口 $PORT 已被占用，请换个端口，例如 sudo bash install.sh --port 9188。" >&2; exit 1
  fi
fi
# Refuse to silently ignore notes saved by an earlier manual installation.
if [[ -f $SOURCE/storage/notes.sqlite3 && ! -f $DATA/notes.sqlite3 ]]; then
  echo '检测到项目内有旧数据库。请先按 deploy/README.md 迁移数据，再运行安装脚本。不会覆盖旧数据。' >&2; exit 1
fi
id paper-bound >/dev/null 2>&1 || useradd --system --user-group --home-dir "$DATA" --no-create-home paper-bound
install -d -o paper-bound -g paper-bound -m 700 "$DATA"
install -d -m 755 "$APP"
systemctl stop paper-bound 2>/dev/null || true
if [[ -f $DATA/notes.sqlite3 ]]; then
  "$PYTHON" - "$DATA" <<'PY'
from pathlib import Path
import sqlite3
import sys
import time
root = Path(sys.argv[1])
backups = root / 'backups'
backups.mkdir(mode=0o700, exist_ok=True)
destination = backups / ('notes-' + str(time.time_ns()) + '.sqlite3')
with sqlite3.connect(str(root / 'notes.sqlite3')) as source, sqlite3.connect(str(destination)) as target:
    source.backup(target)
destination.chmod(0o600)
print('更新前数据库备份：' + str(destination))
PY
fi
"$PYTHON" - "$SOURCE" "$APP" "$PYTHON" "$PORT" <<'PY'
from pathlib import Path
import json
import shutil
import sys
source, app = (Path(value).resolve() for value in sys.argv[1:3])
manifest = json.loads((source / 'release.json').read_text(encoding='utf-8'))
files = list(manifest['files']) + ['release.json', 'start.sh', 'install.sh', 'README.md', 'deploy/README.md', 'deploy/paper-bound.service', 'deploy/nginx-location.conf']
for name in files:
    original, target = (source / name).resolve(), (app / name).resolve()
    if not original.is_relative_to(source) or not target.is_relative_to(app):
        raise SystemExit('安装文件路径异常')
    target.parent.mkdir(parents=True, exist_ok=True)
    if original != target:
        shutil.copy2(original, target)
    target.chmod(0o644)
unit = (app / 'deploy/paper-bound.service').read_text(encoding='utf-8')
unit = unit.replace('Environment=NOTES_PORT=8080', 'Environment=NOTES_PORT=' + sys.argv[4])
unit = unit.replace('Environment=NOTES_HOST=0.0.0.0', 'Environment=NOTES_HOST=0.0.0.0\nEnvironment="NOTES_PYTHON=' + sys.argv[3] + '"')
if int(sys.argv[4]) < 1024:
    unit = unit.replace('NoNewPrivileges=true', 'NoNewPrivileges=true\nAmbientCapabilities=CAP_NET_BIND_SERVICE')
Path('/etc/systemd/system/paper-bound.service').write_text(unit, encoding='utf-8')
PY
for file in "$DATA/notes.sqlite3" "$DATA/notes.sqlite3-wal" "$DATA/notes.sqlite3-shm"; do
  [[ ! -f $file ]] || chown paper-bound:paper-bound "$file"
done
systemctl daemon-reload
systemctl enable paper-bound
systemctl start paper-bound
"$PYTHON" - "$PORT" <<'PY'
import json
import sys
import time
import urllib.request
for _ in range(40):
    try:
        with urllib.request.urlopen('http://127.0.0.1:' + sys.argv[1] + '/api/version', timeout=2) as response:
            info = json.load(response)
        if info['filesValid'] and not info['restartRequired']:
            print('应用已启动，版本：' + info['version'])
            break
    except (OSError, ValueError):
        pass
    time.sleep(.25)
else:
    raise SystemExit('服务启动检查失败，请执行：sudo journalctl -u paper-bound -n 50 --no-pager')
PY
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "安装完成，请打开：http://${IP:-内网IP}:$PORT"
echo '首次使用请创建管理员。关掉终端后会继续运行，服务器重启后自动启动。'
echo "账号和文档数据：$DATA；程序目录：$APP"
echo "以后更新仍执行同一条安装命令；默认保留端口 $PORT，也可用 --port 改为其他端口。"
