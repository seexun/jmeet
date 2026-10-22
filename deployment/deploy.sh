#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-}"
ACTION="${2:-up}"

if [[ "$MODE" != "public" && "$MODE" != "intranet" ]]; then
  echo "用法: bash deploy.sh <public|intranet> [up|down|restart|ps|logs|pull|config]"
  exit 2
fi

ENV_FILE="$SCRIPT_DIR/.env.$MODE"
EXAMPLE_FILE="$SCRIPT_DIR/.env.$MODE.example"
OVERLAY_FILE="$SCRIPT_DIR/docker-compose.$MODE.yml"
PROJECT_NAME="jmeet-$MODE"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "已创建 $ENV_FILE，请修改域名和所有 change-this 密钥后重新执行。"
  exit 1
fi

COMPOSE=(docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" \
  --file "$SCRIPT_DIR/docker-compose.yml" --file "$OVERLAY_FILE")

case "$ACTION" in
  up)
    if grep -q 'change-this' "$ENV_FILE"; then
      echo "$ENV_FILE 中仍有 change-this 占位值，请先替换为安全的随机密钥。"
      exit 1
    fi
    "${COMPOSE[@]}" up --detach --build
    ;;
  down) "${COMPOSE[@]}" down ;;
  restart) "${COMPOSE[@]}" restart ;;
  ps) "${COMPOSE[@]}" ps ;;
  logs) "${COMPOSE[@]}" logs --follow --tail=200 ;;
  pull) "${COMPOSE[@]}" pull ;;
  config) "${COMPOSE[@]}" config ;;
  *)
    echo "未知操作: $ACTION"
    exit 2
    ;;
esac
