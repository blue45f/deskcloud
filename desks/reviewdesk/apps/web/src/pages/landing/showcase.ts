/**
 * 랜딩 후기 월(testimonial wall)·증명 지표용 정적 쇼케이스 데이터.
 *
 * 실제 테넌트 데이터가 아니라 **랜딩 마케팅 카피**다(외부 API 호출 없음 → 빠르고 안정적).
 * 톤·문체는 실제 ReviewDesk 사용 시나리오(임베드/검수/멀티테넌트)를 반영한다.
 */
export interface ShowcaseTestimonial {
  quote: string
  author: string
  role: string
  rating: 1 | 2 | 3 | 4 | 5
}

export const SHOWCASE_TESTIMONIALS: readonly ShowcaseTestimonial[] = [
  {
    quote:
      '스크립트 한 줄 붙였더니 제품 페이지에 별점 배지가 바로 떴어요. 디자인도 우리 톤에 녹아듭니다.',
    author: '김서연',
    role: 'SaaS 프로덕트 리드',
    rating: 5,
  },
  {
    quote:
      '검수 큐가 직관적이라 대기 리뷰를 승인·추천·답글까지 1분이면 끝냅니다. 운영 부담이 확 줄었어요.',
    author: 'Daniel P.',
    role: '커머스 CX 매니저',
    rating: 5,
  },
  {
    quote:
      'publishable/secret 키 구분이 명확해서 프런트에 키를 노출해도 안심이 됩니다. 온보딩이 깔끔해요.',
    author: '이도현',
    role: '프런트엔드 엔지니어',
    rating: 5,
  },
  {
    quote:
      'PGlite 폴백 덕분에 DB 세팅 없이 바로 셀프호스팅으로 띄워 봤습니다. 그대로 Postgres 전환도 했고요.',
    author: 'Mina R.',
    role: '인디 메이커',
    rating: 4,
  },
  {
    quote:
      'subject 별 평균 별점·분포가 배지와 대시보드에서 똑같이 보여서 숫자가 어긋날 걱정이 없습니다.',
    author: '박지우',
    role: '그로스 마케터',
    rating: 5,
  },
  {
    quote:
      '후기 월 위젯을 랜딩에 깔았더니 전환율이 눈에 띄게 올랐어요. 추천 후기만 골라 노출하는 게 핵심.',
    author: 'Sophie L.',
    role: '스타트업 대표',
    rating: 5,
  },
  {
    quote:
      '멀티테넌트라 여러 제품의 리뷰를 한 콘솔에서 나눠 관리합니다. CORS 허용목록까지 테넌트별로 분리돼요.',
    author: '정민재',
    role: '플랫폼 운영자',
    rating: 5,
  },
  {
    quote:
      'reduced-motion·포커스 링까지 챙겨진 위젯이라 접근성 리뷰를 그냥 통과했습니다. 디테일이 좋네요.',
    author: 'Aria K.',
    role: '디자인 시스템 오너',
    rating: 5,
  },
] as const

export interface ProofStat {
  /** 표시 값(애니메이션 카운트업의 목표). */
  value: number
  /** 값 뒤 접미사(%, k, + 등). */
  suffix?: string
  /** 소수 자리수. */
  decimals?: number
  label: string
}

export const PROOF_STATS: readonly ProofStat[] = [
  { value: 4, suffix: '종', label: '임베드 위젯' },
  { value: 1, label: '줄이면 임베드' },
  { value: 4.9, decimals: 1, label: '평균 만족도' },
  { value: 0, suffix: '개', label: 'CSS 의존성' },
] as const

/** 히어로 미니 별점 분포(시각적 사회적 증거 — 1~5점 비율, 합 100). */
export const SHOWCASE_DISTRIBUTION: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = {
  5: 78,
  4: 16,
  3: 4,
  2: 1,
  1: 1,
}
