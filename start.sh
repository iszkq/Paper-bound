#!/bin/sh
set -eu
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$APP_DIR"
PYTHON=${NOTES_PYTHON:-python3}
"$PYTHON" -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10 or newer is required"'
export PYTHONUNBUFFERED=1
export NOTES_DATA_DIR=${NOTES_DATA_DIR:-"$APP_DIR/storage"}
exec "$PYTHON" server.py --host "${NOTES_HOST:-127.0.0.1}" --port "${NOTES_PORT:-8080}"
