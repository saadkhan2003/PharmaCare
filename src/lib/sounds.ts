import { createUISFX, type UISFXPlayer } from 'uisfx';

let player: UISFXPlayer | null = null;
let enabled = false;

function getEnabled(): boolean {
  try {
    const stored = localStorage.getItem('pharmacare_sound_enabled');
    if (stored !== null) return stored === 'true';
  } catch {}
  return false;
}

function unlockIfNeeded() {
  if (player) return;
  try {
    player = createUISFX({ pack: 'minimal', volume: 0.7, enabled: getEnabled() });
  } catch {
    player = null;
  }
}

function play(cue: string) {
  if (!enabled) return;
  unlockIfNeeded();
  if (player) {
    player.play(cue as Parameters<typeof player.play>[0]);
  }
}

export function playClick() { play('press'); }
export function playSuccess() { play('success'); }
export function playError() { play('error'); }
export function playDelete() { play('delete'); }
export function playToggle() { play('select'); }
export function playNotification() { play('notification'); }
export function playSearch() { play('typing'); }

export function setEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem('pharmacare_sound_enabled', String(value));
  } catch {}
  if (player) {
    player.setEnabled(value);
  }
}

export function setVolume(value: number) {
  if (player) {
    player.setVolume(value);
  }
}

enabled = getEnabled();
