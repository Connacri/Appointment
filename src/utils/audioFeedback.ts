/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Global Audio Feedback & Native Haptic Engine
 * Provides synthesized sound cues (success chime, error alarm, click, bip, warning)
 * using the native Web Audio API and mobile vibration API.
 * 
 * Usable anywhere across the application:
 * - Successful task completion: playAudioFeedback('success') / playSuccessFeedback()
 * - Error handling & validation: playAudioFeedback('error') / playErrorFeedback()
 * - Interactive UI click: playAudioFeedback('click') / playClickFeedback()
 * - Hardware / RFID / Scan bip: playAudioFeedback('bip') / playBipFeedback()
 */

export type AudioFeedbackType = 'success' | 'error' | 'click' | 'bip' | 'warning';

export interface AudioFeedbackOptions {
  volume?: number; // 0.0 to 1.0 (default 0.25)
  haptic?: boolean; // trigger native vibration if available (default true)
}

const STORAGE_KEY = 'omnibook_audio_feedback_enabled';

class GlobalAudioFeedbackService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.enabled = stored !== 'false';
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtxClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Main audio feedback dispatcher
   */
  public play(type: AudioFeedbackType, options?: AudioFeedbackOptions): void {
    if (!this.enabled) return;

    const volume = Math.min(1, Math.max(0, options?.volume ?? 0.22));
    const haptic = options?.haptic ?? true;

    // Optional native haptic pulse
    if (haptic && typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'click') {
          navigator.vibrate(15);
        } else if (type === 'bip') {
          navigator.vibrate(30);
        } else if (type === 'success') {
          navigator.vibrate([40, 40, 80]);
        } else if (type === 'error') {
          navigator.vibrate([80, 50, 80, 50, 120]);
        } else if (type === 'warning') {
          navigator.vibrate([60, 40, 60]);
        }
      } catch {
        // Haptic might be restricted by user agent policy
      }
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      switch (type) {
        case 'click': {
          // Tactile mechanical micro-click (fast high transient decay)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1400, t);
          osc.frequency.exponentialRampToValueAtTime(300, t + 0.015);
          gain.gain.setValueAtTime(volume * 0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.02);
          break;
        }

        case 'bip': {
          // Clean standard scanner / encoder pulse (1760 Hz [A6], 60ms)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1760, t);
          gain.gain.setValueAtTime(volume * 0.9, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.07);
          break;
        }

        case 'success': {
          // Harmonious ascending success chime (D5 -> A5 -> D6)
          const notes = [
            { freq: 587.33, delay: 0, dur: 0.09 },
            { freq: 880.0, delay: 0.08, dur: 0.12 },
            { freq: 1174.66, delay: 0.17, dur: 0.22 },
          ];

          notes.forEach(({ freq, delay, dur }) => {
            const start = t + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(volume * 0.9, start);
            gain.gain.exponentialRampToValueAtTime(0.005, start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + dur + 0.02);
          });
          break;
        }

        case 'error': {
          // Distinct descending alert buzzer (440 Hz -> 310 Hz -> 220 Hz sawtooth)
          const pulses = [
            { freq: 440, delay: 0, dur: 0.12 },
            { freq: 330, delay: 0.13, dur: 0.12 },
            { freq: 220, delay: 0.26, dur: 0.22 },
          ];

          pulses.forEach(({ freq, delay, dur }) => {
            const start = t + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(volume * 0.85, start);
            gain.gain.exponentialRampToValueAtTime(0.005, start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + dur + 0.02);
          });
          break;
        }

        case 'warning': {
          // Dual caution beep (750 Hz)
          [0, 0.12].forEach((delay) => {
            const start = t + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(750, start);
            gain.gain.setValueAtTime(volume * 0.8, start);
            gain.gain.exponentialRampToValueAtTime(0.005, start + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.09);
          });
          break;
        }
      }
    } catch (e) {
      console.warn('[AudioFeedback] Playback skipped:', e);
    }
  }
}

export const audioFeedbackService = new GlobalAudioFeedbackService();

/**
 * Universal Audio Feedback Functions for application-wide use
 */
export function playAudioFeedback(type: AudioFeedbackType, options?: AudioFeedbackOptions): void {
  audioFeedbackService.play(type, options);
}

export function playSuccessFeedback(options?: AudioFeedbackOptions): void {
  audioFeedbackService.play('success', options);
}

export function playErrorFeedback(options?: AudioFeedbackOptions): void {
  audioFeedbackService.play('error', options);
}

export function playClickFeedback(options?: AudioFeedbackOptions): void {
  audioFeedbackService.play('click', options);
}

export function playBipFeedback(options?: AudioFeedbackOptions): void {
  audioFeedbackService.play('bip', options);
}

export function playWarningFeedback(options?: AudioFeedbackOptions): void {
  audioFeedbackService.play('warning', options);
}

// Attach to window in browser environment for direct console or global event access
if (typeof window !== 'undefined') {
  (window as any).playAudioFeedback = playAudioFeedback;
  (window as any).playSuccessFeedback = playSuccessFeedback;
  (window as any).playErrorFeedback = playErrorFeedback;
  (window as any).playClickFeedback = playClickFeedback;
  (window as any).playBipFeedback = playBipFeedback;
}
