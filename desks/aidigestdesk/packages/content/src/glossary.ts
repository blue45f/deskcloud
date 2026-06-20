// AI/LLM 용어 사전 데이터 계약.
//
// 국내 사용자가 자주 마주치는 상용 LLM·에이전트 용어를 한국어 정의와 함께
// 카테고리로 분류한다. 영어 원어(term)와 한글 표기(koName), 관련 용어(related)를
// 제공해 교차 탐색을 돕는다. 순수 데이터 — UI/검색은 앱에서 처리한다.

export type GlossaryCategory =
  | '기초'
  | '아키텍처'
  | '학습/튜닝'
  | '추론/생성'
  | '컨텍스트'
  | '평가/벤치마크'
  | '에이전트/도구'
  | '멀티모달'
  | '안전/정렬'
  | '운영/비용'

export type GlossaryTerm = {
  id: string
  term: string
  koName: string
  category: GlossaryCategory
  /** 1~2문장 한국어 정의. */
  definition: string
  /** 실무에서의 의미·주의. 선택. */
  note?: string
  related: string[]
  tags: string[]
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: 'glo-llm',
    term: 'LLM',
    koName: '대규모 언어 모델',
    category: '기초',
    definition:
      '방대한 텍스트로 학습해 다음 토큰을 예측하는 대규모 신경망. GPT·Claude·Gemini 등 상용 모델의 토대.',
    related: ['token', 'transformer', 'pretraining'],
    tags: ['기초', 'llm'],
  },
  {
    id: 'glo-token',
    term: 'Token',
    koName: '토큰',
    category: '기초',
    definition:
      '모델이 처리하는 텍스트의 최소 단위(단어 조각). 한국어는 영어보다 토큰 수가 많아 비용이 더 들 수 있다.',
    note: '입력·출력 토큰 수가 곧 API 비용이다. 한글 1글자가 1토큰 이상일 때가 많다.',
    related: ['tokenizer', 'context-window', 'pricing'],
    tags: ['기초', '비용'],
  },
  {
    id: 'glo-tokenizer',
    term: 'Tokenizer',
    koName: '토크나이저',
    category: '기초',
    definition: '텍스트를 토큰 열로 변환하는 규칙/모델. BPE 계열이 흔하다.',
    related: ['token'],
    tags: ['기초'],
  },
  {
    id: 'glo-transformer',
    term: 'Transformer',
    koName: '트랜스포머',
    category: '아키텍처',
    definition: '셀프 어텐션으로 토큰 간 관계를 학습하는 신경망 구조. 현대 LLM의 표준 백본.',
    related: ['attention', 'llm'],
    tags: ['아키텍처'],
  },
  {
    id: 'glo-attention',
    term: 'Attention',
    koName: '어텐션',
    category: '아키텍처',
    definition: '각 토큰이 다른 토큰을 얼마나 참조할지 가중치로 계산하는 메커니즘.',
    related: ['transformer'],
    tags: ['아키텍처'],
  },
  {
    id: 'glo-moe',
    term: 'MoE',
    koName: '전문가 혼합',
    category: '아키텍처',
    definition:
      'Mixture of Experts. 입력마다 일부 전문가 서브네트워크만 활성화해 적은 연산으로 큰 용량을 얻는 구조.',
    note: 'DeepSeek·Mistral 등이 채택. 총 파라미터는 크지만 활성 파라미터는 일부다.',
    related: ['transformer'],
    tags: ['아키텍처', '효율'],
  },
  {
    id: 'glo-pretraining',
    term: 'Pretraining',
    koName: '사전학습',
    category: '학습/튜닝',
    definition: '대규모 코퍼스로 다음 토큰 예측을 학습하는 1차 단계. 모델의 일반 능력을 형성한다.',
    related: ['fine-tuning', 'llm'],
    tags: ['학습'],
  },
  {
    id: 'glo-finetuning',
    term: 'Fine-tuning',
    koName: '파인튜닝',
    category: '학습/튜닝',
    definition: '사전학습 모델을 특정 도메인·작업 데이터로 추가 학습해 성능을 맞추는 과정.',
    related: ['lora', 'rlhf', 'pretraining'],
    tags: ['학습', '튜닝'],
  },
  {
    id: 'glo-lora',
    term: 'LoRA',
    koName: '저랭크 적응',
    category: '학습/튜닝',
    definition:
      'Low-Rank Adaptation. 가중치 전체 대신 작은 어댑터만 학습해 저비용으로 파인튜닝하는 기법.',
    related: ['fine-tuning', 'quantization'],
    tags: ['튜닝', '효율'],
  },
  {
    id: 'glo-rlhf',
    term: 'RLHF',
    koName: '인간 피드백 강화학습',
    category: '안전/정렬',
    definition:
      '사람 선호 데이터로 보상 모델을 만들고 강화학습으로 응답을 정렬하는 기법. 유용성·안전성 개선.',
    related: ['alignment', 'fine-tuning', 'dpo'],
    tags: ['정렬', '안전'],
  },
  {
    id: 'glo-dpo',
    term: 'DPO',
    koName: '직접 선호 최적화',
    category: '안전/정렬',
    definition:
      'Direct Preference Optimization. 보상 모델 없이 선호쌍으로 직접 정렬하는 RLHF 대안.',
    related: ['rlhf', 'alignment'],
    tags: ['정렬'],
  },
  {
    id: 'glo-alignment',
    term: 'Alignment',
    koName: '정렬',
    category: '안전/정렬',
    definition: '모델의 행동을 인간 의도·가치에 맞추는 연구/공정 전반.',
    related: ['rlhf', 'guardrail'],
    tags: ['안전'],
  },
  {
    id: 'glo-context-window',
    term: 'Context Window',
    koName: '컨텍스트 윈도우',
    category: '컨텍스트',
    definition: '모델이 한 번에 참조할 수 있는 최대 토큰 길이. 길수록 더 많은 자료를 한 번에 다룬다.',
    note: '길다고 항상 좋은 건 아니다 — 길어질수록 비용·지연이 늘고 중간 정보 손실(lost-in-the-middle)이 생길 수 있다.',
    related: ['token', 'rag', 'prompt-caching'],
    tags: ['컨텍스트'],
  },
  {
    id: 'glo-rag',
    term: 'RAG',
    koName: '검색 증강 생성',
    category: '컨텍스트',
    definition:
      'Retrieval-Augmented Generation. 외부 문서를 검색해 프롬프트에 넣어 최신·근거 있는 답을 생성하는 방식.',
    note: '환각을 줄이고 출처를 댈 수 있어 사내 문서 Q&A에 널리 쓰인다.',
    related: ['embedding', 'vector-db', 'context-window'],
    tags: ['컨텍스트', '검색'],
  },
  {
    id: 'glo-embedding',
    term: 'Embedding',
    koName: '임베딩',
    category: '컨텍스트',
    definition: '텍스트를 의미를 담은 벡터로 변환한 표현. 유사도 검색·RAG의 기반.',
    related: ['rag', 'vector-db'],
    tags: ['검색'],
  },
  {
    id: 'glo-vector-db',
    term: 'Vector DB',
    koName: '벡터 데이터베이스',
    category: '컨텍스트',
    definition: '임베딩 벡터를 저장하고 유사도로 빠르게 검색하는 데이터베이스.',
    related: ['embedding', 'rag'],
    tags: ['검색', '인프라'],
  },
  {
    id: 'glo-prompt',
    term: 'Prompt',
    koName: '프롬프트',
    category: '추론/생성',
    definition: '모델에 주는 입력 지시문. 시스템·사용자·어시스턴트 역할로 구성된다.',
    related: ['system-prompt', 'few-shot'],
    tags: ['기초'],
  },
  {
    id: 'glo-system-prompt',
    term: 'System Prompt',
    koName: '시스템 프롬프트',
    category: '추론/생성',
    definition: '모델의 역할·규칙·톤을 고정하는 상위 지시. 대화 전반에 적용된다.',
    related: ['prompt', 'prompt-caching'],
    tags: ['프롬프트'],
  },
  {
    id: 'glo-few-shot',
    term: 'Few-shot',
    koName: '퓨샷',
    category: '추론/생성',
    definition: '프롬프트에 예시 몇 개를 넣어 원하는 형식·행동을 유도하는 기법. 예시가 없으면 zero-shot.',
    related: ['prompt', 'in-context-learning'],
    tags: ['프롬프트'],
  },
  {
    id: 'glo-temperature',
    term: 'Temperature',
    koName: '온도',
    category: '추론/생성',
    definition: '출력의 무작위성 조절값. 낮으면 결정적·일관적, 높으면 다양·창의적.',
    related: ['top-p'],
    tags: ['파라미터'],
  },
  {
    id: 'glo-top-p',
    term: 'Top-p',
    koName: '뉴클리어스 샘플링',
    category: '추론/생성',
    definition: '누적 확률 p 이내의 후보에서만 샘플링해 다양성을 조절하는 방식.',
    related: ['temperature'],
    tags: ['파라미터'],
  },
  {
    id: 'glo-hallucination',
    term: 'Hallucination',
    koName: '환각',
    category: '평가/벤치마크',
    definition: '사실이 아닌 내용을 그럴듯하게 생성하는 현상. 출처 검증·RAG로 완화한다.',
    note: '본 포털이 모든 항목에 출처를 다는 이유. 모델 답은 항상 원문으로 교차 확인.',
    related: ['rag', 'grounding'],
    tags: ['평가', '신뢰'],
  },
  {
    id: 'glo-grounding',
    term: 'Grounding',
    koName: '근거화',
    category: '평가/벤치마크',
    definition: '모델 답변을 실제 출처·데이터에 연결해 검증 가능하게 만드는 것.',
    related: ['rag', 'hallucination'],
    tags: ['신뢰'],
  },
  {
    id: 'glo-cot',
    term: 'Chain-of-Thought',
    koName: '사고 사슬',
    category: '추론/생성',
    definition: '중간 추론 단계를 명시적으로 생성해 복잡한 문제 정확도를 높이는 기법. 추론형 모델의 핵심.',
    related: ['reasoning-model', 'few-shot'],
    tags: ['추론'],
  },
  {
    id: 'glo-reasoning-model',
    term: 'Reasoning Model',
    koName: '추론 모델',
    category: '추론/생성',
    definition: '답하기 전에 길게 사고(thinking)하도록 학습된 모델. 수학·코딩·계획에 강하지만 지연·비용이 크다.',
    related: ['cot', 'test-time-compute'],
    tags: ['추론'],
  },
  {
    id: 'glo-test-time-compute',
    term: 'Test-time Compute',
    koName: '추론시 연산',
    category: '추론/생성',
    definition: '추론 단계에서 더 많은 연산(긴 사고·다중 샘플)을 써서 정확도를 높이는 접근.',
    related: ['reasoning-model'],
    tags: ['추론', '비용'],
  },
  {
    id: 'glo-agent',
    term: 'Agent',
    koName: '에이전트',
    category: '에이전트/도구',
    definition: '도구 호출·계획·반복으로 목표를 자율 수행하는 LLM 시스템. 코딩 에이전트가 대표적.',
    related: ['tool-use', 'mcp', 'function-calling'],
    tags: ['에이전트'],
  },
  {
    id: 'glo-tool-use',
    term: 'Tool Use',
    koName: '도구 사용',
    category: '에이전트/도구',
    definition: '모델이 외부 함수·API·검색을 호출해 능력을 확장하는 것. function calling이라고도 한다.',
    related: ['function-calling', 'mcp', 'agent'],
    tags: ['에이전트'],
  },
  {
    id: 'glo-function-calling',
    term: 'Function Calling',
    koName: '함수 호출',
    category: '에이전트/도구',
    definition: '모델이 정해진 스키마로 함수 인자를 생성해 호출하도록 하는 기능.',
    related: ['tool-use', 'mcp'],
    tags: ['에이전트', 'api'],
  },
  {
    id: 'glo-mcp',
    term: 'MCP',
    koName: '모델 컨텍스트 프로토콜',
    category: '에이전트/도구',
    definition:
      'Model Context Protocol. 에이전트가 외부 도구·데이터 소스에 표준 방식으로 연결하는 개방 프로토콜.',
    note: '도구 확장 디렉터리의 MCP 서버 항목 참고. 한 번 연결하면 여러 클라이언트에서 재사용.',
    related: ['tool-use', 'agent'],
    tags: ['에이전트', '프로토콜'],
  },
  {
    id: 'glo-multimodal',
    term: 'Multimodal',
    koName: '멀티모달',
    category: '멀티모달',
    definition: '텍스트뿐 아니라 이미지·오디오·비디오 등 여러 양식을 함께 입력·출력하는 능력.',
    related: ['vlm'],
    tags: ['멀티모달'],
  },
  {
    id: 'glo-vlm',
    term: 'VLM',
    koName: '비전 언어 모델',
    category: '멀티모달',
    definition: '이미지와 텍스트를 함께 이해하는 모델. 문서·스크린샷 이해, OCR형 작업에 쓰인다.',
    related: ['multimodal'],
    tags: ['멀티모달'],
  },
  {
    id: 'glo-quantization',
    term: 'Quantization',
    koName: '양자화',
    category: '운영/비용',
    definition: '가중치를 낮은 정밀도(INT8/INT4 등)로 줄여 메모리·비용을 낮추는 기법. 약간의 품질 저하 가능.',
    related: ['lora', 'distillation'],
    tags: ['효율', '비용'],
  },
  {
    id: 'glo-distillation',
    term: 'Distillation',
    koName: '증류',
    category: '학습/튜닝',
    definition: '큰 교사 모델의 출력을 작은 학생 모델이 모방 학습해 경량·고속화하는 기법.',
    related: ['quantization'],
    tags: ['효율'],
  },
  {
    id: 'glo-prompt-caching',
    term: 'Prompt Caching',
    koName: '프롬프트 캐싱',
    category: '운영/비용',
    definition:
      '반복되는 프롬프트 접두부(시스템 지시 등)를 캐시해 입력 토큰 비용·지연을 크게 줄이는 기능.',
    note: '긴 한국어 가이드라인을 시스템 프롬프트로 고정하는 워크플로에서 절감 효과가 크다.',
    related: ['system-prompt', 'batch-api', 'token'],
    tags: ['비용', '운영'],
  },
  {
    id: 'glo-batch-api',
    term: 'Batch API',
    koName: '배치 API',
    category: '운영/비용',
    definition: '비실시간 작업을 모아 처리해 단가를 50% 안팎 낮추는 비동기 API.',
    related: ['prompt-caching', 'token'],
    tags: ['비용', '운영'],
  },
  {
    id: 'glo-benchmark',
    term: 'Benchmark',
    koName: '벤치마크',
    category: '평가/벤치마크',
    definition: '표준 과제 집합으로 모델 성능을 비교 측정하는 평가. 공식 스펙과 분리해 봐야 한다.',
    note: '벤치마크 점수는 평가 조건에 민감하다. 본 포털은 공식 문서 값과 벤치마크 값을 분리 표기한다.',
    related: ['eval', 'hallucination'],
    tags: ['평가'],
  },
  {
    id: 'glo-eval',
    term: 'Eval',
    koName: '평가셋',
    category: '평가/벤치마크',
    definition: '특정 능력을 측정하기 위한 과제·채점 기준 모음. 자체 eval로 도입 전 검증한다.',
    related: ['benchmark'],
    tags: ['평가'],
  },
  {
    id: 'glo-guardrail',
    term: 'Guardrail',
    koName: '가드레일',
    category: '안전/정렬',
    definition: '유해·이탈 출력을 막는 입력/출력 필터·정책. 안전한 배포의 필수 요소.',
    related: ['alignment'],
    tags: ['안전', '운영'],
  },
  {
    id: 'glo-vibe-coding',
    term: 'Vibe Coding',
    koName: '바이브 코딩',
    category: '에이전트/도구',
    definition: '자연어로 의도를 주고 에이전트가 코드를 생성·실행·반복하게 하는 개발 방식.',
    related: ['agent', 'tool-use'],
    tags: ['에이전트', '코딩'],
  },
]

export type GlossaryCategoryFilter = GlossaryCategory | 'all'

export const glossaryCategories: GlossaryCategory[] = [
  '기초',
  '아키텍처',
  '학습/튜닝',
  '추론/생성',
  '컨텍스트',
  '평가/벤치마크',
  '에이전트/도구',
  '멀티모달',
  '안전/정렬',
  '운영/비용',
]

export function getGlossarySearchText(term: GlossaryTerm): string {
  return [term.term, term.koName, term.category, term.definition, term.note ?? '', ...term.tags]
    .join(' ')
}

export function getGlossaryStats() {
  return {
    total: glossaryTerms.length,
    categories: new Set(glossaryTerms.map((term) => term.category)).size,
  }
}
