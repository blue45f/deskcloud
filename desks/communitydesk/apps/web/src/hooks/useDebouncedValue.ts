import { useEffect, useState } from 'react'

/**
 * 값을 지정한 지연(ms) 만큼 디바운스한다. 검색어 입력 등 빠르게 바뀌는 값을
 * 가라앉혀, 파생 작업(필터 재계산·쿼리)을 마지막 입력 후 한 번만 돌게 한다.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
