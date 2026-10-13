// Sound preference is stored per authenticated account so that switching
// accounts on a shared device never leaks one user's choice to another.
const PREFIX = 'cav_sound_enabled:'

export function readSoundPreference(uid: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + uid) === '1'
  } catch {
    return false
  }
}

export function writeSoundPreference(uid: string, enabled: boolean) {
  try {
    window.localStorage.setItem(PREFIX + uid, enabled ? '1' : '0')
  } catch {
    /* storage unavailable: preference lasts for this session only */
  }
}
