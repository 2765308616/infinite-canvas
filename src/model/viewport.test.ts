import { expect, it } from 'vitest'
import { centerCardPosition } from './viewport'

it('places a new card in the visible pane center after pan and zoom', () => {
  expect(centerCardPosition({ x: 30, y: -10, zoom: 2 }, { width: 400, height: 600 })).toEqual({ x: 85, y: 140 })
})
