import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnlineGame } from './OnlineGame';
import { roomRequest, seatKey, useRoom } from './useRoom';

vi.mock('./useRoom', async (importOriginal) => ({
  ...await importOriginal<typeof import('./useRoom')>(),
  roomRequest: vi.fn().mockResolvedValue({ ok: true }),
  useRoom: vi.fn(),
}));

const seat = { code: 'ABCD2345', token: 'test-token', memberId: '1' };

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

function setup(status: 'replaced' | 'connected') {
  localStorage.setItem(seatKey(seat.code), JSON.stringify(seat));
  vi.mocked(useRoom).mockReturnValue({
    room: null, status, error: '', pending: false, remaining: 0,
    send: vi.fn(), reconnect: vi.fn(),
  });
  const onExit = vi.fn();
  render(<OnlineGame initialCode={seat.code} onExit={onExit} />);
  return onExit;
}

describe('leaving a replaced online screen', () => {
  it.each(['タイトルへ戻る', '退出'])('%s preserves the replacement session and saved seat', async (button) => {
    const onExit = setup('replaced');
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(roomRequest).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(seatKey(seat.code))!)).toEqual(seat);
  });

  it('still leaves the room and clears the saved seat for an active session', async () => {
    const onExit = setup('connected');
    fireEvent.click(screen.getByRole('button', { name: '退出' }));
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(roomRequest).toHaveBeenCalledWith(`/${seat.code}/leave`, { token: seat.token });
    expect(localStorage.getItem(seatKey(seat.code))).toBeNull();
  });
});
