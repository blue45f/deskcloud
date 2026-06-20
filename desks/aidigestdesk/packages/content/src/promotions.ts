// LLM 할인·혜택 데이터 계약.
//
// 상용 LLM의 학생/교육 혜택, 무료 크레딧, API 가격 인하, 구독 할인, 배치/캐싱
// 절감, 국내 전용 프로모션을 구조화한다. 모든 항목은 공식 확인 링크(`url`)와
// 등록된 출처(`sourceIds`)를 가지며, `runContentAudit()`가 출처 참조를 검증한다.
//
// 국내 사용자 편의를 위해 `region`과 `koreanNote`로 한국에서의 적용 방법을
// 명시하고, `audience`로 학생·개인·팀·스타트업 대상을 분리한다.

import type { ProviderId } from "./catalog";

export type DealType =
  | "정부지원사업"
  | "학생/교육"
  | "무료 크레딧"
  | "API 가격 인하"
  | "구독 할인"
  | "배치/캐싱 절감"
  | "국내 혜택";

export type DealAudience = "학생" | "개인" | "팀/조직" | "스타트업" | "전체";

export type DealRegion = "국내" | "글로벌" | "북미" | "아시아";

/** 스냅샷 날짜와 비교해 산출하는 진행 상태. */
export type DealStatus = "진행중" | "진행예정" | "종료" | "상시";

export type DealPeriod = {
  /** ISO yyyy-mm-dd. 상시 혜택이면 생략하고 alwaysOn=true. */
  start?: string;
  end?: string;
  alwaysOn?: boolean;
};

export type LlmDeal = {
  id: string;
  provider: ProviderId | "market";
  providerName: string;
  dealType: DealType;
  audience: DealAudience;
  region: DealRegion;
  title: string;
  /** 한 줄 요약 — 카드 본문. */
  summary: string;
  /** 혜택 규모를 압축한 배지 문구. 예: "최대 75% 할인", "학생 무료". */
  discountLabel: string;
  period: DealPeriod;
  /** 자격 요건(국내 기준으로 작성). */
  eligibility: string;
  /** 받는 방법 한 줄. */
  howToClaim: string;
  /** 국내 적용 시 주의/팁. 없으면 생략. */
  koreanNote?: string;
  /** 공식 확인 링크. */
  url: string;
  sourceIds: string[];
  tags: string[];
  /** 최신성 표기 — 카드의 "확인일". */
  lastVerified: string;
};

const VERIFIED = "2026-06-18";

export const llmDeals: LlmDeal[] = [
  {
    id: "deal-openai-academy",
    provider: "openai",
    providerName: "OpenAI",
    dealType: "학생/교육",
    audience: "학생",
    region: "글로벌",
    title: "OpenAI Academy · 무료 학습 + ChatGPT Edu",
    summary:
      "OpenAI Academy의 무료 강의/실습과 교육기관용 ChatGPT Edu로 학생·교육자가 정식 도구를 비용 없이 학습합니다.",
    discountLabel: "무료 학습",
    period: { alwaysOn: true },
    eligibility: "전 세계 학습자 누구나(Academy). ChatGPT Edu는 대학·교육기관 단위 도입.",
    howToClaim: "OpenAI Academy 가입 후 강의 수강. 기관은 영업팀 통해 Edu 도입.",
    koreanNote: "Academy는 한국에서 바로 접속 가능. ChatGPT Edu는 소속 대학 IT부서에 도입 문의 필요.",
    url: "https://academy.openai.com/",
    sourceIds: ["openai-academy-events"],
    tags: ["학생", "교육", "무료", "ChatGPT"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-openai-batch",
    provider: "openai",
    providerName: "OpenAI",
    dealType: "배치/캐싱 절감",
    audience: "개인",
    region: "글로벌",
    title: "OpenAI Batch API · 50% 할인 + 프롬프트 캐싱",
    summary:
      "비실시간 작업을 Batch API로 보내면 입·출력 단가가 50% 저렴하고, 반복 프롬프트는 캐싱으로 추가 절감됩니다.",
    discountLabel: "최대 50% 절감",
    period: { alwaysOn: true },
    eligibility: "API 사용자 전체. 24시간 내 완료 허용 작업에 적합.",
    howToClaim: "`/v1/batches` 엔드포인트로 작업 제출. 캐싱은 동일 prefix 반복 시 자동.",
    koreanNote: "대량 분류·요약·임베딩 파이프라인에 바로 적용. 실시간 응답이 필요 없는 국내 백오피스 자동화에 유효.",
    url: "https://platform.openai.com/docs/guides/batch",
    sourceIds: ["openai-batch-api", "openai-cost-optimization"],
    tags: ["배치", "캐싱", "비용", "API"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-anthropic-education",
    provider: "anthropic",
    providerName: "Anthropic",
    dealType: "학생/교육",
    audience: "학생",
    region: "글로벌",
    title: "Claude for Education · 캠퍼스 프로그램",
    summary:
      "대학 단위로 Claude를 도입하는 교육 프로그램과 학생 앰배서더(Claude Campus) 트랙을 운영합니다.",
    discountLabel: "교육기관 혜택",
    period: { alwaysOn: true },
    eligibility: "참여 대학 소속 학생·교직원. 앰배서더는 개별 모집.",
    howToClaim: "대학의 Claude for Education 도입 여부 확인 또는 앰배서더 지원.",
    koreanNote: "국내 대학은 아직 도입 초기 단계 — 소속 기관 도입 현황을 먼저 확인하세요.",
    url: "https://www.anthropic.com/education",
    sourceIds: ["anthropic-claude-corps"],
    tags: ["학생", "교육", "Claude", "캠퍼스"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-anthropic-caching",
    provider: "anthropic",
    providerName: "Anthropic",
    dealType: "배치/캐싱 절감",
    audience: "개인",
    region: "글로벌",
    title: "Claude 프롬프트 캐싱 + Batch · 최대 90% 절감",
    summary:
      "캐시된 입력 토큰은 최대 90% 저렴하고, Message Batches API는 입·출력 단가를 50% 낮춥니다.",
    discountLabel: "캐시 -90% / 배치 -50%",
    period: { alwaysOn: true },
    eligibility: "Anthropic API 사용자 전체.",
    howToClaim: "긴 시스템 프롬프트에 cache_control 지정, 대량 작업은 Batches API 사용.",
    koreanNote: "긴 한국어 가이드라인·약관을 시스템 프롬프트로 고정하는 워크플로에서 절감 폭이 큽니다.",
    url: "https://www.anthropic.com/pricing",
    sourceIds: ["anthropic-pricing"],
    tags: ["캐싱", "배치", "비용", "Claude"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-google-students",
    provider: "google",
    providerName: "Google",
    dealType: "학생/교육",
    audience: "학생",
    region: "글로벌",
    title: "Google AI Pro · 대학생 무료 플랜",
    summary:
      "자격을 갖춘 대학생에게 Gemini 고급 기능이 포함된 Google AI Pro 플랜을 일정 기간 무료로 제공합니다.",
    discountLabel: "학생 무료",
    period: { alwaysOn: true },
    eligibility: "만 18세 이상 재학 중인 대학생(국가별 제공 여부 상이).",
    howToClaim: "Google One/AI Pro 학생 페이지에서 재학 인증 후 등록.",
    koreanNote: "국가별 제공 범위가 달라 한국 계정에서 자격/제공 여부를 먼저 확인하세요.",
    url: "https://gemini.google/students/",
    sourceIds: ["google-gemini-students"],
    tags: ["학생", "무료", "Gemini"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-google-aistudio-free",
    provider: "google",
    providerName: "Google",
    dealType: "무료 크레딧",
    audience: "개인",
    region: "글로벌",
    title: "Google AI Studio · 무료 등급 + 컨텍스트 캐싱",
    summary:
      "AI Studio에서 무료 등급으로 Gemini API를 테스트하고, 컨텍스트 캐싱으로 반복 입력 비용을 낮춥니다.",
    discountLabel: "무료 등급",
    period: { alwaysOn: true },
    eligibility: "Google 계정 보유자. 무료 등급은 속도/쿼터 제한 존재.",
    howToClaim: "AI Studio에서 API 키 발급 후 무료 등급으로 시작.",
    koreanNote: "한국어 문서가 제공되어 진입 장벽이 낮습니다. 프로덕션은 유료 등급으로 전환 필요.",
    url: "https://ai.google.dev/pricing",
    sourceIds: ["google-gemini-pricing", "google-gemini-docs-ko"],
    tags: ["무료", "크레딧", "캐싱", "Gemini"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-deepseek-offpeak",
    provider: "deepseek",
    providerName: "DeepSeek",
    dealType: "API 가격 인하",
    audience: "개인",
    region: "글로벌",
    title: "DeepSeek 오프피크 할인 · 최대 75%",
    summary:
      "UTC 기준 오프피크 시간대(16:30–00:30)에 API 요청 단가를 모델에 따라 50–75% 할인합니다.",
    discountLabel: "최대 75% 할인",
    period: { alwaysOn: true },
    eligibility: "DeepSeek API 사용자 전체. 오프피크 시간대 요청에 자동 적용.",
    howToClaim: "오프피크 시간대에 요청 — 별도 신청 불필요.",
    koreanNote: "UTC 16:30–00:30은 한국시간(KST) 익일 01:30–09:30. 야간 배치 작업에 유리합니다.",
    url: "https://api-docs.deepseek.com/quick_start/pricing",
    sourceIds: ["deepseek-pricing"],
    tags: ["가격인하", "오프피크", "비용", "DeepSeek"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-qwen-free-quota",
    provider: "qwen",
    providerName: "Alibaba Qwen",
    dealType: "무료 크레딧",
    audience: "개인",
    region: "아시아",
    title: "Alibaba Model Studio · 신규 무료 토큰",
    summary:
      "Model Studio 신규 사용자에게 Qwen 모델별 무료 토큰 쿼터를 활성화 후 일정 기간 제공합니다.",
    discountLabel: "신규 무료 토큰",
    period: { alwaysOn: true },
    eligibility: "Alibaba Cloud 신규 가입자. 모델별 무료 한도 상이.",
    howToClaim: "Model Studio 활성화 시 무료 쿼터 자동 부여.",
    koreanNote: "국제(Singapore) 리전 기준 안내. 결제수단 등록 및 본인확인이 필요할 수 있습니다.",
    url: "https://www.alibabacloud.com/help/en/model-studio/billing-for-model-studio",
    sourceIds: ["qwen-billing"],
    tags: ["무료", "크레딧", "Qwen"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-mistral-free-tier",
    provider: "mistral",
    providerName: "Mistral",
    dealType: "무료 크레딧",
    audience: "개인",
    region: "글로벌",
    title: "Mistral La Plateforme · 무료 실험 등급",
    summary:
      "La Plateforme의 무료 실험 등급과 Le Chat 무료 사용으로 비용 없이 Mistral 모델을 평가합니다.",
    discountLabel: "무료 등급",
    period: { alwaysOn: true },
    eligibility: "Mistral 계정 보유자. 무료 등급은 속도 제한 존재.",
    howToClaim: "La Plateforme에서 무료 등급 활성화 후 API 키 발급.",
    koreanNote: "EU 기반 서비스로 데이터 처리 위치를 중시하는 국내 팀에 선택지가 됩니다.",
    url: "https://mistral.ai/pricing",
    sourceIds: ["mistral-pricing"],
    tags: ["무료", "크레딧", "Mistral"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-cursor-students",
    provider: "cursor",
    providerName: "Cursor",
    dealType: "학생/교육",
    audience: "학생",
    region: "글로벌",
    title: "Cursor for Students · Pro 1년 무료",
    summary:
      "재학 인증을 마친 학생에게 Cursor Pro를 1년간 무료로 제공합니다.",
    discountLabel: "학생 1년 무료",
    period: { alwaysOn: true },
    eligibility: "인증 가능한 재학생.",
    howToClaim: "Cursor 학생 페이지에서 학교 이메일/재학 증빙으로 인증.",
    koreanNote: "ac.kr 학교 이메일로 인증이 가능한 경우가 많습니다. 인증 실패 시 SheerID 증빙으로 재시도.",
    url: "https://cursor.com/students",
    sourceIds: ["cursor-students", "cursor-pricing"],
    tags: ["학생", "무료", "Cursor", "IDE"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-github-copilot-free",
    provider: "market",
    providerName: "GitHub",
    dealType: "구독 할인",
    audience: "개인",
    region: "글로벌",
    title: "GitHub Copilot Free · 무료 등급",
    summary:
      "모든 GitHub 계정에서 월간 한도 내 코드 완성·채팅을 쓸 수 있는 Copilot Free 등급을 제공합니다.",
    discountLabel: "무료 등급",
    period: { alwaysOn: true },
    eligibility: "GitHub 계정 보유자. 월간 완성/채팅 횟수 제한.",
    howToClaim: "GitHub에서 Copilot Free 활성화 — 결제수단 불필요.",
    koreanNote: "한국어 문서가 제공됩니다. 한도 초과 시 Pro로 업그레이드하거나 학생 무료 자격을 확인하세요.",
    url: "https://github.com/features/copilot/plans",
    sourceIds: ["github-copilot-plans", "github-copilot-plans-ko"],
    tags: ["무료", "구독", "Copilot"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-github-education",
    provider: "market",
    providerName: "GitHub Education",
    dealType: "학생/교육",
    audience: "학생",
    region: "글로벌",
    title: "GitHub Student Pack · Copilot Pro 무료",
    summary:
      "학생 개발자 팩 인증 시 Copilot Pro를 비롯한 다수 개발 도구를 무료로 사용합니다.",
    discountLabel: "학생 Pro 무료",
    period: { alwaysOn: true },
    eligibility: "재학 인증을 마친 학생.",
    howToClaim: "GitHub Education에서 학생 팩 신청 후 재학 증빙 제출.",
    koreanNote: "국내 학교 이메일/재학증명서로 인증 가능. 인증 후 Copilot Pro가 자동 적용됩니다.",
    url: "https://education.github.com/pack",
    sourceIds: ["github-education-pack", "jetbrains-student-pack"],
    tags: ["학생", "무료", "Copilot", "팩"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-gemini-code-assist-free",
    provider: "google",
    providerName: "Google",
    dealType: "구독 할인",
    audience: "개인",
    region: "글로벌",
    title: "Gemini Code Assist · 개인 무료 등급",
    summary:
      "개인 개발자용 Gemini Code Assist 무료 등급으로 IDE 코드 완성·채팅을 비용 없이 사용합니다.",
    discountLabel: "무료 등급",
    period: { alwaysOn: true },
    eligibility: "개인 Google 계정. 무료 등급 한도 내 사용.",
    howToClaim: "VS Code/JetBrains에 Gemini Code Assist 확장 설치 후 로그인.",
    koreanNote: "한국어 안내 문서가 제공되어 설정이 쉽습니다.",
    url: "https://codeassist.google/",
    sourceIds: ["gemini-code-assist-ko"],
    tags: ["무료", "구독", "Gemini", "IDE"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-upstage-credit",
    provider: "market",
    providerName: "Upstage",
    dealType: "국내 혜택",
    audience: "스타트업",
    region: "국내",
    title: "Upstage Solar · 신규 API 크레딧",
    summary:
      "국내 LLM 제공사 Upstage가 Solar API 신규 가입자에게 평가용 크레딧을 제공합니다.",
    discountLabel: "신규 크레딧",
    period: { alwaysOn: true },
    eligibility: "Upstage Console 신규 가입자.",
    howToClaim: "Console 가입 시 평가 크레딧 부여 — 콘솔에서 잔액 확인.",
    koreanNote: "한국어 문서·국내 결제 지원. 한국어 문서 처리(Document AI) 결합 시 강점이 큽니다.",
    url: "https://www.upstage.ai/products/solar-pro",
    sourceIds: ["upstage-pricing-api", "upstage-docs"],
    tags: ["국내", "크레딧", "Upstage", "Solar"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-naver-clova-trial",
    provider: "market",
    providerName: "NAVER Cloud",
    dealType: "국내 혜택",
    audience: "팀/조직",
    region: "국내",
    title: "CLOVA Studio · 무료 체험 크레딧",
    summary:
      "네이버클라우드 CLOVA Studio가 HyperCLOVA X 기반 서비스의 무료 체험 크레딧을 제공합니다.",
    discountLabel: "무료 체험",
    period: { alwaysOn: true },
    eligibility: "네이버클라우드 플랫폼 가입자. 체험 한도 내 사용.",
    howToClaim: "네이버클라우드 콘솔에서 CLOVA Studio 신청 후 체험 크레딧 사용.",
    koreanNote: "국내 데이터센터·한국어 특화 모델. 공공/금융 등 국내 규제 환경에 적합합니다.",
    url: "https://www.ncloud.com/product/aiService/clovaStudio",
    sourceIds: ["ncloud-clova-studio-product", "naver-cloud-blog"],
    tags: ["국내", "무료체험", "CLOVA", "HyperCLOVA"],
    lastVerified: VERIFIED,
  },
  {
    id: "deal-gov-bizinfo-ai-support-hub",
    provider: "market",
    providerName: "기업마당",
    dealType: "정부지원사업",
    audience: "전체",
    region: "국내",
    title: "기업마당 AI/AX 정부지원사업 모니터링",
    summary:
      "중소벤처기업부 기업마당에서 AI, AX, 온디바이스 AI, 딥테크, 제조혁신 관련 최신 정부지원사업 공고를 통합 확인합니다.",
    discountLabel: "공고 1,571건",
    period: { alwaysOn: true },
    eligibility: "중소기업, 스타트업, 예비창업자, 지역 기업 등 공고별 상이.",
    howToClaim: "기업마당에서 AI/AX/딥테크 키워드로 검색 후 해당 공고의 주관기관 시스템에서 신청.",
    koreanNote:
      "공고별 접수기간이 짧으므로 마감임박 필터와 지역/부처 필터를 함께 확인하세요. 2026-06-19 기준 온디바이스 AI, 스마트그린 AX, 첨단로봇ㆍAI 활용 제조혁신 공고가 노출됩니다.",
    url: "https://www.bizinfo.go.kr/",
    sourceIds: ["bizinfo-2026-support"],
    tags: ["정부지원사업", "AI", "AX", "중소기업", "스타트업"],
    lastVerified: "2026-06-19",
  },
  {
    id: "deal-gov-gwangju-ondevice-ai-scaleup",
    provider: "market",
    providerName: "기업마당",
    dealType: "정부지원사업",
    audience: "스타트업",
    region: "국내",
    title: "광주 온디바이스 AI 스케일업 밸리 성장스케일업",
    summary:
      "차세대 지능형 반도체 적용 온디바이스 AI 스케일업 밸리 육성사업의 성장스케일업 수혜기업 추가모집 공고입니다.",
    discountLabel: "AI 스케일업",
    period: { start: "2026-06-17", end: "2026-07-01" },
    eligibility: "광주 차세대 지능형 반도체/온디바이스 AI 관련 수혜기업. 세부 요건은 공고 확인.",
    howToClaim: "기업마당 공고에서 주관기관, 신청서류, 접수 시스템을 확인해 기한 내 제출.",
    koreanNote:
      "온디바이스 AI, 반도체, 엣지 모델 PoC 기업은 모델 경량화·데이터·시제품 계획을 함께 준비하세요.",
    url: "https://www.bizinfo.go.kr/",
    sourceIds: ["bizinfo-2026-support"],
    tags: ["정부지원사업", "온디바이스 AI", "광주", "딥테크", "반도체"],
    lastVerified: "2026-06-19",
  },
  {
    id: "deal-gov-jeonnam-robot-ai-manufacturing",
    provider: "market",
    providerName: "기업마당",
    dealType: "정부지원사업",
    audience: "팀/조직",
    region: "국내",
    title: "전남 첨단로봇ㆍAI 활용 제조혁신 기획 컨설팅",
    summary:
      "전남 지역 중소기업을 대상으로 첨단로봇과 AI를 활용한 제조혁신 사업 기업지원 기획 컨설팅을 모집합니다.",
    discountLabel: "AI 제조혁신",
    period: { start: "2026-06-17", end: "2026-07-10" },
    eligibility: "전남 제조 중소기업 등 지역/업종 요건 충족 기업. 세부 요건은 공고 확인.",
    howToClaim: "기업마당 공고의 신청서와 사업계획서 양식에 제조공정 AI 활용 계획을 작성해 제출.",
    koreanNote:
      "로봇 비전, 예지보전, 품질검사, 공정 자동화 LLM/멀티모달 적용 기업이 우선 검토할 만합니다.",
    url: "https://www.bizinfo.go.kr/",
    sourceIds: ["bizinfo-2026-support"],
    tags: ["정부지원사업", "첨단로봇 AI 제조혁신", "제조AI", "전남", "로봇", "컨설팅"],
    lastVerified: "2026-06-19",
  },
  {
    id: "deal-gov-deeptech-startup-college",
    provider: "market",
    providerName: "K-Startup",
    dealType: "정부지원사업",
    audience: "스타트업",
    region: "국내",
    title: "딥테크 특화 창업중심대학 창업기업 모집",
    summary:
      "딥테크 특화 창업중심대학을 통해 AI, 로봇, 반도체, 바이오 등 고기술 창업기업을 모집하는 정부 창업지원 트랙입니다.",
    discountLabel: "딥테크 창업",
    period: { start: "2026-06-19", end: "2026-07-08" },
    eligibility: "딥테크 분야 창업기업. 업력, 분야, 대학/주관기관별 요건은 공고 확인.",
    howToClaim: "K-Startup 또는 기업마당 공고에서 주관 대학과 신청 요건을 확인한 뒤 온라인 신청.",
    koreanNote:
      "AI 모델/API 기반 서비스도 기술성, 시장성, 데이터/보안 계획을 명확히 써야 평가 대응이 쉽습니다.",
    url: "https://www.k-startup.go.kr/",
    sourceIds: ["bizinfo-2026-support", "kstartup-portal"],
    tags: ["정부지원사업", "딥테크", "창업", "AI 스타트업", "K-Startup"],
    lastVerified: "2026-06-19",
  },
  {
    id: "deal-gov-aihub-public-datasets",
    provider: "market",
    providerName: "AI-Hub",
    dealType: "정부지원사업",
    audience: "전체",
    region: "국내",
    title: "AI-Hub 공공 AI 학습데이터 활용",
    summary:
      "AI-Hub에서 한국어, 멀티모달, 로봇·피지컬AI, 헬스케어, 제조, 법률, 금융 등 공공 AI 학습데이터와 리더보드를 제공합니다.",
    discountLabel: "공공 데이터",
    period: { alwaysOn: true },
    eligibility: "AI-Hub 회원 및 데이터별 이용정책 준수 사용자.",
    howToClaim: "AI-Hub 회원가입 후 필요한 데이터셋, API, 안심존 이용 정책을 확인하고 다운로드/활용 신청.",
    koreanNote:
      "LLM/RAG 평가용 한국어 데이터와 공공 민원 상담 LLM 데이터, 멀티모달 데이터 후보를 먼저 검색하세요.",
    url: "https://www.aihub.or.kr/",
    sourceIds: ["aihub"],
    tags: ["정부지원사업", "공공데이터", "한국어 데이터", "LLM", "RAG"],
    lastVerified: "2026-06-19",
  },
  {
    id: "deal-xai-free-credits",
    provider: "xai",
    providerName: "xAI",
    dealType: "무료 크레딧",
    audience: "개인",
    region: "글로벌",
    title: "xAI · 데이터 공유 시 월 무료 크레딧",
    summary:
      "데이터 공유 프로그램에 동의한 개발자에게 매달 일정액의 무료 API 크레딧을 제공합니다.",
    discountLabel: "월 무료 크레딧",
    period: { alwaysOn: true },
    eligibility: "xAI 콘솔 사용자 중 데이터 공유 동의 계정.",
    howToClaim: "xAI 콘솔의 결제 설정에서 데이터 공유를 활성화.",
    koreanNote: "데이터 공유 동의가 전제 — 민감 데이터를 다루는 국내 팀은 정책을 먼저 검토하세요.",
    url: "https://docs.x.ai/docs/overview",
    sourceIds: ["xai-pricing"],
    tags: ["무료", "크레딧", "Grok", "xAI"],
    lastVerified: VERIFIED,
  },
];

const DEAL_TYPE_ORDER: DealType[] = [
  "정부지원사업",
  "국내 혜택",
  "학생/교육",
  "무료 크레딧",
  "API 가격 인하",
  "배치/캐싱 절감",
  "구독 할인",
];

export function getDealStatus(deal: LlmDeal, today: string): DealStatus {
  const { start, end, alwaysOn } = deal.period;
  if (alwaysOn || (!start && !end)) return "상시";
  if (start && today < start) return "진행예정";
  if (end && today > end) return "종료";
  return "진행중";
}

export type DealTypeFilter = DealType | "all";
export type DealRegionFilter = DealRegion | "all";
export type DealAudienceFilter = DealAudience | "all";
export type DealSortMode = "recommended" | "type" | "provider" | "verified";

function dealTypeRank(type: DealType) {
  const index = DEAL_TYPE_ORDER.indexOf(type);
  return index === -1 ? DEAL_TYPE_ORDER.length : index;
}

/** 국내 혜택 우선, 그 다음 유형 순서 — 국내 사용자에게 유용한 기본 정렬. */
export function sortDeals(
  deals: readonly LlmDeal[],
  mode: DealSortMode = "recommended",
  direction: "asc" | "desc" = "asc",
): LlmDeal[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...deals].toSorted((a, b) => {
    switch (mode) {
      case "type":
        return (dealTypeRank(a.dealType) - dealTypeRank(b.dealType)) * factor;
      case "provider":
        return a.providerName.localeCompare(b.providerName, "ko-KR") * factor;
      case "verified":
        return a.lastVerified.localeCompare(b.lastVerified) * factor;
      case "recommended":
      default: {
        const domestic = Number(b.region === "국내") - Number(a.region === "국내");
        if (domestic !== 0) return domestic;
        return dealTypeRank(a.dealType) - dealTypeRank(b.dealType);
      }
    }
  });
}

export function getDealStats() {
  return {
    total: llmDeals.length,
    domestic: llmDeals.filter((deal) => deal.region === "국내").length,
    student: llmDeals.filter((deal) => deal.dealType === "학생/교육").length,
    freeCredit: llmDeals.filter((deal) => deal.dealType === "무료 크레딧").length,
    types: new Set(llmDeals.map((deal) => deal.dealType)).size,
    providers: new Set(llmDeals.map((deal) => deal.providerName)).size,
  };
}
