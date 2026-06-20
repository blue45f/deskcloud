// Vitest 셋업 — jest-dom 매처(@testing-library/jest-dom) 등록 + 각 테스트 후 정리.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
