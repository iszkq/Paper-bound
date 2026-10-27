#!/usr/bin/env bash
# Native Linux installer: sudo bash install.sh [--port 8080] [--data-dir /path]
set -euo pipefail
export PYTHONIOENCODING=utf-8
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP=/opt/paper-bound
DATA=${NOTES_DATA_DIR:-}
PORT=${NOTES_PORT:-}
CHECK=0
while (($#)); do
  case "$1" in
    --check) CHECK=1; shift ;;
    --port) PORT=${2:?请在 --port 后填写端口}; shift 2 ;;
    --data-dir) DATA=${2:?请在 --data-dir 后填写数据文件夹的绝对路径}; shift 2 ;;
    *) echo '用法：sudo bash install.sh [--port 8080] [--data-dir /你的数据文件夹]；仅检查：bash install.sh --check' >&2; exit 1 ;;
  esac
done
if [[ ! -f $SOURCE/release.json || ! -f $SOURCE/deploy/paper-bound.service || ! -f $SOURCE/deploy/install_data.py ]]; then
  echo '请先完整解压项目，再在项目目录运行此脚本。' >&2; exit 1
fi
if [[ $CHECK == 0 && $(uname -s) == Linux && -d /run/systemd/system && $(id -u) == 0 ]]; then
  command -v flock >/dev/null 2>&1 || { echo '系统缺少 flock' >&2; exit 1; }
  exec 9>/run/lock/paper-bound-install.lock
  flock -n 9 || { echo '另一个安装或更新正在运行，请稍后重试。' >&2; exit 1; }
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
data_tool() { (cd "$SOURCE"; MSYS_NO_PATHCONV=1 "$PYTHON" deploy/install_data.py "$@"); }
CONFIG=$(data_tool previous)
mapfile -t SAVED_CONFIG <<< "$CONFIG"
DEFAULT_PORT=${SAVED_CONFIG[0]}
PREVIOUS_DATA=${SAVED_CONFIG[1]}
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
if [[ -z $DATA ]]; then
  if [[ -t 0 && $CHECK == 0 ]]; then
    read -r -p "请输入账号、文档和模板的数据文件夹（回车使用 $PREVIOUS_DATA）：" DATA
  fi
  DATA=${DATA:-$PREVIOUS_DATA}
fi
DATA=$(data_tool validate "$DATA")
OLD_DATA=$PREVIOUS_DATA
if [[ ! -f /etc/systemd/system/paper-bound.service && ! -f $OLD_DATA/notes.sqlite3 && -f $SOURCE/storage/notes.sqlite3 && ! -f $DATA/notes.sqlite3 ]]; then
  echo '检测到项目内有旧数据库。请先停止原来的手动服务，并按 deploy/README.md 迁移数据，不会丢弃原数据创建空库。' >&2; exit 1
fi
if [[ -f /etc/systemd/system/paper-bound.service && ! -f $OLD_DATA/notes.sqlite3 ]]; then
  echo "原配置的数据目录 $OLD_DATA 中没有数据库，请先检查磁盘挂载或还原备份，避免创建空数据库。" >&2; exit 1
fi
data_tool preflight "$OLD_DATA" "$DATA"
(cd "$SOURCE"; "$PYTHON" - <<'PY'
import server
info = server.release_info()
if not info['filesValid']:
    raise SystemExit('项目文件不完整或已被修改，请重新下载完整版本：' + ', '.join(info['changedFiles']))
print('版本检查通过：' + info['version'] + ' / ' + info['build'])
PY
)
if [[ $CHECK == 1 ]]; then
  echo "安装检查通过。应用端口：$PORT；数据文件夹：$DATA；Python：$PYTHON。未修改系统配置。"; exit 0
fi
if [[ $(uname -s) != Linux || ! -d /run/systemd/system ]]; then
  echo '自动安装适用于使用 systemd 的 Linux。其他环境可直接运行 sh start.sh。' >&2; exit 1
fi
if [[ $(id -u) != 0 ]]; then
  echo '请使用 sudo bash install.sh，脚本需要创建系统服务。' >&2; exit 1
fi
for command in systemctl useradd install flock; do
  command -v "$command" >/dev/null 2>&1 || { echo "系统缺少 $command" >&2; exit 1; }
done
if command -v ss >/dev/null 2>&1; then
  LISTENERS=$(ss -H -ltnp "sport = :$PORT")
  MAIN_PID=$(systemctl show paper-bound -p MainPID --value 2>/dev/null || true)
  if [[ -n $LISTENERS && ( -z $MAIN_PID || $MAIN_PID == 0 || $LISTENERS != *"pid=$MAIN_PID,"* ) ]]; then
    echo "端口 $PORT 已被占用，请换个端口，例如 sudo bash install.sh --port 9188。" >&2; exit 1
  fi
fi
id paper-bound >/dev/null 2>&1 || useradd --system --user-group --home-dir "$DATA" --no-create-home paper-bound
install -d -o paper-bound -g paper-bound -m 700 "$DATA"
install -d -m 755 "$APP"
if [[ -f /etc/systemd/system/paper-bound.service ]]; then
  systemctl stop paper-bound
fi
data_tool prepare "$OLD_DATA" "$DATA"
"$PYTHON" - "$SOURCE" "$APP" "$PYTHON" "$PORT" "$DATA" <<'PY'
from pathlib import Path
import json
import shutil
import sys
source, app = (Path(value).resolve() for value in sys.argv[1:3])
sys.path.insert(0, str(source / 'deploy'))
from install_data import configure_unit
manifest = json.loads((source / 'release.json').read_text(encoding='utf-8'))
files = list(manifest['files']) + ['release.json', 'start.sh', 'install.sh', 'README.md', 'deploy/README.md', 'deploy/install_data.py', 'deploy/paper-bound.service', 'deploy/nginx-location.conf']
for name in files:
    original, target = (source / name).resolve(), (app / name).resolve()
    if not original.is_relative_to(source) or not target.is_relative_to(app):
        raise SystemExit('安装文件路径异常')
    target.parent.mkdir(parents=True, exist_ok=True)
    if original != target:
        shutil.copy2(original, target)
    target.chmod(0o644)
unit = (app / 'deploy/paper-bound.service').read_text(encoding='utf-8')
unit = configure_unit(unit, sys.argv[5])
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
echo "数据库：$DATA/notes.sqlite3；更新备份：$DATA/backups/"
echo "以后更新默认保留端口 $PORT 和数据文件夹；可用 --port 或 --data-dir 修改。"
