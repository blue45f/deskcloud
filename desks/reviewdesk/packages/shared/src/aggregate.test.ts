import { describe, expect, it } from 'vitest'

import { aggregateReviews } from './aggregate'

describe('aggregateReviews', () => {
  it('빈 입력이면 0/null 로 안전 집계', () => {
    const a = aggregateReviews([])
    expect(a.count).toBe(0)
    expect(a.avgRating).toBeNull()
    expect(a.satisfaction).toBeNull()
    expect(a.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })

  it('평균 별점과 분포를 정확히 집계', () => {
    const a = aggregateReviews([{ rating: 5 }, { rating: 4 }, { rating: 3 }, { rating: 5 }])
    expect(a.count).toBe(4)
    expect(a.avgRating).toBe(4.25) // (5+4+3+5)/4
    expect(a.distribution).toEqual({ '1': 0, '2': 0, '3': 1, '4': 1, '5': 2 })
  })

  it('범위 밖·비정수 별점은 제외', () => {
    const a = aggregateReviews([
      { rating: 5 },
      { rating: 0 }, // 범위 밖
      { rating: 6 }, // 범위 밖
      { rating: 4.5 }, // 비정수
      { rating: 3 },
    ])
    expect(a.count).toBe(2) // 5, 3 만 유효
    expect(a.avgRating).toBe(4) // (5+3)/2
  })

  it('satisfaction = 추천(4,5)% − 비추천(1,2)%', () => {
    // 10건: 추천(4–5) 6건, 중립(3) 2건, 비추천(1–2) 2건 → 60% − 20% = 40
    const ratings = [5, 5, 4, 4, 4, 4, 3, 3, 2, 1]
    const a = aggregateReviews(ratings.map((rating) => ({ rating })))
    expect(a.count).toBe(10)
    expect(a.satisfaction).toBe(40)
    expect(a.avgRating).toBe(3.5) // 35/10
  })

  it('satisfaction 경계: 3=중립, 2=비추천, 4=추천', () => {
    const a = aggregateReviews([{ rating: 2 }, { rating: 3 }, { rating: 3 }, { rating: 4 }])
    // 추천 1(25%), 비추천 1(25%) → 0
    expect(a.satisfaction).toBe(0)
  })

  it('전부 5점이면 satisfaction 100', () => {
    const a = aggregateReviews([{ rating: 5 }, { rating: 5 }, { rating: 5 }])
    expect(a.avgRating).toBe(5)
    expect(a.satisfaction).toBe(100)
  })
})
