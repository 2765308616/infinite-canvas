// @vitest-environment jsdom
import { act, renderHook, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Canvas from './Canvas'
import { useCanvasStore } from '../store/useCanvasStore'

const flow = vi.hoisted(() => ({ setCenter: vi.fn(), screenToFlowPosition: vi.fn() }))
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: unknown }) => children,
  ReactFlow: () => null, useReactFlow: () => flow,
  Background: () => null, Controls: () => null, MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' }, Handle: () => null, NodeResizer: () => null, Position: { Left: 'left', Right: 'right' }
}))

describe('search navigation', () => {
  it('centers a search request once and leaves subsequent dragging alone', () => {
    flow.setCenter.mockClear()
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addText({ x: 0, y: 0 }))
    const id = result.current.board.cards[0].id
    const view = render(<Canvas store={result.current} />)
    act(() => result.current.focusCard(id))
    view.rerender(<Canvas store={result.current} />)
    expect(flow.setCenter).toHaveBeenCalledTimes(1)
    act(() => result.current.moveCard(id, { x: 100, y: 100 }))
    view.rerender(<Canvas store={result.current} />)
    expect(flow.setCenter).toHaveBeenCalledTimes(1)
  })
})
