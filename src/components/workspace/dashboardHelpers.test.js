import { describe, expect, it } from 'vitest'
import {
  getGreeting,
  getFormattedDate,
  shapeToolDistribution,
  getChartMax,
  formatErrorRate,
  getBrowserTimeZone,
  assignToolColors,
} from './dashboardHelpers'

describe('getGreeting', () => {
  it('returns Good Morning for 8am', () => {
    const date = new Date(2026, 2, 26, 8, 0, 0)
    expect(getGreeting('Abhishek', date)).toBe('Good Morning, Abhishek')
  })

  it('returns Good Afternoon for 1pm', () => {
    const date = new Date(2026, 2, 26, 13, 0, 0)
    expect(getGreeting('Abhishek', date)).toBe('Good Afternoon, Abhishek')
  })

  it('returns Good Evening for 6pm', () => {
    const date = new Date(2026, 2, 26, 18, 0, 0)
    expect(getGreeting('Abhishek', date)).toBe('Good Evening, Abhishek')
  })

  it('returns Good Evening for midnight', () => {
    const date = new Date(2026, 2, 26, 0, 0, 0)
    expect(getGreeting('Test', date)).toBe('Good Evening, Test')
  })

  it('falls back gracefully when no firstName given', () => {
    const date = new Date(2026, 2, 26, 10, 0, 0)
    expect(getGreeting('', date)).toBe('Good Morning')
    expect(getGreeting(undefined, date)).toBe('Good Morning')
    expect(getGreeting(null, date)).toBe('Good Morning')
  })
})

describe('getFormattedDate', () => {
  it('returns a weekday, month day, year format', () => {
    const date = new Date(2026, 2, 26, 10, 0, 0)
    const result = getFormattedDate(date)
    expect(result).toContain('March')
    expect(result).toContain('26')
    expect(result).toContain('2026')
  })
})

describe('shapeToolDistribution', () => {
  it('returns empty array for empty input', () => {
    expect(shapeToolDistribution([])).toEqual([])
    expect(shapeToolDistribution(null)).toEqual([])
    expect(shapeToolDistribution(undefined)).toEqual([])
  })

  it('returns all tools when 6 or fewer', () => {
    const tools = [
      { tool: 'a', label: 'A', count: 10 },
      { tool: 'b', label: 'B', count: 5 },
    ]
    expect(shapeToolDistribution(tools)).toEqual(tools)
  })

  it('returns top 6 plus Others for more than 6 tools', () => {
    const tools = [
      { tool: 'a', label: 'A', count: 50 },
      { tool: 'b', label: 'B', count: 40 },
      { tool: 'c', label: 'C', count: 30 },
      { tool: 'd', label: 'D', count: 20 },
      { tool: 'e', label: 'E', count: 10 },
      { tool: 'f', label: 'F', count: 8 },
      { tool: 'g', label: 'G', count: 5 },
      { tool: 'h', label: 'H', count: 3 },
    ]

    const result = shapeToolDistribution(tools)
    expect(result).toHaveLength(7)
    expect(result[6].tool).toBe('others')
    expect(result[6].label).toBe('Others')
    expect(result[6].count).toBe(8) // 5 + 3
  })
})

describe('getChartMax', () => {
  it('returns 1 for empty or missing buckets', () => {
    expect(getChartMax([])).toBe(1)
    expect(getChartMax(null)).toBe(1)
    expect(getChartMax(undefined)).toBe(1)
  })

  it('returns the max count', () => {
    const buckets = [
      { label: 'a', count: 3 },
      { label: 'b', count: 12 },
      { label: 'c', count: 7 },
    ]
    expect(getChartMax(buckets)).toBe(12)
  })

  it('returns 1 when all counts are 0', () => {
    const buckets = [
      { label: 'a', count: 0 },
      { label: 'b', count: 0 },
    ]
    expect(getChartMax(buckets)).toBe(1)
  })
})

describe('formatErrorRate', () => {
  it('formats 0 as "0%"', () => {
    expect(formatErrorRate(0)).toBe('0%')
  })

  it('formats a value', () => {
    expect(formatErrorRate(2.5)).toBe('2.5%')
  })

  it('handles null/undefined', () => {
    expect(formatErrorRate(null)).toBe('0%')
    expect(formatErrorRate(undefined)).toBe('0%')
  })
})

describe('getBrowserTimeZone', () => {
  it('returns a non-empty string', () => {
    const tz = getBrowserTimeZone()
    expect(typeof tz).toBe('string')
    expect(tz.length).toBeGreaterThan(0)
  })
})

describe('assignToolColors', () => {
  it('assigns colors from the palette', () => {
    const dist = [
      { tool: 'a', label: 'A', count: 10 },
      { tool: 'b', label: 'B', count: 5 },
    ]

    const result = assignToolColors(dist)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('color')
    expect(result[1]).toHaveProperty('color')
    expect(result[0].color).not.toBe(result[1].color)
  })

  it('returns empty array for empty input', () => {
    expect(assignToolColors([])).toEqual([])
  })
})
