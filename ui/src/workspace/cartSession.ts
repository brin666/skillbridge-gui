import { asError, WorkspaceError, type WorkspaceApi } from "./api";
import type { Cart, CartContext } from "./types";

export interface CartState {
  cart: Cart | null;
  pending: string[];
  blocked: boolean;
  locked: boolean;
  error: WorkspaceError | null;
}
/** A transport coordinator, not a second cart store: every committed value comes from HTTP. */
export class CartSession {
  private state: CartState = {
    cart: null,
    pending: [],
    blocked: false,
    locked: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  constructor(private api: WorkspaceApi) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private emit(patch: Partial<CartState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  setCart(cart: Cart | null) {
    if (this.state.pending.length)
      throw new Error("Wait for pending cart writes before switching.");
    this.epoch++;
    this.emit({ cart, blocked: false, error: null });
  }
  lock(locked: boolean) {
    this.emit({ locked });
  }
  invalidate() {
    this.epoch++;
    this.emit({
      cart: null,
      pending: [],
      blocked: true,
      locked: true,
      error: new WorkspaceError({ code: "PROFILE_CHANGED" }),
    });
  }
  settled = async () => {
    await this.tail;
    if (this.state.blocked) throw new WorkspaceError({ code: "QUEUE_PAUSED" });
    return this.state.cart;
  };
  async reconcile(error: WorkspaceError) {
    this.epoch++;
    this.emit({ blocked: true, error });
    if (this.state.cart) {
      try {
        this.emit({ cart: await this.api.cart(this.state.cart.id) });
      } catch (refreshError) {
        this.emit({ error: asError(refreshError) });
      }
    }
  }
  async acknowledge() {
    if (!this.state.cart) return;
    const cart = await this.api.cart(this.state.cart.id);
    this.emit({ cart, blocked: false, error: null });
  }
  private enqueue(key: string, operation: (cart: Cart) => Promise<Cart>) {
    if (this.state.blocked)
      return Promise.reject(new WorkspaceError({ code: "QUEUE_PAUSED" }));
    if (this.state.locked)
      return Promise.reject(new WorkspaceError({ code: "CART_LOCKED" }));
    if (this.state.pending.includes(key))
      return Promise.reject(
        new WorkspaceError({
          code: "WRITE_PENDING",
          message: "此条目正在保存",
        }),
      );
    const epoch = this.epoch;
    this.emit({ pending: [...this.state.pending, key] });
    const task = this.tail
      .then(async () => {
        if (epoch !== this.epoch || this.state.blocked)
          throw new WorkspaceError({ code: "QUEUE_PAUSED" });
        if (!this.state.cart) throw new WorkspaceError({ code: "NOT_FOUND" });
        try {
          const cart = await operation(this.state.cart);
          if (epoch !== this.epoch)
            throw new WorkspaceError({ code: "QUEUE_PAUSED" });
          this.emit({ cart, error: null });
          return cart;
        } catch (error) {
          if (epoch !== this.epoch)
            throw new WorkspaceError({ code: "QUEUE_PAUSED" });
          const failure = asError(error);
          await this.reconcile(failure);
          throw failure;
        }
      })
      .finally(() =>
        this.emit({
          pending: this.state.pending.filter((item) => item !== key),
        }),
      );
    this.tail = task.catch(() => undefined);
    return task;
  }
  add(assetId: string, revisionId: string, purpose = "") {
    return this.enqueue(assetId, (cart) =>
      this.api.add(cart.id, cart.version, assetId, revisionId, purpose),
    );
  }
  remove(assetId: string) {
    return this.enqueue(assetId, (cart) =>
      this.api.remove(cart.id, cart.version, assetId),
    );
  }
  clear() {
    return this.enqueue("clear", (cart) =>
      this.api.clear(cart.id, cart.version),
    );
  }
  edit(context: Partial<CartContext>) {
    return this.enqueue("context", (cart) =>
      this.api.editCart(cart.id, cart.version, context),
    );
  }
}
