// Keyboard (WASD / arrows) + floating virtual joystick for touch.
// The joystick appears wherever the player touches (VS mobile style).

export interface JoystickState {
  active: boolean;
  originX: number;
  originY: number;
  stickX: number;
  stickY: number;
}

export class Input {
  keys = new Set<string>();
  joystick: JoystickState = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0 };
  private touchId: number | null = null;
  onPause: (() => void) | null = null;
  private el: HTMLElement | null = null;

  private kd = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === "escape" || k === "p") this.onPause?.();
  };
  private ku = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private blur = () => this.keys.clear();

  private ts = (e: TouchEvent) => {
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    // ignore touches on UI controls (buttons etc.)
    const target = t.target as HTMLElement;
    if (target.closest("[data-ui]")) return;
    e.preventDefault();
    this.touchId = t.identifier;
    this.joystick.active = true;
    this.joystick.originX = t.clientX;
    this.joystick.originY = t.clientY;
    this.joystick.stickX = t.clientX;
    this.joystick.stickY = t.clientY;
  };
  private tm = (e: TouchEvent) => {
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        e.preventDefault();
        this.joystick.stickX = t.clientX;
        this.joystick.stickY = t.clientY;
      }
    }
  };
  private te = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.joystick.active = false;
      }
    }
  };

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("blur", this.blur);
    el.addEventListener("touchstart", this.ts, { passive: false });
    el.addEventListener("touchmove", this.tm, { passive: false });
    el.addEventListener("touchend", this.te);
    el.addEventListener("touchcancel", this.te);
  }

  detach() {
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    window.removeEventListener("blur", this.blur);
    if (this.el) {
      this.el.removeEventListener("touchstart", this.ts);
      this.el.removeEventListener("touchmove", this.tm);
      this.el.removeEventListener("touchend", this.te);
      this.el.removeEventListener("touchcancel", this.te);
    }
  }

  /** Normalized movement vector (-1..1 per axis, magnitude <= 1). */
  getMove(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;

    if (x === 0 && y === 0 && this.joystick.active) {
      const dx = this.joystick.stickX - this.joystick.originX;
      const dy = this.joystick.stickY - this.joystick.originY;
      const dist = Math.hypot(dx, dy);
      const dead = 8;
      if (dist > dead) {
        const max = 56;
        const mag = Math.min(1, (dist - dead) / max);
        x = (dx / dist) * mag;
        y = (dy / dist) * mag;
      }
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
