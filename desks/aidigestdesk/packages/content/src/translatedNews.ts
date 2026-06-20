// 해외 소식 큐레이션 번역 데이터 계약.
//
// 실시간 자동 번역이 아니라, 해외 공식 블로그·매체의 주요 AI 소식을 직접 요약·
// 번역해 한국어로 제공한다. 각 항목은 원문 출처(sourceUrl)와 발행처를 명시하고
// 번역/정리 시점(translatedAt)을 표기한다. 원문 전문을 복제하지 않고 핵심만 정리한다.

import type { ProviderId } from './catalog'

export type NewsRegion = '북미' | '유럽' | '아시아' | '글로벌'

export type TranslatedArticle = {
  id: string
  /** 한국어 제목(번역/정리). */
  koTitle: string
  /** 원문 제목. */
  originalTitle: string
  publisher: string
  region: NewsRegion
  originalLanguage: string
  publishedAt: string
  translatedAt: string
  /** 한국어 요약(직접 작성). 2~3문장. */
  koSummary: string
  /** 핵심 포인트(번역·정리). */
  keyPoints: string[]
  /** 국내 관점의 함의. 선택. */
  koreanAngle?: string
  /** 공식/원문 확인 링크(안정적 허브 우선). */
  sourceUrl: string
  providerIds?: ProviderId[]
  tags: string[]
}

const TRANSLATED = '2026-06-18'

export const translatedArticles: TranslatedArticle[] = [
  {
    id: 'tn-openai-news',
    koTitle: 'OpenAI, 비용 최적화 기능과 에이전트 도구 지속 확대',
    originalTitle: 'OpenAI product and research updates',
    publisher: 'OpenAI',
    region: '북미',
    originalLanguage: '영어',
    publishedAt: '2026-06-17',
    translatedAt: TRANSLATED,
    koSummary:
      'OpenAI는 배치 API 할인과 프롬프트 캐싱 등 비용 절감 수단을 강화하고, Agents SDK 기반 도구 호출·핸드오프 워크플로를 계속 확장하고 있다. 공식 뉴스 허브에서 최신 발표를 확인할 수 있다.',
    keyPoints: [
      '비실시간 작업은 Batch API로 단가 절감',
      '반복 시스템 프롬프트는 캐싱으로 추가 절감',
      'Agents SDK로 멀티 에이전트 파이프라인 구성',
    ],
    koreanAngle: '국내 백오피스 자동화는 야간 배치 + 캐싱 조합으로 비용을 크게 낮출 수 있다.',
    sourceUrl: 'https://openai.com/news/',
    providerIds: ['openai'],
    tags: ['openai', '비용', '에이전트'],
  },
  {
    id: 'tn-anthropic-news',
    koTitle: 'Anthropic, 프롬프트 캐싱·배치로 Claude 운영비 절감 강조',
    originalTitle: 'Anthropic announcements and pricing',
    publisher: 'Anthropic',
    region: '북미',
    originalLanguage: '영어',
    publishedAt: '2026-06-16',
    translatedAt: TRANSLATED,
    koSummary:
      'Anthropic은 캐시된 입력 토큰 대폭 할인과 Message Batches API로 Claude 운영비를 낮추는 방법을 안내한다. 교육용 프로그램(Claude for Education)도 확대 중이다.',
    keyPoints: [
      '캐시 입력 토큰 최대 90% 절감',
      'Batches API 입·출력 50% 절감',
      '대학 단위 교육 프로그램 운영',
    ],
    koreanAngle: '긴 한국어 가이드라인·약관을 시스템 프롬프트로 고정하면 캐싱 절감 폭이 크다.',
    sourceUrl: 'https://www.anthropic.com/news',
    providerIds: ['anthropic'],
    tags: ['anthropic', '비용', '교육'],
  },
  {
    id: 'tn-google-ai',
    koTitle: 'Google, Gemini 학생 혜택과 AI Studio 무료 등급 확대',
    originalTitle: 'Google AI and Gemini updates',
    publisher: 'Google',
    region: '북미',
    originalLanguage: '영어',
    publishedAt: '2026-06-15',
    translatedAt: TRANSLATED,
    koSummary:
      'Google은 대학생 대상 AI Pro 무료 제공과 AI Studio 무료 등급·컨텍스트 캐싱으로 Gemini 진입 장벽을 낮추고 있다. 국가별 제공 범위는 다르다.',
    keyPoints: [
      '자격 학생에게 AI Pro 일정 기간 무료',
      'AI Studio 무료 등급으로 API 테스트',
      '컨텍스트 캐싱으로 반복 입력 절감',
    ],
    koreanAngle: '한국 계정에서 학생 혜택·제공 여부를 먼저 확인해야 한다.',
    sourceUrl: 'https://blog.google/innovation-and-ai/technology/ai/',
    providerIds: ['google'],
    tags: ['google', 'gemini', '학생'],
  },
  {
    id: 'tn-deepseek-pricing',
    koTitle: 'DeepSeek, 오프피크 시간대 API 단가 최대 75% 할인',
    originalTitle: 'DeepSeek off-peak pricing',
    publisher: 'DeepSeek',
    region: '아시아',
    originalLanguage: '영어',
    publishedAt: '2026-06-14',
    translatedAt: TRANSLATED,
    koSummary:
      'DeepSeek은 UTC 기준 오프피크 시간대(16:30–00:30) 요청에 대해 모델에 따라 50–75% 할인을 자동 적용한다. 별도 신청이 필요 없다.',
    keyPoints: [
      'UTC 16:30–00:30 자동 할인',
      '모델별 50–75% 절감',
      '신청 불필요 — 시간대만 맞추면 적용',
    ],
    koreanAngle: 'UTC 오프피크는 KST 익일 01:30–09:30. 야간 배치 작업에 최적.',
    sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    providerIds: ['deepseek'],
    tags: ['deepseek', '비용', '오프피크'],
  },
  {
    id: 'tn-mistral-eu',
    koTitle: 'Mistral, EU 기반 모델·무료 실험 등급으로 데이터 주권 강조',
    originalTitle: 'Mistral AI news',
    publisher: 'Mistral',
    region: '유럽',
    originalLanguage: '영어',
    publishedAt: '2026-06-13',
    translatedAt: TRANSLATED,
    koSummary:
      'Mistral은 La Plateforme 무료 실험 등급과 Le Chat을 제공하며, EU 기반 처리로 데이터 위치를 중시하는 조직에 선택지를 제시한다.',
    keyPoints: ['무료 실험 등급으로 모델 평가', 'Le Chat 무료 사용', 'EU 데이터 처리 강조'],
    koreanAngle: '데이터 처리 위치가 중요한 국내 공공·금융 PoC의 대안이 될 수 있다.',
    sourceUrl: 'https://mistral.ai/news/',
    providerIds: ['mistral'],
    tags: ['mistral', 'eu', '무료'],
  },
  {
    id: 'tn-eu-ai-act',
    koTitle: 'EU AI Act 단계적 시행 — 고위험 AI 의무 본격화',
    originalTitle: 'EU AI Act implementation timeline',
    publisher: 'European Commission',
    region: '유럽',
    originalLanguage: '영어',
    publishedAt: '2026-06-10',
    translatedAt: TRANSLATED,
    koSummary:
      'EU AI Act가 단계적으로 시행되며 고위험 시스템의 투명성·위험관리·문서화 의무가 강화되고 있다. 범용 AI(GPAI) 제공자에 대한 요구도 구체화된다.',
    keyPoints: [
      '위험 등급별 차등 규제',
      '고위험 시스템 문서화·투명성 의무',
      'GPAI 제공자 의무 명문화',
    ],
    koreanAngle: 'EU 사용자를 대상으로 하는 국내 서비스는 적용 범위를 점검해야 한다.',
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
    tags: ['규제', 'eu', '정책'],
  },
  {
    id: 'tn-ap-ai-hub',
    koTitle: 'AP·주요 매체, AI 거버넌스·저작권 논의 지속 보도',
    originalTitle: 'Artificial Intelligence — news hub',
    publisher: 'Associated Press',
    region: '글로벌',
    originalLanguage: '영어',
    publishedAt: '2026-06-12',
    translatedAt: TRANSLATED,
    koSummary:
      'AP의 AI 허브는 정부 감독, 저작권 분쟁, 생성형 AI의 사회적 영향 등 거버넌스 이슈를 폭넓게 다룬다. 산업 동향과 규제 흐름을 함께 추적하기 좋다.',
    keyPoints: ['정부 감독·정책 동향', '저작권·데이터 분쟁', '생성형 AI 사회 영향'],
    sourceUrl: 'https://apnews.com/hub/artificial-intelligence',
    tags: ['거버넌스', '저작권', '뉴스'],
  },
  {
    id: 'tn-arxiv-trends',
    koTitle: '연구 동향 — 추론 모델과 추론시 연산 확대',
    originalTitle: 'Recent LLM research trends (arXiv cs.CL)',
    publisher: 'arXiv',
    region: '글로벌',
    originalLanguage: '영어',
    publishedAt: '2026-06-11',
    translatedAt: TRANSLATED,
    koSummary:
      '최근 연구는 사고 사슬·추론시 연산(test-time compute)으로 수학·코딩 정확도를 높이는 방향과, MoE·증류·양자화로 효율을 끌어올리는 방향이 동시에 진행된다.',
    keyPoints: [
      '추론형 모델의 사고 길이·다중 샘플',
      'MoE로 적은 활성 연산·큰 용량',
      '증류·양자화로 경량 배포',
    ],
    koreanAngle: '용어가 어렵다면 본 포털의 AI/LLM 용어 사전을 함께 참고하세요.',
    sourceUrl: 'https://arxiv.org/list/cs.CL/recent',
    tags: ['연구', '추론', '효율'],
  },
  {
    id: 'tn-xai-grok',
    koTitle: 'xAI, Grok API 데이터 공유 시 월 무료 크레딧 제공',
    originalTitle: 'xAI developer platform updates',
    publisher: 'xAI',
    region: '북미',
    originalLanguage: '영어',
    publishedAt: '2026-06-09',
    translatedAt: TRANSLATED,
    koSummary:
      'xAI는 데이터 공유 프로그램에 동의한 개발자에게 매달 무료 API 크레딧을 제공한다. 민감 데이터를 다루는 팀은 공유 정책을 먼저 검토해야 한다.',
    keyPoints: ['데이터 공유 동의 시 월 무료 크레딧', '콘솔 결제 설정에서 활성화'],
    koreanAngle: '데이터 공유가 전제이므로 국내 규제·내부 정책과 충돌하는지 확인 필요.',
    sourceUrl: 'https://docs.x.ai/docs/overview',
    providerIds: ['xai'],
    tags: ['xai', 'grok', '무료'],
  },
]

export type NewsRegionFilter = NewsRegion | 'all'

export const newsRegions: NewsRegion[] = ['북미', '유럽', '아시아', '글로벌']

export function getTranslatedArticleSearchText(article: TranslatedArticle): string {
  return [
    article.koTitle,
    article.originalTitle,
    article.publisher,
    article.region,
    article.koSummary,
    ...article.keyPoints,
    article.koreanAngle ?? '',
    ...article.tags,
  ].join(' ')
}

export function getTranslatedNewsStats() {
  return {
    total: translatedArticles.length,
    regions: new Set(translatedArticles.map((article) => article.region)).size,
    publishers: new Set(translatedArticles.map((article) => article.publisher)).size,
  }
}
