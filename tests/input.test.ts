import { test } from "node:test";
import assert from "node:assert/strict";
import { Input, JOYSTICK_RADIUS, JOYSTICK_DEAD_ZONE } from "../app/game/input";

class Surface extends EventTarget {
  captured = new Set<number>();
  ui = false;
  closest(selector: string) { return this.ui && selector === "[data-ui]" ? this : null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 390, bottom: 844 }; }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
}
function event(type: string, fields: Record<string, unknown>) { return Object.assign(new Event(type, { cancelable: true }), fields); }
function setup() {
  const oldWindow = globalThis.window, oldElement = globalThis.Element;
  const windowTarget = new EventTarget(), surface = new Surface();
  Object.assign(globalThis, { window: windowTarget, Element: Surface });
  const input = new Input(); input.attach(surface as unknown as HTMLElement);
  return { input, surface, windowTarget, cleanup() { input.detach(); Object.assign(globalThis, { window: oldWindow, Element: oldElement }); } };
}

test("keyboard diagonal speed is normalized and held pause toggles once", () => {
  const f = setup(); try {
    let pauses = 0; f.input.onPause = () => pauses++;
    f.windowTarget.dispatchEvent(event("keydown", { key: "p", repeat: false }));
    f.windowTarget.dispatchEvent(event("keydown", { key: "p", repeat: true }));
    assert.equal(pauses, 1);
    for (const key of ["w", "d"]) f.windowTarget.dispatchEvent(event("keydown", { key, repeat: false }));
    const move = f.input.getMove(); assert.ok(Math.abs(Math.hypot(move.x, move.y) - 1) < 1e-9); assert.ok(move.y < 0);
  } finally { f.cleanup(); }
});
test("mouse capture follows outside drag, matches visual radius and resets on cancellation", () => {
  const f = setup(); try {
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 }));
    assert.ok(f.surface.captured.has(1));
    f.surface.dispatchEvent(event("pointermove", { pointerId: 1, clientX: 100 + JOYSTICK_DEAD_ZONE, clientY: 100 }));
    assert.deepEqual(f.input.getMove(), { x: 0, y: 0 });
    f.surface.dispatchEvent(event("pointermove", { pointerId: 1, clientX: 100 + JOYSTICK_RADIUS, clientY: 100 }));
    assert.deepEqual(f.input.getMove(), { x: 1, y: 0 });
    f.surface.dispatchEvent(event("pointercancel", { pointerId: 1 }));
    assert.deepEqual(f.input.getMove(), { x: 0, y: 0 }); assert.equal(f.surface.captured.size, 0);
  } finally { f.cleanup(); }
});
test("UI controls and secondary pointers cannot steal gameplay movement", () => {
  const f = setup(); try {
    f.surface.ui = true;
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, clientX: 20, clientY: 100 }));
    assert.equal(f.input.joystick.active, false);
    f.surface.ui = false;
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, clientX: 20, clientY: 100 }));
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, clientX: 200, clientY: 300 }));
    f.surface.dispatchEvent(event("pointerup", { pointerId: 2 }));
    assert.equal(f.input.joystick.active, true); assert.equal(f.input.joystick.originX, 20);
    f.windowTarget.dispatchEvent(new Event("blur")); assert.equal(f.input.joystick.active, false);
  } finally { f.cleanup(); }
});
test("disabled input cannot move and fixed joystick honors handedness", () => {
  const f = setup(); try {
    f.input.configure("fixed", "right");
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, clientX: 304, clientY: 744 }));
    assert.equal(f.input.joystick.originX, 304); assert.equal(f.input.joystick.originY, 744);
    f.input.setEnabled(false);
    f.windowTarget.dispatchEvent(event("keydown", { key: "d", repeat: false }));
    assert.deepEqual(f.input.getMove(), { x: 0, y: 0 }); assert.equal(f.input.joystick.active, false);
  } finally { f.cleanup(); }
});
