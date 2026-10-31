/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Encoder Audio & Hardware Buzzer Engine
 * Fournit le retour sonore officiel pour l'encodeur de serrures proUSB :
 * - Bip de succès : tonalité montante claire et mélodieuse (1800 Hz -> 2400 Hz) + impulsion buzzer USB
 * - Sonnerie d'échec : alarme staccato descendante distincte (480 Hz -> 360 Hz -> 240 Hz) + 3 bips d'alerte USB
 */

import { buzzer } from '../protocol/commands';
import { LockTransport } from '../protocol/transport';

class EncoderAudioService {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtxClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Bip sonore de réussite (Web Audio) :
   * Tonalité claire, positive et mélodieuse simulant le retour de programmation valide.
   */
  public playSuccessSound(): void {
    try {
      const audio = this.getAudioContext();
      if (!audio) return;
      const t = audio.currentTime;

      // Note 1 : 1800 Hz (80ms)
      const osc1 = audio.createOscillator();
      const gain1 = audio.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1800, t);
      gain1.gain.setValueAtTime(0.2, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc1.connect(gain1);
      gain1.connect(audio.destination);
      osc1.start(t);
      osc1.stop(t + 0.08);

      // Note 2 : 2400 Hz (tonalité d'acquittement lock) (150ms)
      const osc2 = audio.createOscillator();
      const gain2 = audio.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2400, t + 0.09);
      gain2.gain.setValueAtTime(0.25, t + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.005, t + 0.28);
      osc2.connect(gain2);
      gain2.connect(audio.destination);
      osc2.start(t + 0.09);
      osc2.stop(t + 0.28);
    } catch (e) {
      console.warn('[EncoderAudio] Failed to play success sound:', e);
    }
  }

  /**
   * Sonnerie d'échec (Web Audio) :
   * Motif d'alerte / sonnerie d'erreur bien distincte (3 impulsions descendantes avertissantes).
   */
  public playFailureRingtone(): void {
    try {
      const audio = this.getAudioContext();
      if (!audio) return;
      const t = audio.currentTime;

      // 3 bips d'alarme alertants et discordants (480Hz -> 360Hz -> 240Hz)
      const tones = [
        { freq: 480, delay: 0, dur: 0.12 },
        { freq: 360, delay: 0.15, dur: 0.12 },
        { freq: 240, delay: 0.30, dur: 0.22 },
      ];

      tones.forEach(({ freq, delay, dur }) => {
        const start = t + delay;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sawtooth'; // Tonalité rêche d'alerte indubitable
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch (e) {
      console.warn('[EncoderAudio] Failed to play failure ringtone:', e);
    }
  }

  /**
   * Déclenche à la fois le bip sonore Web Audio et le buzzer physique de l'encodeur pour une réussite.
   */
  public async notifySuccess(transport?: LockTransport | null): Promise<void> {
    this.playSuccessSound();

    if (transport && transport.isOpen()) {
      try {
        await transport.send(buzzer(1));
        await new Promise((r) => setTimeout(r, 260));
        await transport.send(buzzer(0));
      } catch (e) {
        console.warn('[EncoderAudio] Hardware success buzzer warning:', e);
      }
    }
  }

  /**
   * Déclenche à la fois la sonnerie d'alerte Web Audio et les impulsions d'échec du buzzer physique.
   */
  public async notifyFailure(transport?: LockTransport | null): Promise<void> {
    this.playFailureRingtone();

    if (transport && transport.isOpen()) {
      try {
        for (let i = 0; i < 3; i++) {
          await transport.send(buzzer(1));
          await new Promise((r) => setTimeout(r, 90));
          await transport.send(buzzer(0));
          if (i < 2) await new Promise((r) => setTimeout(r, 60));
        }
      } catch (e) {
        console.warn('[EncoderAudio] Hardware failure buzzer warning:', e);
      }
    }
  }
}

export const encoderAudio = new EncoderAudioService();
