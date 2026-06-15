import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { AppShell } from './AppShell';
import { useAppStore } from '../store/useAppStore';

// 런타임 스모크 — 시드 → 로드 → Home 렌더가 에러 없이 동작하는지.
describe('AppShell 렌더 스모크', () => {
  beforeEach(() => {
    useAppStore.setState({ screen: 'home', loaded: false, params: {}, history: [] });
  });
  afterEach(() => cleanup());

  it('첫 실행: 시드 후 홈 화면과 데모 카드가 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByText('실적가계부')).toBeTruthy();
    // 데모 카드(삼성 taptap)가 실적 그룹에 노출
    expect(screen.getAllByText(/삼성 taptap/).length).toBeGreaterThan(0);
  });

  it('탭 전환: 통계 화면으로 이동하면 카테고리별 지출이 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('stats'));
    await waitFor(() => expect(screen.getByText('카테고리별 지출')).toBeTruthy());
  });

  it('홈에서 드릴다운으로 들어간 화면은 이전 버튼으로 돌아올 수 있다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('stats', {}, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByText('카테고리별 지출')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('이전 화면'));
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy());
  });

  it('예산 설정 화면으로 이동하면 등록된 예산이 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('budget'));
    await waitFor(() => expect(screen.getByText('예산 설정')).toBeTruthy());
    expect(screen.getByText('등록된 예산')).toBeTruthy();
  });
});
