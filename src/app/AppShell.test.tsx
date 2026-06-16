import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { AppShell } from './AppShell';
import { useAppStore } from '../store/useAppStore';
import { makeAccount } from '../logic/testUtils';

// 런타임 스모크 — 시드 → 로드 → Home 렌더가 에러 없이 동작하는지.
describe('AppShell 렌더 스모크', () => {
  beforeEach(() => {
    useAppStore.setState({ screen: 'home', loaded: false, params: {}, history: [] });
  });
  afterEach(() => cleanup());

  it('첫 실행: 시드 후 홈 화면과 데모 카드가 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByText('실적가계부')).toBeNull();
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

  it('홈 카드 클릭은 카드별 내역과 혜택으로 이동한다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });

    fireEvent.click(screen.getByText('현대카드 M'));

    await waitFor(() => expect(screen.getByText('현대카드 M 혜택')).toBeTruthy());
    expect(screen.getByText(/M포인트 5% 적립/)).toBeTruthy();
  });

  it('입력 화면은 카테고리 직후 소분류와 실적 토글을 노출한다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('input'));

    await waitFor(() => expect(screen.getByText('지출 입력')).toBeTruthy());
    fireEvent.click(screen.getByText(/식비/));

    expect(screen.getByText('마트')).toBeTruthy();
    expect(screen.getByText('실적 인정')).toBeTruthy();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('실적 인정')).toBeLessThan(bodyText.indexOf('가맹점'));
  });

  it('예산 설정 화면으로 이동하면 등록된 예산이 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('budget'));
    await waitFor(() => expect(screen.getByText('예산 설정')).toBeTruthy());
    expect(screen.getByText('등록된 예산')).toBeTruthy();
  });

  it('환경설정 화면으로 이동하면 데모 데이터 관리 액션이 렌더된다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('settings'));
    await waitFor(() => expect(screen.getByText('환경설정')).toBeTruthy());
    expect(screen.getByText('데모 데이터 삭제')).toBeTruthy();
    expect(screen.getByText('전체 초기화')).toBeTruthy();
  });

  it('계좌 편집에서 마이너스 잔액을 저장할 수 있다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    act(() => useAppStore.getState().navigate('assets'));
    fireEvent.click(await screen.findByRole('button', { name: '주거래 통장 편집' }));

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

  it('혜택 설정에서 정액 혜택을 저장할 수 있다', async () => {
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });

    act(() => useAppStore.getState().navigate('benefit', { benefitId: 'ben-mpoint', accountId: 'card-hyundai' }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByText('혜택 방식')).toBeTruthy());

    fireEvent.click(screen.getByText('정액'));
    fireEvent.change(screen.getByLabelText('혜택액 (원)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const benefit = useAppStore.getState().benefits.find((b) => b.id === 'ben-mpoint');
      expect(benefit?.valueType).toBe('fixed');
      expect(benefit?.fixedAmount).toBe(1500);
    });
  });

  it('환경설정에서 데모를 지우면 다시 로드해도 데모가 자동 재생성되지 않는다', async () => {
    await act(async () => {
      await useAppStore.getState().loadDemoData();
    });
    expect(useAppStore.getState().accounts.length).toBeGreaterThan(0);

    await act(async () => {
      await useAppStore.getState().resetAllData({ onboarded: true });
    });
    expect(useAppStore.getState().accounts).toHaveLength(0);
    expect(useAppStore.getState().transactions).toHaveLength(0);
    expect(useAppStore.getState().categories.length).toBeGreaterThan(0);

    await act(async () => {
      await useAppStore.getState().loadAll();
    });
    expect(useAppStore.getState().accounts).toHaveLength(0);
    expect(useAppStore.getState().transactions).toHaveLength(0);
  });

  it('도래한 자동이체는 한 번만 실체화되고 변동 금액은 pending으로 남는다', async () => {
    await act(async () => {
      await useAppStore.getState().resetAllData({ onboarded: true });
      await useAppStore.getState().saveAccount(makeAccount({ id: 'acc-recurring', name: '자동이체 통장' }));
      await useAppStore.getState().saveRecurring({
        id: 'rec-variable-test',
        name: '변동 관리비',
        type: 'expense',
        amount: 100000,
        isVariable: true,
        accountId: 'acc-recurring',
        dayOfMonth: 1,
        startDate: '2026-01-01',
        autoConfirm: false,
        isActive: true,
      });
    });

    const first = useAppStore.getState().transactions.filter((t) => t.recurringId === 'rec-variable-test');
    expect(first).toHaveLength(1);
    expect(first[0].status).toBe('pending');

    await act(async () => {
      await useAppStore.getState().loadAll();
    });
    const second = useAppStore.getState().transactions.filter((t) => t.recurringId === 'rec-variable-test');
    expect(second).toHaveLength(1);
  });

  it('계좌 순서 변경 액션은 sortOrder를 저장한다', async () => {
    await act(async () => {
      await useAppStore.getState().loadDemoData();
    });
    const assets = useAppStore.getState().accounts.filter((a) => a.kind === 'asset').slice(0, 2);
    expect(assets).toHaveLength(2);

    await act(async () => {
      await useAppStore.getState().reorderAccounts([assets[1], assets[0]]);
    });

    const reordered = useAppStore.getState().accounts;
    expect(reordered.find((a) => a.id === assets[1].id)?.sortOrder).toBe(0);
    expect(reordered.find((a) => a.id === assets[0].id)?.sortOrder).toBe(1);
  });

  it('거래 수정에서 가맹점·금액을 저장한다', async () => {
    await act(async () => { await useAppStore.getState().loadDemoData(); });
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    const target = useAppStore.getState().transactions.find((t) => t.merchant === '이마트');
    expect(target).toBeTruthy();

    act(() => useAppStore.getState().navigate('edit', { txnId: target!.id }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByLabelText('가맹점')).toHaveProperty('value', '이마트'));

    fireEvent.change(screen.getByLabelText('가맹점'), { target: { value: '이마트 성수점' } });
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '61000' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const t = useAppStore.getState().transactions.find((x) => x.id === target!.id);
      expect(t?.merchant).toBe('이마트 성수점');
      expect(t?.amount).toBe(61000);
    });
  });

  it('거래를 대기(pending)로 전환해 저장한다', async () => {
    await act(async () => { await useAppStore.getState().loadDemoData(); });
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    const target = useAppStore.getState().transactions.find((t) => t.merchant === '쿠팡' && t.status === 'confirmed');
    expect(target).toBeTruthy();

    act(() => useAppStore.getState().navigate('edit', { txnId: target!.id }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByLabelText('확정 거래')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('확정 거래')); // confirmed → pending
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      const t = useAppStore.getState().transactions.find((x) => x.id === target!.id);
      expect(t?.status).toBe('pending');
    });
  });

  it('거래 수정 화면은 적용 혜택을 계산해 표시한다', async () => {
    await act(async () => { await useAppStore.getState().loadDemoData(); });
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    const star = useAppStore.getState().transactions.find((t) => (t.merchant ?? '').includes('스타벅스'));
    expect(star).toBeTruthy();

    act(() => useAppStore.getState().navigate('edit', { txnId: star!.id }, { preserveHistory: true }));
    await waitFor(() => expect(screen.getByText('적용 혜택')).toBeTruthy());
    // 저장하지 않아도 computeBenefits로 계산된 혜택액(🎁 …원)이 표시됨
    await waitFor(() => expect(screen.getByText(/🎁.*원/)).toBeTruthy());
  });

  it('홈 실적 카드에 혜택 한도 남은액이 표시된다', async () => {
    await act(async () => { await useAppStore.getState().loadDemoData(); });
    render(<AppShell />);
    await waitFor(() => expect(screen.getByText('카드 실적')).toBeTruthy(), { timeout: 4000 });
    // 한도 있는 혜택의 남은 금액(…원 남음)이 카드에 표시됨
    await waitFor(() => expect(screen.getAllByText(/원 남음/).length).toBeGreaterThan(0));
  });
});
