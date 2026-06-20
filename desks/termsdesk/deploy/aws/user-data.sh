#!/bin/bash
# ─── TermsDesk 턴키 EC2 부팅 스크립트 (Ubuntu 24.04, amd64) ───────────────────
# EC2 시작 시 "사용자 데이터(user data)"에 붙여넣으면 부팅 한 번에:
#   Docker 설치 → 비공개 repo clone(배포키) → .env 자동 생성(공인IP nip.io 도메인 +
#   무작위 시크릿) → docker compose up → Caddy 자동 HTTPS 까지 완료됩니다.
#
# 붙여넣기 전 아래 3개만 채우세요 (나머지는 자동):
ADMIN_EMAIL="admin@your-company.com"
ADMIN_PASSWORD="CHANGE_ME_strong_password"
# Let's Encrypt 인증서 발급용 연락 이메일 — 반드시 실제 TLD(.com 등).
# `.local` 같은 비공인 TLD 는 LE/ZeroSSL 이 거부해 HTTPS 발급이 실패합니다.
ACME_EMAIL="you@example.com"
# 읽기전용 GitHub 배포키(개인키)를 base64 한 값.  로컬에서:
#   ssh-keygen -t ed25519 -f td_deploy -N "" -C "termsdesk-aws"
#   gh repo deploy-key add td_deploy.pub --title termsdesk-aws   (또는 GitHub UI)
#   base64 -i td_deploy        ← 이 출력을 아래에 붙여넣기
DEPLOY_KEY_B64="__BASE64_OF_READONLY_DEPLOY_PRIVATE_KEY__"
# ─────────────────────────────────────────────────────────────────────────────
set -euxo pipefail
exec > /var/log/termsdesk-deploy.log 2>&1
echo "[termsdesk] boot $(date -u)"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git ca-certificates curl openssl

# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# t3.micro(1GB RAM) 등 저사양에서 docker build OOM 방지용 스왑 2GB
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 비공개 repo clone 용 배포키
install -d -m 700 /root/.ssh
echo "$DEPLOY_KEY_B64" | base64 -d > /root/.ssh/id_deploy
chmod 600 /root/.ssh/id_deploy
cat > /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/id_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF

git clone git@github.com:blue45f/termsdesk.git /opt/termsdesk
cd /opt/termsdesk/deploy/aws

# IMDSv2 로 공인 IP 조회 → nip.io 도메인(별도 DNS 불필요, Caddy 가 그 도메인으로 인증서 발급)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

cat > .env <<EOF
DOMAIN=${IP}.nip.io
ACME_EMAIL=${ACME_EMAIL}
POSTGRES_USER=termsdesk
POSTGRES_DB=termsdesk
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
SEED_ADMIN_EMAIL=${ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

docker compose up -d --build
echo "[termsdesk] done → https://${IP}.nip.io  (admin: ${ADMIN_EMAIL})"
