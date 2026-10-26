import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Modal, Tabs, Badge, Kpi, AudioPlayer, ProgressBar, rowLink, toneText } from '../components/ui';
import { useTheme, readPreference, THEME_KEY } from '../state/theme';

describe('Modal', () => {
  function Harness({ onClose = () => {} }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && (
          <Modal title="Confirm" onClose={() => { onClose(); setOpen(false); }} footer={<button>OK</button>}>
            <input aria-label="Name" />
          </Modal>
        )}
      </>
    );
  }

  it('is a labelled dialog that focuses its first field, traps Tab and closes on Escape with focus restored', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    for (let i = 0; i < 5; i++) await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Tabs', () => {
  it('uses roving tabindex and arrow / Home / End keys', async () => {
    const user = userEvent.setup();
    function T() { const [v, setV] = useState('A'); return <Tabs tabs={['A', 'B', 'C']} value={v} onChange={setV} label="Views" />; }
    render(<T />);
    const [a, b, c] = screen.getAllByRole('tab');
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    expect(a).toHaveAttribute('tabindex', '0');
    expect(b).toHaveAttribute('tabindex', '-1');
    a.focus();
    await user.keyboard('{ArrowRight}');
    expect(b).toHaveAttribute('aria-selected', 'true');
    expect(b).toHaveFocus();
    await user.keyboard('{End}');
    expect(c).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(a).toHaveAttribute('aria-selected', 'true');
  });
});

describe('AudioPlayer', () => {
  it('seeks with the keyboard and exposes a readable value', async () => {
    const user = userEvent.setup();
    const audio = { pos: 10, playing: false, speed: 1, toggle: vi.fn(), seek: vi.fn(), cycleSpeed: vi.fn() };
    render(<AudioPlayer audio={audio} duration={120} />);
    const slider = screen.getByRole('slider', { name: 'Seek recording' });
    expect(slider).toHaveAttribute('aria-valuetext', '0:10 of 2:00');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(audio.seek).toHaveBeenLastCalledWith(15);
    await user.keyboard('{End}');
    expect(audio.seek).toHaveBeenLastCalledWith(120);
    await user.click(screen.getByRole('button', { name: 'Play recording' }));
    expect(audio.toggle).toHaveBeenCalled();
  });
});

describe('small primitives', () => {
  it('rowLink opens on Enter and Space but not from nested controls', async () => {
    const user = userEvent.setup();
    const fn = vi.fn();
    render(<table><tbody><tr {...rowLink(fn)}><td><button>inner</button></td></tr></tbody></table>);
    const row = screen.getByRole('row');
    row.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(fn).toHaveBeenCalledTimes(2);
    screen.getByRole('button', { name: 'inner' }).focus();
    await user.keyboard('{Enter}');
    expect(fn).toHaveBeenCalledTimes(3); // the inner button's click bubbles, the keydown handler itself does not fire
  });

  it('badge and tone helpers map semantic tones to token classes', () => {
    render(<Badge cls="red">Disputed</Badge>);
    expect(screen.getByText('Disputed').className).toMatch(/bg-danger-soft/);
    expect(toneText('green')).toBe('text-success-fg');
    expect(toneText('none')).toBe('text-fg-subtle');
  });

  it('Kpi renders a link when given a destination', () => {
    render(<MemoryRouter><Kpi label="Needs review" value={31} to="/queue" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Needs review/ })).toHaveAttribute('href', '/queue');
  });

  it('ProgressBar clamps and reports its value', () => {
    render(<ProgressBar value={130} label="Goal" />);
    expect(screen.getByRole('progressbar', { name: 'Goal' })).toHaveAttribute('aria-valuenow', '130');
    expect(screen.getByRole('progressbar').firstChild.style.width).toBe('100%');
  });
});

describe('theme', () => {
  const mockOs = (dark) => {
    const listeners = new Set();
    window.matchMedia = () => ({ matches: dark, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f) });
    return listeners;
  };

  it('defaults to dark without a saved choice', () => {
    mockOs(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists light, follows the OS for System, and clears storage for the default', () => {
    const listeners = mockOs(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference('light'));
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => result.current.setPreference('system'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    mockOs(false);
    act(() => listeners.forEach((f) => f()));
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => result.current.setPreference('dark'));
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    expect(readPreference()).toBe('dark');
  });
});
