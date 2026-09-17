export type MessageRealtimeEvent<T> = {
  id: number;
  unitId: string;
  type: 'snapshot' | 'qr' | 'connection' | 'progress' | 'alert';
  data: T;
};

type Listener<T> = (event: MessageRealtimeEvent<T>) => void;

export class MessageRealtimeBroker<T> {
  private readonly sequences = new Map<string, number>();
  private readonly listeners = new Map<string, Set<Listener<T>>>();

  currentCursor(unitId: string) { return this.sequences.get(unitId) || 0; }

  publish(unitId: string, type: MessageRealtimeEvent<T>['type'], data: T) {
    const event = { id: this.currentCursor(unitId) + 1, unitId, type, data } satisfies MessageRealtimeEvent<T>;
    this.sequences.set(unitId, event.id);
    this.listeners.get(unitId)?.forEach(listener => listener(event));
    return event;
  }

  snapshot(unitId: string, data: T) {
    return { id: this.currentCursor(unitId), unitId, type: 'snapshot', data } satisfies MessageRealtimeEvent<T>;
  }

  subscribe(unitId: string, listener: Listener<T>) {
    const scoped = this.listeners.get(unitId) || new Set<Listener<T>>();
    scoped.add(listener);
    this.listeners.set(unitId, scoped);
    return () => {
      scoped.delete(listener);
      if (!scoped.size) this.listeners.delete(unitId);
    };
  }
}

export function encodeSseEvent<T>(event: MessageRealtimeEvent<T>) {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
