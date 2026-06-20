import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type {
  CreateSupportPostInput,
  SupportCategory,
  SupportPostDto,
  SupportPostListDto,
} from '@termsdesk/shared'

export const supportKeys = {
  all: ['support'] as const,
  project: (projectSlug: string) => ['support', projectSlug] as const,
  posts: (projectSlug: string, category: SupportCategory | 'all') =>
    ['support', projectSlug, 'posts', category] as const,
}

export function useSupportPosts(projectSlug: string, category: SupportCategory | 'all') {
  return useQuery({
    queryKey: supportKeys.posts(projectSlug, category),
    queryFn: () =>
      api.get<SupportPostListDto>(`public/support/${projectSlug}/posts`, {
        category,
        limit: 50,
      }),
    enabled: Boolean(projectSlug),
  })
}

export function useCreateSupportPost(projectSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreateSupportPostInput, 'projectSlug'>) =>
      api.post<SupportPostDto>(`public/support/${projectSlug}/posts`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supportKeys.project(projectSlug) })
    },
  })
}
