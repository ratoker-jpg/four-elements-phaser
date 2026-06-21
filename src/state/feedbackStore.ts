/**
 * Feedback store — typed feedback/message model for the RTS HUD.
 * FEEDBACK-ALERTS-06: Small, reliable feedback layer.
 */

// Types
export type FeedbackSeverity = 'info' | 'success' | 'warning' | 'error';

export interface FeedbackMessage {
  id: number;
  type: FeedbackSeverity;
  message: string;
  code?: string;           // e.g. 'insufficient-matter', 'empty-group'
  tileTarget?: { tx: number; ty: number };  // for minimap ping
  duration: number;        // ms, default 4000
  dedupeKey?: string;      // for throttling repeated messages
  timestamp: number;
}

export class FeedbackStore {
  private messages: FeedbackMessage[] = [];
  private nextId = 1;
  private dedupeCooldowns: Map<string, number> = new Map();
  
  // Dedupe window: if same dedupeKey within this window, suppress
  private static DEDUPE_WINDOW_MS = 2000;
  private static MAX_MESSAGES = 5;
  
  addFeedback(params: {
    type: FeedbackSeverity;
    message: string;
    code?: string;
    tileTarget?: { tx: number; ty: number };
    duration?: number;
    dedupeKey?: string;
  }): FeedbackMessage | null {
    const now = Date.now();
    
    // Dedupe check
    if (params.dedupeKey) {
      const lastTime = this.dedupeCooldowns.get(params.dedupeKey);
      if (lastTime && (now - lastTime) < FeedbackStore.DEDUPE_WINDOW_MS) {
        return null; // suppressed
      }
      this.dedupeCooldowns.set(params.dedupeKey, now);
    }
    
    const msg: FeedbackMessage = {
      id: this.nextId++,
      type: params.type,
      message: params.message,
      code: params.code,
      tileTarget: params.tileTarget,
      duration: params.duration ?? 4000,
      dedupeKey: params.dedupeKey,
      timestamp: now,
    };
    
    this.messages.push(msg);
    
    // Trim old messages
    while (this.messages.length > FeedbackStore.MAX_MESSAGES) {
      this.messages.shift();
    }
    
    return msg;
  }
  
  /** Remove messages that have expired (timestamp + duration < now). */
  expireMessages(): void {
    const now = Date.now();
    this.messages = this.messages.filter(m => now - m.timestamp < m.duration);
    // Also clean up old dedupe cooldowns
    for (const [key, time] of this.dedupeCooldowns) {
      if (now - time > FeedbackStore.DEDUPE_WINDOW_MS * 2) {
        this.dedupeCooldowns.delete(key);
      }
    }
  }
  
  getMessages(): readonly FeedbackMessage[] {
    return this.messages;
  }
  
  getCurrentMessage(): FeedbackMessage | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
  }
  
  clear(): void {
    this.messages = [];
  }
}
