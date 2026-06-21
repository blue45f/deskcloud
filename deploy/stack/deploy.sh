#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  deploy.sh — DeskCloud 원클릭 배포 + 헬스체크
#  빌드 → 기동 → 각 Desk 의 /health 를 게이트웨이를 통해 확인한다.
#
#    ./deploy.sh                 # build + up -d + health-check
#    ./deploy.sh --no-build      # 빌드 생략(이미지 재사용)하고 up + health-check
#    BASE_URL=https://desk.example.com ./deploy.sh   # 외부 도메인으로 헬스체크
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")"

# .env 없으면 gen-env.sh 안내.
if [[ ! -f .env ]]; then
	echo "✗ .env 가 없습니다. 먼저 ./gen-env.sh 로 생성하세요(또는 cp .env.example .env)." >&2
	exit 1
fi

# docker compose v2(플러그인) / v1(독립) 자동 감지.
if docker compose version >/dev/null 2>&1; then
	DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
	DC="docker-compose"
else
	echo "✗ docker compose 를 찾을 수 없습니다." >&2
	exit 1
fi

BUILD_IMAGES=1
[[ "${1:-}" == "--no-build" ]] && BUILD_IMAGES=0

SERVICES=(
	"surveydesk"
	"addesk"
	"authdesk"
	"filedesk"
	"changelogdesk"
	"reviewdesk"
	"mediadesk"
	"notifydesk"
	"moderationdesk"
	"realtimedesk"
	"searchdesk"
	"communitydesk"
	"chatdesk"
	"deskplatform"
)

export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
SERVICE_START_DELAY="${SERVICE_START_DELAY:-5}"
SERVICE_READY_RETRIES="${SERVICE_READY_RETRIES:-90}"
SERVICE_STABILIZE_DELAY="${SERVICE_STABILIZE_DELAY:-45}"

wait_service_ready() {
	local service="$1"
	local status

	for _ in $(seq 1 "$SERVICE_READY_RETRIES"); do
		status="$($DC ps --status running --services "$service" 2>/dev/null || true)"
		if [[ "$status" == "$service" ]]; then
			if $DC exec -T "$service" node -e 'fetch("http://127.0.0.1:4000/health").then((r) => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))' >/dev/null 2>&1; then
				return 0
			fi
		fi
		sleep 2
	done

	echo "✗ $service 가 컨테이너 내부 /health 준비 상태가 되지 않았습니다." >&2
	$DC ps "$service" >&2 || true
	$DC logs --tail=80 "$service" >&2 || true
	return 1
}

if [[ "$BUILD_IMAGES" == "1" ]]; then
	echo "▶ DeskCloud 이미지 빌드 (서비스별 순차 build) …"
	for service in "${SERVICES[@]}"; do
		echo "  • $service"
		$DC build "$service"
	done
fi

echo "▶ DeskCloud 순차 기동 준비 (기존 컨테이너 stop) …"
$DC stop caddy "${SERVICES[@]}" >/dev/null || true

echo "▶ DeskCloud 서비스 순차 기동 ($DC up -d --no-build --no-deps --force-recreate, delay=${SERVICE_START_DELAY}s, stabilize=${SERVICE_STABILIZE_DELAY}s) …"
for service in "${SERVICES[@]}"; do
	echo "  • up $service"
	$DC up -d --no-build --no-deps --force-recreate "$service"
	sleep "$SERVICE_START_DELAY"
	echo "    wait $service /health"
	wait_service_ready "$service"
	sleep "$SERVICE_STABILIZE_DELAY"
done

echo "▶ DeskCloud 게이트웨이 기동 ($DC up -d --no-build --no-deps --force-recreate caddy) …"
$DC up -d --no-build --no-deps --force-recreate caddy

# 헬스체크 베이스 URL — .env 의 DESKCLOUD_DOMAIN 우선, 없으면 로컬 HTTP_PORT.
HTTP_PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || true)"
HTTP_PORT="${HTTP_PORT:-80}"
DOMAIN="$(grep -E '^DESKCLOUD_DOMAIN=' .env | cut -d= -f2 || true)"
if [[ -n "${BASE_URL:-}" ]]; then
	:
elif [[ -n "$DOMAIN" ]]; then
	BASE_URL="https://$DOMAIN"
else
	BASE_URL="http://localhost:$HTTP_PORT"
fi

# Desk → 게이트웨이 헬스 경로(서브패스). realtime/chat 도 REST 브랜치라 /<desk>/health.
DESKS=(
	"surveydesk:/survey/health"
	"addesk:/ad/health"
	"authdesk:/authdesk/health"
	"filedesk:/file/health"
	"changelogdesk:/changelog/health"
	"reviewdesk:/review/health"
	"mediadesk:/media/health"
	"notifydesk:/notify/health"
	"moderationdesk:/moderation/health"
	"realtimedesk:/realtime/health"
	"searchdesk:/search/health"
	"communitydesk:/community/health"
	"chatdesk:/chat/health"
	"deskplatform:/platform/health"
)

echo "▶ 게이트웨이 기동 대기 ($BASE_URL) …"
for _ in $(seq 1 30); do
	if curl -fsS -o /dev/null "$BASE_URL/" 2>/dev/null; then break; fi
	sleep 2
done

echo "▶ 각 Desk 헬스체크 (PGlite 마이그레이션·시드까지 시간이 걸릴 수 있음) …"
fail=0
for entry in "${DESKS[@]}"; do
	name="${entry%%:*}"
	path="${entry#*:}"
	ok=0
	for _ in $(seq 1 30); do
		code="$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE_URL$path" 2>/dev/null || true)"
		if [[ "$code" == "200" ]]; then ok=1; break; fi
		sleep 2
	done
	if [[ "$ok" == "1" ]]; then
		printf '  ✓ %-16s %s\n' "$name" "$BASE_URL$path"
	else
		printf '  ✗ %-16s %s  (last=%s)\n' "$name" "$BASE_URL$path" "${code:-none}"
		fail=1
	fi
done

if [[ "$fail" == "0" ]]; then
	echo "✓ 모든 Desk 헬스 OK — DeskCloud 라이브."
else
	echo "✗ 일부 Desk 가 응답하지 않습니다. 로그 확인:  $DC logs --tail=80 <service>" >&2
	exit 1
fi
