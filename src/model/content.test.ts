import { describe, expect, it, vi } from 'vitest'
import { createGroup, moveGroup, ungroup } from './operations'
import { normalizeHttpUrl, validateImage } from './content'
import { createBoard } from './operations'
import type { Card } from './types'

const card = (id: string, x: number): Card => ({ id, type: 'text', text: id, x, y: 10, width: 180, height: 80, color: 'cream' })

describe('mixed content', () => {
  it('rejects signature-matching images that the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed') }))
    try {
      await expect(validateImage(new File([Uint8Array.of(137,80,78,71,13,10,26,10)], 'bad.png', { type: 'image/png' }))).rejects.toThrow(/解码/)
    } finally { vi.unstubAllGlobals() }
  })
  it('accepts a PNG image with its actual file signature', async () => {
    const bytes = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 1)
    await expect(validateImage(new File([bytes], 'diagram.png', { type: 'image/png' }))).resolves.toBeUndefined()
  })

  it('rejects oversized and unsupported images', async () => {
    const huge = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })
    await expect(validateImage(huge)).rejects.toThrow()
    await expect(validateImage(new File(['hello'], 'x.svg', { type: 'image/svg+xml' }))).rejects.toThrow()
    await expect(validateImage(new File(['fake'], 'x.png', { type: 'image/png' }))).rejects.toThrow()
  })

  it('normalizes HTTP links and rejects executable schemes', () => {
    expect(normalizeHttpUrl(' https://example.com/page ')).toBe('https://example.com/page')
    expect(() => normalizeHttpUrl('javascript:alert(1)')).toThrow()
    expect(() => normalizeHttpUrl('file:///tmp/private')).toThrow()
  })

  it('moves every group member and leaves other cards in place', () => {
    const board = createBoard('资料')
    board.cards = [card('a', 10), card('b', 30), card('free', 100)]
    const grouped = createGroup(board, ['a', 'b'], '灵感')
    const moved = moveGroup(grouped, grouped.groups[0].id, { x: 50, y: 20 })
    expect(moved.cards.map((item) => [item.id, item.x, item.y])).toEqual([
      ['a', 60, 30], ['b', 80, 30], ['free', 100, 10]
    ])
    expect(ungroup(moved, moved.groups[0].id).cards.every((item) => !item.groupId)).toBe(true)
  })
})
