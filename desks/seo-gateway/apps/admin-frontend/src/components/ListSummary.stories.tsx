import { ListSummary } from './ListSummary'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  title: 'Components/ListSummary',
  component: ListSummary,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'At-a-glance counters for a populated list (tenants / sites). A primary total, then one tabular figure per segment. Tokens only; the caller passes pre-counted stats.',
      },
    },
  },
} satisfies Meta<typeof ListSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Tenants: Story = {
  args: {
    stats: [
      { label: 'Total', value: 6, tone: 'accent' },
      { label: 'Enabled', value: 5, tone: 'ok' },
      { label: 'free', value: 2, tone: 'neutral' },
      { label: 'pro', value: 2, tone: 'ok' },
      { label: 'enterprise', value: 2, tone: 'warn' },
    ],
  },
}

export const Sites: Story = {
  args: {
    stats: [
      { label: 'Total', value: 6, tone: 'accent' },
      { label: 'Enabled', value: 5, tone: 'ok' },
      { label: 'Routes', value: 15, tone: 'neutral' },
    ],
  },
}
