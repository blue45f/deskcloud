# deploy/aws — TermsDesk 운영 배포 (AWS EC2)

OCI 구성과 **동일한 스택**(Caddy 자동 HTTPS → web nginx → api → postgres, Docker Compose)을
AWS EC2 단일 인스턴스에 올립니다. 차이는 부팅 스크립트(`user-data.sh`)와 보안그룹(Security
Group)뿐입니다. 데이터는 인스턴스를 벗어나지 않습니다(self-hosted).

```
[브라우저] ──https──▶ Caddy :443 (Let's Encrypt 자동) ─▶ web :80 (nginx) ─▶ api :4070 ─▶ db :5432
```

## 0) 사전 준비 — 비공개 repo 배포키 (1회)

EC2가 비공개 repo를 clone 하려면 읽기전용 배포키가 필요합니다. 로컬에서:

```bash
ssh-keygen -t ed25519 -f td_deploy -N "" -C "termsdesk-aws"
gh repo deploy-key add td_deploy.pub --repo blue45f/termsdesk --title termsdesk-aws
base64 -i td_deploy        # 이 출력을 user-data.sh 의 DEPLOY_KEY_B64 에 붙여넣기
```

## 1) 인스턴스 시작 (콘솔)

EC2 → **Launch instance**

- **AMI**: Ubuntu Server 24.04 LTS (amd64)
- **Instance type**: **`t3.micro` 권장 — AWS 12개월 프리티어(750h/월 무료)**. `user-data.sh`가
  스왑 2GB를 만들어 1GB RAM에서도 빌드됩니다. 빌드를 더 빠르게 하려면 `t3.small`(유료).
- **Key pair**: SSH용 키 생성/선택
- **Network / Security group** — 인바운드 허용:
  - `22/tcp` (SSH, 내 IP만 권장)
  - `80/tcp` (HTTP→HTTPS 리다이렉트 + ACME)
  - `443/tcp` (HTTPS)
- **Storage**: 16 GB gp3 (프리티어 EBS 30GB/월 무료 한도 안)
- **Advanced details → User data**: `user-data.sh` 의 상단 3개(ADMIN_EMAIL/ADMIN_PASSWORD/
  DEPLOY_KEY_B64)를 채운 전체 내용을 붙여넣기

Launch 하면 부팅 시 자동으로 빌드·기동됩니다(약 3~5분). 진행 로그:

```bash
ssh -i <키> ubuntu@<공인IP>
sudo tail -f /var/log/termsdesk-deploy.log
```

완료되면 **`https://<공인IP>.nip.io`** 로 접속(별도 DNS 불필요), `ADMIN_EMAIL` /
`ADMIN_PASSWORD` 로 로그인.

## 1-alt) 인스턴스 시작 (AWS CLI)

```bash
SG=$(aws ec2 create-security-group --group-name termsdesk --description termsdesk \
  --query GroupId --output text)
for p in 22 80 443; do aws ec2 authorize-security-group-ingress --group-id $SG \
  --protocol tcp --port $p --cidr 0.0.0.0/0; done
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --instance-type t3.micro --security-group-ids $SG --key-name <키이름> \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=16,VolumeType=gp3}' \
  --user-data file://$HOME/termsdesk-aws-userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=termsdesk}]'
```

> `--user-data` 는 배포키·관리자 비번이 채워진 **로컬 파일**(`~/termsdesk-aws-userdata.sh`)을
> 가리킵니다. repo의 `deploy/aws/user-data.sh` 는 placeholder 템플릿(시크릿 없음)입니다.

## 2) 운영

```bash
cd /opt/termsdesk/deploy/aws
docker compose logs -f api
sudo git -C /opt/termsdesk pull && docker compose up -d --build   # 업데이트
docker compose exec db pg_dump -U termsdesk termsdesk > backup.sql # 백업
```

## 3) Vercel 연결

웹은 Vercel(무료), API는 이 EC2. 인스턴스가 뜨면 `vercel.json` 의 `/api` rewrite 를
`https://<새-공인IP>.nip.io/api/$1` 로 바꿔 커밋·푸시하세요.
**현재는 정지된 OCI IP(131.186.34.29)를 가리키고 있어 API 호출이 깨집니다 — 새 호스트 IP로 교체 필요.**

## 비용 — 최대한 적게

- **이 구성(권장)**: 웹 Vercel(무료) + API/DB `t3.micro` 단일 EC2.
  - **12개월간 $0** (프리티어: t3.micro 750h/월 + EBS 30GB). 이후 t3.micro ≈ 월 $7.5.
  - LB·RDS·NAT 안 씀(전부 한 인스턴스 + Caddy 자동 HTTPS) → 추가 과금 없음.
- **영구 $0 대안**: OCI Always-Free는 **계정 정지로 폐기됨**. 영구 무료가 꼭 필요하면
  **GCP `e2-micro` Always-Free**(us-west1/central1/east1, 1vCPU/1GB)가 같은 docker-compose 로
  동일하게 동작 — 필요 시 `deploy/aws` 를 그대로 복사해 쓰면 됩니다.
- 끄면 과금도 멈춤: 안 쓸 땐 `aws ec2 stop-instances`(EBS 보관비만 소액) 또는 terminate.
