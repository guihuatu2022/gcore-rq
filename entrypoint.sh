#!/bin/sh
set -eu

LISTEN_PORT="${LISTEN_PORT:-8080}"
WS_PATH="${WS_PATH:-/ws}"
MEMORY_MB="${MEMORY_MB:-128}"
LOG_LEVEL="${LOG_LEVEL:-warn}"
CONFIG_OUT="${CONFIG_OUT:-/tmp/config.json}"
TEMPLATE="${TEMPLATE:-/etc/sing-box/config.template.json}"

if [ -z "${UUID:-}" ]; then
  echo "UUID is required" >&2
  exit 1
fi

case "$UUID" in
  *[!0-9a-fA-F-]*|"")
    echo "UUID is invalid: $UUID" >&2
    exit 1
    ;;
esac
# 8-4-4-4-12
case "$UUID" in
  ????????-????-????-????-????????????) ;;
  *)
    echo "UUID must be 8-4-4-4-12 hex" >&2
    exit 1
    ;;
esac

case "$LISTEN_PORT" in
  *[!0-9]*|"")
    echo "LISTEN_PORT must be an integer" >&2
    exit 1
    ;;
esac

case "$WS_PATH" in
  /*) ;;
  *)
    echo "WS_PATH must start with /" >&2
    exit 1
    ;;
esac

case "$MEMORY_MB" in
  *[!0-9]*|""|0)
    echo "MEMORY_MB must be a positive integer (MiB)" >&2
    exit 1
    ;;
esac

# 约 75% 给 Go 堆软上限，给 cgroup/其它留余量
GOMEMLIMIT_MB=$((MEMORY_MB * 75 / 100))
if [ "$GOMEMLIMIT_MB" -lt 32 ]; then
  GOMEMLIMIT_MB=32
fi
export GOMEMLIMIT="${GOMEMLIMIT_MB}MiB"

if [ "$MEMORY_MB" -le 128 ]; then
  export GOGC=50
  export GOMAXPROCS=1
elif [ "$MEMORY_MB" -le 255 ]; then
  export GOGC=80
  export GOMAXPROCS=1
elif [ "$MEMORY_MB" -le 511 ]; then
  export GOGC=80
  export GOMAXPROCS="${GOMAXPROCS:-2}"
else
  export GOGC="${GOGC:-100}"
fi

# 转义 sed 替换里的 & \ /
esc() {
  printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'
}

UUID_ESC="$(esc "$UUID")"
WS_PATH_ESC="$(esc "$WS_PATH")"
LOG_LEVEL_ESC="$(esc "$LOG_LEVEL")"

sed \
  -e "s/__UUID__/${UUID_ESC}/g" \
  -e "s/__WS_PATH__/${WS_PATH_ESC}/g" \
  -e "s/__LISTEN_PORT__/${LISTEN_PORT}/g" \
  -e "s/__LOG_LEVEL__/${LOG_LEVEL_ESC}/g" \
  "$TEMPLATE" > "$CONFIG_OUT"

echo "listen=${LISTEN_PORT} path=${WS_PATH} memory_mb=${MEMORY_MB} GOMEMLIMIT=${GOMEMLIMIT} GOGC=${GOGC} GOMAXPROCS=${GOMAXPROCS:-auto}"

/usr/local/bin/sing-box check -c "$CONFIG_OUT"
exec /usr/local/bin/sing-box run -c "$CONFIG_OUT"
