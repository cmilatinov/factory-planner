import '@testing-library/jest-dom/vitest'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: TestResizeObserver,
})

Object.defineProperty(window, 'PointerEvent', {
  writable: true,
  value: MouseEvent,
})

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: () => 'blob:test-url',
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: () => {},
})
