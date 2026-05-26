/**
 * Web Speech API wrapper — free TTS + STT, zero API costs.
 *
 * Speech Synthesis (TTS): widely supported (Chrome/Edge/Safari/Firefox).
 * Speech Recognition (STT): Chrome/Edge primarily; Safari is patchy.
 *
 * All methods are no-ops on unsupported browsers; callers should check
 * isSupported()/isRecognitionSupported() before showing the UI button.
 */

// Speech Recognition typings — TS DOM lib doesn't ship these natively.
type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => RecognitionInstance;
    webkitSpeechRecognition?: new () => RecognitionInstance;
  }
}

function getRecognitionCtor(): (new () => RecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function langTag(language: 'ar' | 'en'): string {
  return language === 'ar' ? 'ar-SA' : 'en-US';
}

export class WebSpeech {
  /**
   * Is browser TTS available? Some Linux/older browsers don't ship the API.
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Is browser STT available? Chrome/Edge yes, Firefox no, Safari spotty.
   */
  static isRecognitionSupported(): boolean {
    return getRecognitionCtor() !== null;
  }

  /**
   * Return available voices for a language. May be empty until the voices
   * list finishes loading async — caller can listen to
   * window.speechSynthesis.onvoiceschanged to retry.
   */
  static getVoices(language: 'ar' | 'en'): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    const all = window.speechSynthesis.getVoices();
    const prefix = language === 'ar' ? 'ar' : 'en';
    return all.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
  }

  /**
   * Speak `text` using the best-available voice for `language`. Idempotent:
   * cancels any in-flight utterance before starting the new one.
   */
  static speak(
    text: string,
    language: 'ar' | 'en',
    pitch: number = 1.0,
    rate: number = 1.0,
    onEnd?: () => void
  ): void {
    if (!this.isSupported() || !text.trim()) {
      onEnd?.();
      return;
    }
    // Cancel anything currently being spoken — avoids stacking
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langTag(language);
    utter.pitch = Math.max(0, Math.min(2, pitch));
    utter.rate = Math.max(0.1, Math.min(10, rate));
    utter.volume = 1.0;

    const voices = this.getVoices(language);
    if (voices.length) {
      // Prefer a non-default Saudi/Arabic voice if available
      utter.voice = voices.find((v) => v.lang === langTag(language)) || voices[0];
    }

    if (onEnd) {
      utter.onend = () => onEnd();
      utter.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utter);
  }

  /**
   * Stop any in-flight speech.
   */
  static stop(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
  }

  /**
   * Is something currently being spoken?
   */
  static isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  /**
   * Start a continuous-listening session. Calls `onResult` with the
   * cumulative recognised text as the user speaks. Returns the underlying
   * recognition instance so the caller can stop it.
   *
   * Returns null on unsupported browsers.
   */
  static startListening(
    language: 'ar' | 'en',
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (err: string) => void
  ): RecognitionInstance | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onError?.('not_supported');
      return null;
    }
    const rec = new Ctor();
    rec.lang = langTag(language);
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const combined = (final + interim).trim();
      if (combined) onResult(combined, !!final && !interim);
    };

    rec.onerror = (event: any) => {
      onError?.(event?.error || 'unknown_error');
    };

    try {
      rec.start();
    } catch (err: any) {
      onError?.(err?.message || 'start_failed');
      return null;
    }

    return rec;
  }

  /**
   * Stop a previously-started recognition session.
   */
  static stopListening(rec: RecognitionInstance | null): void {
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
  }
}
