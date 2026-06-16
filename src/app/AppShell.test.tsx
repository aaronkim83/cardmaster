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

  it('계좌 편집에서 마이너스 잔액을 저장할 수 있다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('assets'));
    fireEvent.click(await screen.findByRole('button', { name: /주거래 통장/ }));

    fireEvent.change(screen.getByLabelText('시작 잔액 (원)'), { target: { value: '-500000' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const account = useAppStore.getState().accounts.find((a) => a.id === 'acc-bank');
      expect(account?.openingBalance).toBe(-500000);
    });
  });

  it('카드 설정은 카드 전환 후 이름과 결제일을 저장한다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    const samsungName = useAppStore.getState().accounts.find((a) => a.id === 'card-samsung')?.name;
    const hyundaiName = useAppStore.getState().accounts.find((a) => a.id === 'card-hyundai')?.name;

    act(() => useAppStore.getState().navigate('cardedit', { accountId: 'card-samsung' }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByLabelText('카드 이름')).toHaveProperty('value', samsungName));

    act(() => useAppStore.getState().navigate('cardedit', { accountId: 'card-hyundai' }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByLabelText('카드 이름')).toHaveProperty('value', hyundaiName));

    const nextName = `${hyundaiName} 테스트`;
    fireEvent.change(screen.getByLabelText('카드 이름'), { target: { value: nextName } });
    fireEvent.change(screen.getByLabelText('카드 아이콘'), { target: { value: 'HM' } });
    fireEvent.change(screen.getByLabelText('카드번호 뒤 4자리'), { target: { value: '0789' } });
    fireEvent.change(screen.getByLabelText('결제일'), { target: { value: '17' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const card = useAppStore.getState().accounts.find((a) => a.id === 'card-hyundai');
      expect(card?.name).toBe(nextName);
      expect(card?.icon).toBe('HM');
      expect(card?.card?.cardLast4).toBe('0789');
      expect(card?.card?.settlementDay).toBe(17);
    });
  });

  it('혜택 설정에서 소수점 비율을 저장할 수 있다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });

    act(() => useAppStore.getState().navigate('benefit', { benefitId: 'ben-mpoint', accountId: 'card-hyundai' }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByLabelText('비율 (%)')).toHaveProperty('value', '5'));

    fireEvent.change(screen.getByLabelText('비율 (%)'), { target: { value: '0.7' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const benefit = useAppStore.getState().benefits.find((b) => b.id === 'ben-mpoint');
      expect(benefit?.rate).toBeCloseTo(0.007);
    });
  });
});
