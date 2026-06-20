/* @vitest-environment jsdom */

import { vibeCodingCommands } from '@aidigestdesk/content'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CliComparisonSection, LlmCliManualSection } from '@/components/app/CliComparisonSection'

describe('LLM CLI manual UI', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('filters manuals by practical CLI search terms', () => {
    render(<LlmCliManualSection />)

    expect(screen.getByRole('heading', { name: 'LLM CLI 실전 매뉴얼' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '전용 LLM CLI 빠른 시작' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('매뉴얼 검색'), {
      target: { value: 'Aider' },
    })

    expect(screen.getByRole('heading', { name: 'OpenAI 호환 API와 Aider 모델 교체' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '전용 LLM CLI 빠른 시작' })).toBeNull()
  })

  it('copies command snippets with visible feedback', async () => {
    render(<CliComparisonSection commands={vibeCodingCommands.slice(0, 1)} />)

    fireEvent.click(screen.getByRole('button', { name: /실행 명령어 복사/ }))

    expect(await screen.findByText('복사됨')).toBeTruthy()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(vibeCodingCommands[0]?.command)
  })
})
