/** Tiny bounded set used for webhook message de-duplication. */
export class BoundedSet<T> {
  private readonly items = new Set<T>();

  constructor(private readonly capacity: number) {}

  /** Returns false when the value was already present. */
  add(value: T): boolean {
    if (this.items.has(value)) return false;
    this.items.add(value);
    if (this.items.size > this.capacity) {
      const oldest = this.items.values().next();
      if (!oldest.done) this.items.delete(oldest.value);
    }
    return true;
  }
}
