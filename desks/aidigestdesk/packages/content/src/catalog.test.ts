import { describe, expect, it } from 'vitest'

import {
  calculateModelCosts,
  eventScheduleItems,
  getCatalogStats,
  getMissingSourceReferences,
  getSources,
  movePipelineStage,
  runContentAudit,
  searchCatalog,
} from './catalog'

describe('catalog search', () => {
  it('finds Gemini with Korean typo alias', () => {
    const results = searchCatalog('재미나이')
    expect(results.models.some((model) => model.id === 'gemini-31-pro')).toBe(true)
  })

  it('filters by provider', () => {
    const results = searchCatalog('', 'openai')
    expect(results.models).toHaveLength(1)
    expect(results.models[0]?.providerId).toBe('openai')
  })

  it('filters by multiple providers and categories', () => {
    const providerResults = searchCatalog('', ['openai', 'anthropic'], 'comparison')
    const providerIds = new Set(providerResults.models.map((model) => model.providerId))

    expect(providerIds.has('openai')).toBe(true)
    expect(providerIds.has('anthropic')).toBe(true)
    expect(
      [...providerIds].every((providerId) => ['openai', 'anthropic'].includes(providerId))
    ).toBe(true)

    const categoryResults = searchCatalog('', 'all', ['vibe', 'tools'])
    expect(categoryResults.vibeCodingCommands.length).toBeGreaterThan(0)
    expect(categoryResults.aiCodingTools.length).toBeGreaterThan(0)
  })

  it('searches collected metadata such as domains and checked dates', () => {
    const eventDomainResults = searchCatalog('teca-official.co.kr', 'all', 'events')
    expect(
      eventDomainResults.eventSchedules.some((item) => item.sourceIds.includes('teca-hackathon-db'))
    ).toBe(true)

    const sourceDomainResults = searchCatalog('developers.openai.com', 'all', 'sources')
    expect(sourceDomainResults.sources.some((source) => source.id === 'openai-codex-cli')).toBe(
      true
    )

    const checkedDateResults = searchCatalog('2026-06-18', 'all', 'learning')
    expect(checkedDateResults.resources.length).toBeGreaterThan(0)
  })

  it('finds newly added AI providers and vibe coding commands', () => {
    const kimiResults = searchCatalog('Kimi')
    expect(kimiResults.models.some((model) => model.id === 'kimi-k27-code')).toBe(true)

    const deepSeekResults = searchCatalog('딥시크')
    expect(deepSeekResults.models.some((model) => model.id === 'deepseek-v4-flash')).toBe(true)

    const qwenResults = searchCatalog('Qwen', 'qwen')
    expect(qwenResults.models.some((model) => model.id === 'qwen3-2507')).toBe(true)

    const gemmaResults = searchCatalog('Gemma 4 QAT', 'google', 'comparison')
    expect(gemmaResults.models.some((model) => model.id === 'gemma-4')).toBe(true)

    const llamaResults = searchCatalog('라마 Maverick', 'meta', 'comparison')
    expect(llamaResults.models.some((model) => model.id === 'llama-4-maverick')).toBe(true)

    const cursorResults = searchCatalog('Cursor', 'cursor')
    expect(cursorResults.models.some((model) => model.id === 'cursor-ai-ide')).toBe(true)
    expect(
      cursorResults.vibeCodingCommands.some((command) => command.id === 'cmd-cursor-agent')
    ).toBe(true)

    const vibeResults = searchCatalog('aider', 'all', 'vibe')
    expect(vibeResults.vibeCodingCommands.length).toBeGreaterThan(0)

    const installResults = searchCatalog('curl -fsSL', 'all', 'vibe')
    expect(
      installResults.vibeCodingCommands.some((command) => command.id === 'cmd-openai-codex')
    ).toBe(true)
  })

  it('finds xAI 공식 문서와 OpenAI 호환 CLI 자료', () => {
    const xaiLearningResults = searchCatalog('xAI API', 'all', 'learning')

    expect(xaiLearningResults.resources.some((resource) => resource.id === 'res-xai-docs')).toBe(
      true
    )

    const xaiVibeResults = searchCatalog('grok', 'xai', 'vibe')
    expect(
      xaiVibeResults.vibeCodingCommands.some(
        (command) => command.id === 'cmd-xai-openai-compatible'
      )
    ).toBe(true)
  })

  it('finds learning books only in books category', () => {
    const results = searchCatalog('', 'all', 'books')
    expect(results.resources.length).toBeGreaterThan(0)
    expect(results.resources.every((resource) => resource.type === '도서')).toBe(true)
  })

  it('finds Korean official and community learning resources', () => {
    const results = searchCatalog('한국어', 'all', 'learning')

    expect(results.resources.length).toBeGreaterThan(0)
    expect(results.resources.some((resource) => resource.language === '한국어')).toBe(true)
    expect(results.resources.some((resource) => resource.type === '블로그/글')).toBe(true)
  })

  it('finds expanded Korean vibe coding resources', () => {
    const hermesResults = searchCatalog('헤르메스', 'all', 'learning')
    expect(
      hermesResults.resources.some((resource) => resource.id === 'res-hermes-agent-video')
    ).toBe(true)

    const codeFactoryResults = searchCatalog('코드팩토리', 'all', 'learning')
    expect(
      codeFactoryResults.resources.some((resource) => resource.id === 'res-codefactory-ai-coding')
    ).toBe(true)

    const devDongsaengResults = searchCatalog('개발동생', 'all', 'learning')
    expect(
      devDongsaengResults.resources.some(
        (resource) => resource.id === 'res-dev-dongsaeng-ai-coding'
      )
    ).toBe(true)

    const bbanghyongResults = searchCatalog('빵형', 'all', 'learning')
    expect(
      bbanghyongResults.resources.some(
        (resource) => resource.id === 'res-korean-dev-youtube-core-channels'
      )
    ).toBe(true)

    const codingNoonaResults = searchCatalog('코딩 알려주는 누나', 'all', 'learning')
    expect(
      codingNoonaResults.resources.some(
        (resource) => resource.id === 'res-korean-ai-youtube-creator-watchlist'
      )
    ).toBe(true)

    const okkyResults = searchCatalog('OKKY', 'all', 'learning')
    expect(
      okkyResults.resources.some((resource) => resource.id === 'res-korean-community-ai-writing')
    ).toBe(true)

    const velogResults = searchCatalog('Velog', 'all', 'learning')
    expect(
      velogResults.resources.some((resource) => resource.id === 'res-korean-community-ai-writing')
    ).toBe(true)

    const cursorResults = searchCatalog('Cursor', 'all', 'learning')
    expect(cursorResults.resources.some((resource) => resource.id === 'res-cursor-docs')).toBe(true)

    const koreanCursorResults = searchCatalog('커서 강좌', 'all', 'learning')
    expect(
      koreanCursorResults.resources.some((resource) => resource.id === 'res-cursor-korean-youtube')
    ).toBe(true)

    const koreanCodexCliResults = searchCatalog('코덱스 CLI', 'all', 'vibe')
    expect(
      koreanCodexCliResults.vibeCodingCommands.some((command) => command.id === 'cmd-openai-codex')
    ).toBe(true)

    const educationResults = searchCatalog('원격 교육', 'all', 'learning')
    expect(
      educationResults.resources.some((resource) => resource.id === 'res-korean-remote-bootcamps')
    ).toBe(true)

    const kDigitalResults = searchCatalog('K-디지털', 'all', 'learning')
    expect(
      kDigitalResults.resources.some(
        (resource) => resource.id === 'res-kdigital-public-training-hub'
      )
    ).toBe(true)
    expect(
      kDigitalResults.updates.some((update) => update.id === 'update-korean-public-ai-training')
    ).toBe(true)

    const bootcampResults = searchCatalog('SW마에스트로', 'all', 'learning')
    expect(
      bootcampResults.resources.some(
        (resource) => resource.id === 'res-national-ai-bootcamp-watchlist'
      )
    ).toBe(true)

    const newsletterResults = searchCatalog('GeekNews', 'all', 'learning')
    expect(
      newsletterResults.resources.some(
        (resource) => resource.id === 'res-korean-ai-newsletter-community-hub'
      )
    ).toBe(true)

    const domesticLlmResults = searchCatalog('HyperCLOVA X', 'all', 'learning')
    expect(
      domesticLlmResults.resources.some(
        (resource) => resource.id === 'res-korean-llm-official-products'
      )
    ).toBe(true)

    const exaoneResults = searchCatalog('EXAONE', 'all', 'learning')
    expect(
      exaoneResults.resources.some(
        (resource) => resource.id === 'res-korean-open-llm-technical-reports'
      )
    ).toBe(true)

    const koreanBenchmarkResourceResults = searchCatalog('KMMLU', 'all', 'learning')
    expect(
      koreanBenchmarkResourceResults.resources.some(
        (resource) => resource.id === 'res-korean-llm-benchmark-suite'
      )
    ).toBe(true)

    const officialManualResults = searchCatalog('한국어 공식 매뉴얼', 'all', 'learning')
    expect(
      officialManualResults.resources.some(
        (resource) => resource.id === 'res-korean-official-manual-matrix'
      )
    ).toBe(true)

    const geminiCodeAssistResults = searchCatalog('Gemini Code Assist', 'all', 'learning')
    expect(
      geminiCodeAssistResults.resources.some(
        (resource) => resource.id === 'res-korean-official-manual-matrix'
      )
    ).toBe(true)

    const fastCampusResults = searchCatalog('패스트캠퍼스', 'all', 'learning')
    expect(
      fastCampusResults.resources.some(
        (resource) => resource.id === 'res-korean-course-marketplace-matrix'
      )
    ).toBe(true)

    const codeitResults = searchCatalog('코드잇', 'all', 'learning')
    expect(
      codeitResults.resources.some(
        (resource) => resource.id === 'res-korean-course-marketplace-matrix'
      )
    ).toBe(true)

    const codepressoResults = searchCatalog('코드프레소', 'all', 'learning')
    expect(
      codepressoResults.resources.some(
        (resource) => resource.id === 'res-korean-course-marketplace-matrix'
      )
    ).toBe(true)

    const daconResults = searchCatalog('데이콘', 'all', 'learning')
    expect(
      daconResults.resources.some(
        (resource) => resource.id === 'res-korean-ai-competition-hackathon-learning'
      )
    ).toBe(true)

    const kakaoCampusResults = searchCatalog('카카오테크캠퍼스', 'all', 'learning')
    expect(
      kakaoCampusResults.resources.some(
        (resource) => resource.id === 'res-korean-ai-competition-hackathon-learning'
      )
    ).toBe(true)

    const hackathonResults = searchCatalog('해커톤', 'all', 'learning')
    expect(
      hackathonResults.resources.some(
        (resource) => resource.id === 'res-korean-ai-competition-hackathon-learning'
      )
    ).toBe(true)

    const hanbitResults = searchCatalog('한빛미디어', 'all', 'books')
    expect(
      hanbitResults.resources.some(
        (resource) => resource.id === 'res-korean-bookstore-publisher-matrix'
      )
    ).toBe(true)

    const jpubResults = searchCatalog('제이펍', 'all', 'books')
    expect(
      jpubResults.resources.some(
        (resource) => resource.id === 'res-korean-bookstore-publisher-matrix'
      )
    ).toBe(true)

    const opsResults = searchCatalog('국내 AI 교육 모집 상태', 'all', 'ops')
    expect(
      opsResults.pipelineItems.some((item) => item.id === 'pipe-korean-education-status-watch')
    ).toBe(true)
  })

  it('finds LLM event and promotion watch items', () => {
    const results = searchCatalog('초대', 'all', 'events')

    expect(results.updates.length).toBeGreaterThan(0)
    expect(results.updates.some((update) => update.id === 'event-manus-promotions')).toBe(true)

    const upstageResults = searchCatalog('Solar Pro 3', 'all', 'events')
    expect(
      upstageResults.updates.some((update) => update.id === 'update-upstage-solar-pro3-pricing')
    ).toBe(true)
  })

  it('finds AI government support and public data deals', () => {
    const bizinfoResults = searchCatalog('기업마당 AI/AX 정부지원사업', 'all', 'deals')
    expect(
      bizinfoResults.deals.some((deal) => deal.id === 'deal-gov-bizinfo-ai-support-hub')
    ).toBe(true)

    const onDeviceResults = searchCatalog('온디바이스 AI 스케일업', 'all', 'deals')
    expect(
      onDeviceResults.deals.some((deal) => deal.id === 'deal-gov-gwangju-ondevice-ai-scaleup')
    ).toBe(true)

    const manufacturingResults = searchCatalog('첨단로봇 AI 제조혁신', 'all', 'deals')
    expect(
      manufacturingResults.deals.some(
        (deal) => deal.id === 'deal-gov-jeonnam-robot-ai-manufacturing'
      )
    ).toBe(true)

    const startupResults = searchCatalog('딥테크 특화 창업중심대학', 'all', 'deals')
    expect(
      startupResults.deals.some((deal) => deal.id === 'deal-gov-deeptech-startup-college')
    ).toBe(true)

    const aihubResults = searchCatalog('AI-Hub 공공 AI 학습데이터', 'all', 'deals')
    expect(aihubResults.deals.some((deal) => deal.id === 'deal-gov-aihub-public-datasets')).toBe(
      true
    )
  })

  it('finds AI hackathon and conference schedule items', () => {
    expect(eventScheduleItems.length).toBeGreaterThan(8)

    const hackathonResults = searchCatalog('해커톤', 'all', 'events')
    expect(
      hackathonResults.eventSchedules.some(
        (eventSchedule) => eventSchedule.id === 'schedule-ai-engineer-worldsfair-hackathon-2026'
      )
    ).toBe(true)
    const daconResults = searchCatalog('DACON', 'all', 'events')
    expect(
      daconResults.eventSchedules.some(
        (eventSchedule) => eventSchedule.id === 'schedule-dacon-scpc-ai-challenge-2026'
      )
    ).toBe(true)

    const conferenceResults = searchCatalog('GitHub Universe', 'all', 'events')
    expect(
      conferenceResults.eventSchedules.some(
        (eventSchedule) => eventSchedule.id === 'schedule-github-universe-2026'
      )
    ).toBe(true)

    const koreanSeminarResults = searchCatalog('모두의연구소', 'all', 'events')
    expect(
      koreanSeminarResults.eventSchedules.some(
        (eventSchedule) => eventSchedule.id === 'schedule-modulabs-cvpr-ai-seminar'
      )
    ).toBe(true)
  })

  it('finds official status, release, and cost optimization monitors', () => {
    const statusResults = searchCatalog('SLA', 'all', 'events')
    expect(
      statusResults.updates.some((update) => update.id === 'event-ai-status-outage-watch')
    ).toBe(true)

    const batchResults = searchCatalog('Batch', 'all', 'events')
    expect(
      batchResults.updates.some((update) => update.id === 'event-openai-cost-optimization-watch')
    ).toBe(true)

    const releaseResults = searchCatalog('릴리스 노트', 'all', 'news')
    expect(
      releaseResults.updates.some((update) => update.id === 'update-official-release-note-watch')
    ).toBe(true)

    const statusHubResults = searchCatalog('상태/릴리스', 'all', 'learning')
    expect(
      statusHubResults.resources.some(
        (resource) => resource.id === 'res-ai-service-status-release-hub'
      )
    ).toBe(true)

    const costHubResults = searchCatalog('Flex', 'all', 'learning')
    expect(
      costHubResults.resources.some(
        (resource) => resource.id === 'res-cost-optimization-official-hub'
      )
    ).toBe(true)

    const opsResults = searchCatalog('상태/릴리스/비용', 'all', 'ops')
    expect(
      opsResults.pipelineItems.some((item) => item.id === 'pipe-status-release-cost-watch')
    ).toBe(true)

    const sourceResults = searchCatalog('OpenAI Status', 'all', 'sources')
    expect(sourceResults.sources.some((source) => source.id === 'openai-status')).toBe(true)
  })

  it('finds expanded AI coding tool profiles', () => {
    const jetBrainsResults = searchCatalog('JetBrains', 'all', 'tools')
    expect(jetBrainsResults.aiCodingTools.some((tool) => tool.id === 'tool-jetbrains-junie')).toBe(
      true
    )

    const codeRabbitResults = searchCatalog('PR 리뷰', 'all', 'tools')
    expect(codeRabbitResults.aiCodingTools.some((tool) => tool.id === 'tool-coderabbit')).toBe(true)

    const studentResults = searchCatalog('학생', 'all', 'tools')
    expect(studentResults.aiCodingTools.some((tool) => tool.id === 'tool-github-copilot')).toBe(
      true
    )
  })

  it('finds official agent implementation resources', () => {
    const cookbookResults = searchCatalog('Cookbook', 'all', 'learning')
    expect(
      cookbookResults.resources.some((resource) => resource.id === 'res-official-agent-cookbooks')
    ).toBe(true)

    const langGraphResults = searchCatalog('LangGraph', 'all', 'learning')
    expect(
      langGraphResults.resources.some((resource) => resource.id === 'res-agent-frameworks-official')
    ).toBe(true)

    const mcpResults = searchCatalog('MCP', 'all', 'learning')
    expect(
      mcpResults.resources.some((resource) => resource.id === 'res-mcp-local-open-stack')
    ).toBe(true)

    const ollamaResults = searchCatalog('Ollama', 'all', 'learning')
    expect(
      ollamaResults.resources.some((resource) => resource.id === 'res-mcp-local-open-stack')
    ).toBe(true)

    const langSmithResults = searchCatalog('LangSmith', 'all', 'learning')
    expect(
      langSmithResults.resources.some((resource) => resource.id === 'res-agent-observability-evals')
    ).toBe(true)

    const opsResults = searchCatalog('공식 에이전트 구현', 'all', 'ops')
    expect(opsResults.pipelineItems.some((item) => item.id === 'pipe-official-agent-recipes')).toBe(
      true
    )
  })

  it('finds detailed LLM CLI manuals', () => {
    const codexResults = searchCatalog('빠른 시작', 'openai', 'manuals')
    expect(codexResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-quickstart')).toBe(
      true
    )

    const aiderResults = searchCatalog('base URL', 'all', 'vibe')
    expect(
      aiderResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-openai-compatible-aider')
    ).toBe(true)

    const securityResults = searchCatalog('MCP', 'anthropic', 'tools')
    expect(
      securityResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-security-permissions')
    ).toBe(true)

    const grokResults = searchCatalog('Responses API', 'xai', 'manuals')
    expect(
      grokResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-grok-realtime-research')
    ).toBe(true)

    const kimiResults = searchCatalog('멀티모달 tool result', 'kimi', 'manuals')
    expect(
      kimiResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-kimi-agentic-coding')
    ).toBe(true)

    const deepSeekResults = searchCatalog('cache hit', 'deepseek', 'manuals')
    expect(
      deepSeekResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-deepseek-cost-cache')
    ).toBe(true)

    const mistralResults = searchCatalog('Function Calling', 'mistral', 'manuals')
    expect(
      mistralResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-mistral-tools-docs')
    ).toBe(true)

    const manusResults = searchCatalog('태스크 API', 'manus', 'manuals')
    expect(
      manusResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-manus-task-api')
    ).toBe(true)

    const gemmaResults = searchCatalog('Gemma 4 QAT GGUF', 'google', 'manuals')
    expect(
      gemmaResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-gemma4-qat-local')
    ).toBe(true)

    const llamaResults = searchCatalog('Llama 4 SGLang', 'meta', 'manuals')
    expect(
      llamaResults.llmCliManuals.some((manual) => manual.id === 'llm-cli-llama4-serving')
    ).toBe(true)

    const routerResults = searchCatalog('LiteLLM Proxy', 'all', 'manuals')
    expect(
      routerResults.llmCliManuals.some(
        (manual) => manual.id === 'llm-cli-model-router-observability'
      )
    ).toBe(true)

    const glmServingResults = searchCatalog('GLM-5.2 KTransformers xLLM', 'zhipu', 'manuals')
    expect(
      glmServingResults.llmCliManuals.some(
        (manual) => manual.id === 'llm-cli-glm-local-serving'
      )
    ).toBe(true)

    const frameworkResults = searchCatalog('Agent framework quickstart', 'all', 'manuals')
    expect(
      frameworkResults.llmCliManuals.some(
        (manual) => manual.id === 'llm-cli-agent-frameworks-quickstart'
      )
    ).toBe(true)
  })

  it('finds local open model comparison profiles', () => {
    const glm52Results = searchCatalog('GLM-5.2 KTransformers xLLM', 'zhipu', 'comparison')
    expect(
      glm52Results.localModelComparisons.some(
        (profile) => profile.id === 'local-glm-52-long-horizon'
      )
    ).toBe(true)

    const glmResults = searchCatalog('GLM-5.1 vLLM', 'zhipu', 'comparison')
    expect(
      glmResults.localModelComparisons.some((profile) => profile.id === 'local-glm-51-serving')
    ).toBe(true)

    const gemmaResults = searchCatalog('Gemma 4 QAT', 'google', 'comparison')
    expect(
      gemmaResults.localModelComparisons.some((profile) => profile.id === 'local-gemma4-edge')
    ).toBe(true)

    const llamaResults = searchCatalog('Llama Maverick vLLM', 'meta', 'comparison')
    expect(
      llamaResults.localModelComparisons.some((profile) => profile.id === 'local-llama4-maverick')
    ).toBe(true)

    const frontendResults = searchCatalog('Open WebUI', 'all', 'tools')
    expect(
      frontendResults.localModelComparisons.some(
        (profile) => profile.id === 'local-runtime-ui-baseline'
      )
    ).toBe(true)
  })

  it('finds ranked evaluation harness extensions', () => {
    const promptfooResults = searchCatalog('promptfoo red teaming', 'all', 'tools')
    expect(
      promptfooResults.extensions.some((extension) => extension.id === 'ext-promptfoo-eval-redteam')
    ).toBe(true)

    const ragasResults = searchCatalog('Ragas tool call accuracy', 'all', 'tools')
    expect(
      ragasResults.extensions.some((extension) => extension.id === 'ext-ragas-rag-agent-evals')
    ).toBe(true)

    const langSmithResults = searchCatalog('LangSmith online evaluation', 'all', 'tools')
    expect(
      langSmithResults.extensions.some((extension) => extension.id === 'ext-langsmith-evaluations')
    ).toBe(true)

    const litellmResults = searchCatalog('LiteLLM Proxy', 'all', 'tools')
    expect(
      litellmResults.extensions.some((extension) => extension.id === 'ext-litellm-proxy-gateway')
    ).toBe(true)

    const openRouterResults = searchCatalog('OpenRouter model router', 'all', 'tools')
    expect(
      openRouterResults.extensions.some(
        (extension) => extension.id === 'ext-openrouter-model-router'
      )
    ).toBe(true)

    const langfuseResults = searchCatalog('Langfuse observability', 'all', 'tools')
    expect(
      langfuseResults.extensions.some(
        (extension) => extension.id === 'ext-langfuse-observability-evals'
      )
    ).toBe(true)

    const deepevalResults = searchCatalog('DeepEval deepeval test run', 'all', 'tools')
    expect(
      deepevalResults.extensions.some(
        (extension) => extension.id === 'ext-deepeval-ci-agent-evals'
      )
    ).toBe(true)

    const openaiEvalsResults = searchCatalog('OpenAI Evals private eval', 'all', 'tools')
    expect(
      openaiEvalsResults.extensions.some(
        (extension) => extension.id === 'ext-openai-evals-registry'
      )
    ).toBe(true)

    const mcpAgentResults = searchCatalog('mcp-agent lifecycle', 'all', 'tools')
    expect(
      mcpAgentResults.extensions.some((extension) => extension.id === 'ext-mcp-agent-workflows')
    ).toBe(true)

    const aguiResults = searchCatalog('AG-UI create-ag-ui-app', 'all', 'tools')
    expect(
      aguiResults.extensions.some((extension) => extension.id === 'ext-ag-ui-agent-protocol')
    ).toBe(true)

    const agnoResults = searchCatalog('Agno AgentOS', 'all', 'tools')
    expect(
      agnoResults.extensions.some((extension) => extension.id === 'ext-agno-agent-platform')
    ).toBe(true)

    const ktransformersResults = searchCatalog('KTransformers GLM-5.2 Day0', 'all', 'tools')
    expect(
      ktransformersResults.extensions.some(
        (extension) => extension.id === 'ext-ktransformers-heterogeneous-inference'
      )
    ).toBe(true)

    const xllmResults = searchCatalog('xLLM Chinese accelerators', 'all', 'tools')
    expect(
      xllmResults.extensions.some(
        (extension) => extension.id === 'ext-xllm-accelerator-serving'
      )
    ).toBe(true)

    const langGraphResults = searchCatalog('LangGraph stateful agents', 'all', 'tools')
    expect(
      langGraphResults.extensions.some(
        (extension) => extension.id === 'ext-langgraph-stateful-agents'
      )
    ).toBe(true)

    const llamaIndexResults = searchCatalog('LlamaIndex RAG agents', 'all', 'tools')
    expect(
      llamaIndexResults.extensions.some((extension) => extension.id === 'ext-llamaindex-rag-agents')
    ).toBe(true)

    const pydanticResults = searchCatalog('Pydantic AI type-safe agents', 'all', 'tools')
    expect(
      pydanticResults.extensions.some(
        (extension) => extension.id === 'ext-pydantic-ai-type-safe-agents'
      )
    ).toBe(true)

    const crewAiResults = searchCatalog('CrewAI flows', 'all', 'tools')
    expect(
      crewAiResults.extensions.some((extension) => extension.id === 'ext-crewai-multi-agent-flows')
    ).toBe(true)

    const autogenResults = searchCatalog('AutoGen AgentChat Studio', 'all', 'tools')
    expect(
      autogenResults.extensions.some((extension) => extension.id === 'ext-autogen-agentchat-studio')
    ).toBe(true)

    const mastraResults = searchCatalog('Mastra TypeScript agents', 'all', 'tools')
    expect(
      mastraResults.extensions.some((extension) => extension.id === 'ext-mastra-typescript-agents')
    ).toBe(true)

    const braintrustResults = searchCatalog('Braintrust evals', 'all', 'tools')
    expect(
      braintrustResults.extensions.some(
        (extension) => extension.id === 'ext-braintrust-evals-observability'
      )
    ).toBe(true)

    const phoenixResults = searchCatalog('Arize Phoenix OpenInference', 'all', 'tools')
    expect(
      phoenixResults.extensions.some(
        (extension) => extension.id === 'ext-phoenix-openinference-evals'
      )
    ).toBe(true)

    const giskardResults = searchCatalog('Giskard red teaming', 'all', 'tools')
    expect(
      giskardResults.extensions.some(
        (extension) => extension.id === 'ext-giskard-agent-redteam-harness'
      )
    ).toBe(true)

    const giskardSkillResults = searchCatalog('Giskard Agent Skills', 'all', 'tools')
    expect(
      giskardSkillResults.extensions.some((extension) => extension.id === 'ext-giskard-agent-skills')
    ).toBe(true)

    const claudeSkillResults = searchCatalog('Claude run verify skill', 'all', 'tools')
    expect(
      claudeSkillResults.extensions.some(
        (extension) => extension.id === 'ext-skill-run-verify-generator'
      )
    ).toBe(true)

    const ragSkillResults = searchCatalog('RAG evaluation skill template', 'all', 'tools')
    expect(
      ragSkillResults.extensions.some((extension) => extension.id === 'ext-skill-rag-eval-template')
    ).toBe(true)

    const releaseSkillResults = searchCatalog('release documentation skill', 'all', 'tools')
    expect(
      releaseSkillResults.extensions.some(
        (extension) => extension.id === 'ext-skill-release-docs-template'
      )
    ).toBe(true)

    const uiSkillResults = searchCatalog('UI QA skill template', 'all', 'tools')
    expect(
      uiSkillResults.extensions.some((extension) => extension.id === 'ext-skill-ui-qa-template')
    ).toBe(true)

    const mlflowResults = searchCatalog('MLflow GenAI evaluation', 'all', 'tools')
    expect(
      mlflowResults.extensions.some((extension) => extension.id === 'ext-mlflow-genai-evaluation')
    ).toBe(true)

    const trulensResults = searchCatalog('TruLens RAG triad', 'all', 'tools')
    expect(
      trulensResults.extensions.some((extension) => extension.id === 'ext-trulens-rag-triad-evals')
    ).toBe(true)

    const weaveResults = searchCatalog('W&B Weave', 'all', 'tools')
    expect(
      weaveResults.extensions.some((extension) => extension.id === 'ext-wandb-weave-llm-evals')
    ).toBe(true)
  })

  it('finds expanded benchmark and Korean course sources', () => {
    const sweBenchResults = searchCatalog('SWE-bench', 'all', 'benchmarks')
    expect(
      sweBenchResults.benchmarks.some((entry) => entry.id === 'swebench-verified-coverage')
    ).toBe(true)

    const aiderResults = searchCatalog('Aider', 'all', 'benchmarks')
    expect(aiderResults.benchmarks.some((entry) => entry.id === 'aider-gpt5-high-polyglot')).toBe(
      true
    )

    const mobileResults = searchCatalog('모바일', 'all', 'benchmarks')
    expect(
      mobileResults.benchmarks.some((entry) => entry.id === 'swebench-mobile-cursor-opus')
    ).toBe(true)

    const dialogueResults = searchCatalog('대화', 'all', 'benchmarks')
    expect(dialogueResults.benchmarks.some((entry) => entry.id === 'dialogue-swebench-agent')).toBe(
      true
    )

    const sweLancerResults = searchCatalog('SWE-Lancer', 'all', 'benchmarks')
    expect(
      sweLancerResults.benchmarks.some((entry) => entry.id === 'swelancer-economic-coding')
    ).toBe(true)

    const paperBenchResults = searchCatalog('PaperBench', 'all', 'benchmarks')
    expect(
      paperBenchResults.benchmarks.some((entry) => entry.id === 'paperbench-research-replication')
    ).toBe(true)

    const mleBenchResults = searchCatalog('MLE-bench', 'all', 'benchmarks')
    expect(
      mleBenchResults.benchmarks.some((entry) => entry.id === 'mlebench-kaggle-engineering')
    ).toBe(true)

    const browseCompResults = searchCatalog('BrowseComp', 'all', 'benchmarks')
    expect(
      browseCompResults.benchmarks.some((entry) => entry.id === 'browsecomp-web-research')
    ).toBe(true)

    const gpuResults = searchCatalog('GPU', 'all', 'benchmarks')
    expect(gpuResults.benchmarks.some((entry) => entry.id === 'kernelbench-gpu-kernels')).toBe(true)

    const smartContractResults = searchCatalog('스마트컨트랙트', 'all', 'benchmarks')
    expect(
      smartContractResults.benchmarks.some(
        (entry) => entry.id === 'evmbench-smart-contract-security'
      )
    ).toBe(true)

    const cybenchResults = searchCatalog('Cybench', 'all', 'benchmarks')
    expect(cybenchResults.benchmarks.some((entry) => entry.id === 'cybench-ctf-agent')).toBe(true)

    const reBenchResults = searchCatalog('RE-Bench', 'all', 'benchmarks')
    expect(reBenchResults.benchmarks.some((entry) => entry.id === 'rebench-ai-rd')).toBe(true)

    const liveSweResults = searchCatalog('SWE-bench Live', 'all', 'benchmarks')
    expect(
      liveSweResults.benchmarks.some((entry) => entry.id === 'swebench-live-fresh-issues')
    ).toBe(true)

    const sweExploreResults = searchCatalog('SWE-Explore', 'all', 'benchmarks')
    expect(
      sweExploreResults.benchmarks.some((entry) => entry.id === 'swe-explore-repo-localization')
    ).toBe(true)

    const utBoostResults = searchCatalog('UTBoost', 'all', 'benchmarks')
    expect(
      utBoostResults.benchmarks.some((entry) => entry.id === 'utboost-test-quality-audit')
    ).toBe(true)

    const codeEloResults = searchCatalog('CodeElo', 'all', 'benchmarks')
    expect(
      codeEloResults.benchmarks.some((entry) => entry.id === 'codeelo-competitive-programming')
    ).toBe(true)

    const kmmluResults = searchCatalog('KMMLU', 'all', 'benchmarks')
    expect(
      kmmluResults.benchmarks.some((entry) => entry.id === 'kmmlu-korean-exam-understanding')
    ).toBe(true)

    const kmmmuResults = searchCatalog('KMMMU', 'all', 'benchmarks')
    expect(kmmmuResults.benchmarks.some((entry) => entry.id === 'kmmmu-korean-multimodal')).toBe(
      true
    )

    const webAgentResults = searchCatalog('웹 에이전트', 'all', 'learning')
    expect(
      webAgentResults.resources.some(
        (resource) => resource.id === 'res-benchmark-hubs-web-os-agents'
      )
    ).toBe(true)

    const gdpvalResults = searchCatalog('GDPval', 'all', 'benchmarks')
    expect(gdpvalResults.benchmarks.some((entry) => entry.id === 'gdpval-work-deliverables')).toBe(
      true
    )

    const sheetResults = searchCatalog('스프레드시트', 'all', 'benchmarks')
    expect(
      sheetResults.benchmarks.some((entry) => entry.id === 'bluefin-finance-spreadsheets')
    ).toBe(true)

    const officeResults = searchCatalog('Office automation', 'all', 'learning')
    expect(
      officeResults.resources.some((resource) => resource.id === 'res-benchmark-hubs-work-office')
    ).toBe(true)

    const mcpBenchResults = searchCatalog('MCP-Bench', 'all', 'benchmarks')
    expect(mcpBenchResults.benchmarks.some((entry) => entry.id === 'mcp-bench-tool-use')).toBe(true)

    const iosWorldResults = searchCatalog('iOSWorld', 'all', 'benchmarks')
    expect(
      iosWorldResults.benchmarks.some((entry) => entry.id === 'iosworld-personal-phone-agent')
    ).toBe(true)

    const pptcResults = searchCatalog('PPTC Benchmark', 'all', 'benchmarks')
    expect(
      pptcResults.benchmarks.some((entry) => entry.id === 'pptc-powerpoint-task-completion')
    ).toBe(true)

    const presentBenchResults = searchCatalog('PresentBench', 'all', 'benchmarks')
    expect(
      presentBenchResults.benchmarks.some((entry) => entry.id === 'presentbench-slide-generation')
    ).toBe(true)

    const qualityHubResults = searchCatalog('벤치마크 신뢰도', 'all', 'learning')
    expect(
      qualityHubResults.resources.some(
        (resource) => resource.id === 'res-benchmark-freshness-quality-audit'
      )
    ).toBe(true)

    const opsResults = searchCatalog('오염', 'all', 'ops')
    expect(
      opsResults.pipelineItems.some((item) => item.id === 'pipe-benchmark-quality-audit')
    ).toBe(true)

    const courseResults = searchCatalog('노마드코더', 'all', 'learning')
    expect(
      courseResults.resources.some((resource) => resource.id === 'res-korean-course-platforms')
    ).toBe(true)
  })

  it('finds task recommendations by user intent', () => {
    const cursorResults = searchCatalog('버그 수정', 'cursor', 'recommendations')
    expect(
      cursorResults.taskRecommendations.some(
        (recommendation) => recommendation.id === 'task-repo-fix'
      )
    ).toBe(true)

    const costResults = searchCatalog('저비용', 'all', 'recommendations')
    expect(
      costResults.taskRecommendations.some(
        (recommendation) => recommendation.id === 'task-low-cost-bulk'
      )
    ).toBe(true)
  })

  it('resolves source references', () => {
    expect(getSources(['openai-gpt55'])[0]?.publisher).toBe('OpenAI Developers')
  })

  it('exposes summary stats', () => {
    expect(getCatalogStats()).toMatchObject({
      providers: 12,
      localModelComparisons: 8,
      updates: 46,
      benchmarkRows: 97,
      vibeCommands: 17,
      cliManuals: 18,
      aiCodingTools: 14,
      personaGuides: 5,
      taskRecommendations: 8,
      monitors: 53,
      pipelineItems: 14,
      costProfiles: 10,
    })
  })

  it('audits source references and required coverage', () => {
    expect(getMissingSourceReferences()).toEqual([])

    const audit = runContentAudit()
    expect(audit.passed).toBe(true)
    expect(audit.checks.every((check) => check.status !== 'fail')).toBe(true)
  })

  it('searches editorial operations workflow', () => {
    const results = searchCatalog('후보', 'all', 'ops')

    expect(results.curationMonitors.length).toBeGreaterThan(0)
    expect(results.pipelineItems.length).toBeGreaterThan(0)
    expect(results.featureBacklog.some((item) => item.id === 'feature-source-crawler')).toBe(true)

    const koreanLlmOpsResults = searchCatalog('국내 LLM/한국어 벤치마크 감시 큐', 'all', 'ops')
    expect(
      koreanLlmOpsResults.pipelineItems.some(
        (item) => item.id === 'pipe-korean-llm-benchmark-watch'
      )
    ).toBe(true)
  })

  it('searches persona playbooks with provider filters', () => {
    const pmResults = searchCatalog('PM', 'all', 'personas')
    expect(pmResults.personaGuides.some((guide) => guide.id === 'persona-product-manager')).toBe(
      true
    )

    const xaiResults = searchCatalog('', 'xai', 'personas')
    expect(xaiResults.personaGuides.every((guide) => guide.providerIds.includes('xai'))).toBe(true)
  })

  it('calculates monthly model costs sorted by total cost', () => {
    const estimates = calculateModelCosts({
      inputTokensPerRun: 10_000,
      outputTokensPerRun: 2_000,
      runsPerMonth: 1_000,
    })

    expect(estimates).toHaveLength(10)
    expect(estimates[0]?.totalCost).toBeLessThanOrEqual(estimates.at(-1)?.totalCost ?? 0)
    expect(estimates.some((estimate) => estimate.profile.modelName === 'GPT-5.5')).toBe(true)
  })

  it('moves pipeline stages within valid bounds', () => {
    expect(movePipelineStage('수집', 'previous')).toBe('수집')
    expect(movePipelineStage('수집', 'next')).toBe('검토')
    expect(movePipelineStage('게시 준비', 'next')).toBe('게시')
    expect(movePipelineStage('게시', 'next')).toBe('게시')
  })
})
