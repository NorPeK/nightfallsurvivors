// One movement intent for keyboard, mouse, pen and touch.
export const JOYSTICK_RADIUS = 56;
export const JOYSTICK_DEAD_ZONE = 8;
export interface JoystickState { active: boolean; originX: number; originY: number; stickX: number; stickY: number }
export class Input {
  keys = new Set<string>();
  joystick: JoystickState = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0 };
  onPause: (() => void) | null = null;
  onDeviceChange: ((device: "keyboard" | "pointer") => void) | null = null;
  private pointerId: number | null = null;
  private el: HTMLElement | null = null;
  private enabled = true;
  private mode: "floating" | "fixed" = "floating";
  private side: "left" | "right" = "left";
  configure(mode: "floating" | "fixed", side: "left" | "right") { this.mode = mode; this.side = side; }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.reset(); }
  reset = () => {
    this.keys.clear();
    const pointerId = this.pointerId;
    this.pointerId = null;
    this.joystick.active = false;
    if (pointerId !== null && this.el?.hasPointerCapture?.(pointerId)) this.el.releasePointerCapture(pointerId);
  };
  private kd = (e: KeyboardEvent) => {
    if (e.target instanceof Element && e.target.closest("input,select,textarea,[contenteditable=true]")) return;
    const k = e.key.toLowerCase();
    if (k === "escape" || k === "p") { if (!e.repeat) this.onPause?.(); return; }
    if (!this.enabled || !["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) return;
    e.preventDefault();
    this.keys.add(k);
    this.onDeviceChange?.("keyboard");
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private pd = (e: PointerEvent) => {
    if (!this.enabled || this.pointerId !== null || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-ui]")) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.el?.setPointerCapture(e.pointerId);
    const rect = this.el!.getBoundingClientRect();
    const fixed = this.mode === "fixed" && e.pointerType !== "mouse";
    this.joystick = { active: true,
      originX: fixed ? (this.side === "left" ? rect.left + 86 : rect.right - 86) : e.clientX,
      originY: fixed ? rect.bottom - 100 : e.clientY, stickX: e.clientX, stickY: e.clientY };
    this.onDeviceChange?.("pointer");
  };
  private pm = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.joystick.stickX = e.clientX; this.joystick.stickY = e.clientY;
  };
  private pu = (e: PointerEvent) => { if (e.pointerId === this.pointerId) this.reset(); };
  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.kd); window.addEventListener("keyup", this.ku); window.addEventListener("blur", this.reset);
    el.addEventListener("pointerdown", this.pd); el.addEventListener("pointermove", this.pm);
    el.addEventListener("pointerup", this.pu); el.addEventListener("pointercancel", this.pu); el.addEventListener("lostpointercapture", this.pu);
  }
  detach() {
    this.reset();
    window.removeEventListener("keydown", this.kd); window.removeEventListener("keyup", this.ku); window.removeEventListener("blur", this.reset);
    this.el?.removeEventListener("pointerdown", this.pd); this.el?.removeEventListener("pointermove", this.pm);
    this.el?.removeEventListener("pointerup", this.pu); this.el?.removeEventListener("pointercancel", this.pu); this.el?.removeEventListener("lostpointercapture", this.pu);
    this.el = null;
  }
  getMove(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
    let y = Number(this.keys.has("s") || this.keys.has("arrowdown")) - Number(this.keys.has("w") || this.keys.has("arrowup"));
    if (!x && !y && this.joystick.active) {
      const dx = this.joystick.stickX - this.joystick.originX, dy = this.joystick.stickY - this.joystick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > JOYSTICK_DEAD_ZONE) {
        const magnitude = Math.min(1, (distance - JOYSTICK_DEAD_ZONE) / (JOYSTICK_RADIUS - JOYSTICK_DEAD_ZONE));
        x = dx / distance * magnitude; y = dy / distance * magnitude;
      }
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }
}
