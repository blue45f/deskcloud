# deploy/oci — TermsDesk 운영 배포 (OCI Always-Free ARM)

단일 VM에서 **Caddy(자동 HTTPS) → web(nginx) → api → postgres** 를 Docker Compose 로 띄웁니다. 데이터가 자체 인프라를 벗어나지 않는 self-hosted 운영 구성입니다.

## 구성

```
[브라우저] ──https──▶ Caddy :443  (Let's Encrypt 자동 발급)
                         │ reverse_proxy
                         ▼
                      web :80  (nginx, SPA + /api 프록시)
                         │ /api
                         ▼
                      api :4070 (NestJS)
                         │
                         ▼
                      db  :5432 (Postgres 16, 볼륨 pgdata)
```

## 1) 인프라 (OCI Always-Free)

- Ampere A1(arm64) VM 생성. `cloud-init.yaml` 을 인스턴스의 cloud-init 으로 주입(Docker 설치 + repo clone + 80/443 iptables 허용).
- **OCI 콘솔 → 인스턴스 VCN의 Security List/NSG 에서 80·443 인바운드 허용** (iptables만으로는 부족).
- 도메인 A 레코드 → VM 공인 IP.

## 2) 배포

```bash
cd /opt/termsdesk/deploy/oci
cp .env.example .env        # DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, JWT_SECRET, 관리자 채우기
docker compose up -d --build
```

- 첫 부팅 시 마이그레이션 적용 + 관리자 계정 시드(데모 정책은 `TERMSDESK_SEED_DEMO=false` 로 끔).
- `https://$DOMAIN` 접속 → `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 로 로그인.

## 3) 운영

```bash
docker compose logs -f api          # 로그
docker compose pull && docker compose up -d --build   # 업데이트
docker compose exec db pg_dump -U termsdesk termsdesk > backup.sql   # 백업
```

> OCI 프로비저닝(인스턴스 생성/OCI CLI)은 사용자 OCI 계정·인증이 필요합니다. 위 패키지는
> 빌드·로컬 검증까지 끝난 상태이며, 실제 VM 기동만 남습니다.
