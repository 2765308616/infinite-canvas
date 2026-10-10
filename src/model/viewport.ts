import type { Viewport } from './types'

export function centerCardPosition(viewport: Viewport, pane: { width: number; height: number }) {
  return {
    x: (pane.width / 2 - viewport.x) / viewport.zoom,
    y: (pane.height * 0.45 - viewport.y) / viewport.zoom
  }
}
