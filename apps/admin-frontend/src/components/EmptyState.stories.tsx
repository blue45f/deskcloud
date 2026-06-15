import { EmptyState } from './EmptyState'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Centered empty state — a quiet mark, the condition, and an optional next-step hint. Tokens only; used by Dashboard, Sites, Tenants, and the audit log.',
      },
    },
  },
  args: { title: '아직 추적된 호스트가 없습니다' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHint: Story = {
  args: { hint: '봇 요청이 오리진 호스트로 라우팅되면 상태가 집계됩니다.' },
}

export const TitleOnly: Story = {
  args: { hint: undefined },
}

export const WithAction: Story = {
  args: {
    title: '아직 등록된 테넌트가 없습니다',
    hint: '테넌트를 추가하면 apiKey · host 로 식별되는 고객별 설정을 관리할 수 있습니다.',
    action: (
      <button type="button" className="btn-primary px-3 py-2 text-sm font-medium">
        첫 테넌트 추가
      </button>
    ),
  },
}
