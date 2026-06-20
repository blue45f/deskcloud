import { z } from 'zod'

import { slugSchema } from './schemas'

export const supportCategories = ['site-inquiry', 'partnership', 'bug'] as const
export type SupportCategory = (typeof supportCategories)[number]

export const supportStatuses = ['open', 'in-review', 'resolved'] as const
export type SupportStatus = (typeof supportStatuses)[number]

const supportProjectSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .transform((value) => value.toLowerCase())
  .pipe(slugSchema)

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

export const createSupportPostSchema = z.object({
  projectSlug: supportProjectSlugSchema,
  category: z.enum(supportCategories),
  name: trimmedText(1, 80),
  contact: trimmedText(3, 200),
  title: trimmedText(2, 140),
  body: trimmedText(10, 4000),
})
export type CreateSupportPostInput = z.infer<typeof createSupportPostSchema>

export interface SupportPostDto {
  id: string
  projectSlug: string
  category: SupportCategory
  status: SupportStatus
  title: string
  body: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export interface SupportPostListDto {
  items: SupportPostDto[]
}
