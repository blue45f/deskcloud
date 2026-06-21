#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  gen-env.sh — DeskCloud .env 생성기
#  .env.example 을 복사하고 모든 *_ADMIN_TOKEN 을 강한 무작위 값으로 채운다.
#  기존 .env 는 덮어쓰지 않는다(있으면 --force 로만).
#
#    ./gen-env.sh            # .env 생성(없을 때만)
#    ./gen-env.sh --force    # 기존 .env 덮어쓰기(주의: 토큰이 모두 바뀜)
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")"

SRC=".env.example"
DST=".env"
FORCE="${1:-}"

if [[ ! -f "$SRC" ]]; then
	echo "✗ $SRC 가 없습니다. deploy/stack 디렉터리에서 실행하세요." >&2
	exit 1
fi

if [[ -f "$DST" && "$FORCE" != "--force" ]]; then
	echo "✗ $DST 가 이미 있습니다. 덮어쓰려면 ./gen-env.sh --force" >&2
	exit 1
fi

# 강한 토큰 생성기 — openssl 우선, 없으면 /dev/urandom 폴백.
gen_token() {
	if command -v openssl >/dev/null 2>&1; then
		openssl rand -hex 32
	else
		head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n'
	fi
}

cp "$SRC" "$DST"

# 모든 *_ADMIN_TOKEN / *_PEPPER / *_SECRET placeholder 라인을 무작위 토큰으로 치환.
# (주석 처리된 예시 라인은 '# ' 로 시작하므로 건드리지 않는다.)
while IFS= read -r key; do
	tok="$(gen_token)"
	# 이식성을 위해 임시파일 + 단일 라인 치환(macOS/BSD·GNU sed 모두 안전).
	awk -v k="$key" -v v="$tok" \
		'$0 ~ ("^" k "=") { print k "=" v; next } { print }' \
		"$DST" > "$DST.tmp" && mv "$DST.tmp" "$DST"
done < <(grep -oE '^[A-Z0-9_]+_(ADMIN_TOKEN|KEY_PEPPER|JWT_SECRET)=' "$SRC" | cut -d= -f1 | sort -u)

chmod 600 "$DST"

echo "✓ $DST 생성 완료 — 모든 ADMIN_TOKEN 을 강한 무작위 값으로 채웠습니다."
echo "  남은 작업: DESKCLOUD_DOMAIN / WEB_ORIGIN / (선택) *_DATABASE_URL 검토."
echo "  토큰 확인:  grep ADMIN_TOKEN $DST"
