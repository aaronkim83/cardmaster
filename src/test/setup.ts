// jsdom 테스트 환경 폴리필.
// Recharts ResponsiveContainer가 ResizeObserver를 사용하므로 스텁 제공.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
