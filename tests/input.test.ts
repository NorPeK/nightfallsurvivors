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

test("platform Escape and browser shortcuts remain available without moving the hunter", () => {
  const f = setup(); try {
    let pauses = 0; f.input.onPause = () => pauses++;
    f.input.escapePauses = false;
    const escape = event("keydown", { key: "Escape", repeat: false });
    f.windowTarget.dispatchEvent(escape);
    assert.equal(pauses, 0); assert.equal(escape.defaultPrevented, false);
    for (const modifier of ["metaKey", "ctrlKey", "altKey", "isComposing"]) {
      const shortcut = event("keydown", { key: "w", repeat: false, [modifier]: true });
      f.windowTarget.dispatchEvent(shortcut);
      assert.equal(shortcut.defaultPrevented, false);
      assert.deepEqual(f.input.getMove(), { x: 0, y: 0 });
    }
    f.windowTarget.dispatchEvent(event("keydown", { key: "p", repeat: false }));
    assert.equal(pauses, 1, "P remains available when the platform owns Escape");
    f.input.escapePauses = true;
    f.windowTarget.dispatchEvent(event("keydown", { key: "Escape", repeat: false }));
    assert.equal(pauses, 2, "browser builds retain the Escape shortcut");
  } finally { f.cleanup(); }
});

test("orientation or viewport changes release captured movement before the new camera geometry", () => {
  const f = setup(); try {
    f.surface.dispatchEvent(event("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, clientX: 100, clientY: 100 }));
    f.surface.dispatchEvent(event("pointermove", { pointerId: 1, clientX: 180, clientY: 100 }));
    assert.deepEqual(f.input.getMove(), { x: 1, y: 0 });
    f.windowTarget.dispatchEvent(new Event("resize"));
    assert.deepEqual(f.input.getMove(), { x: 0, y: 0 });
    assert.equal(f.surface.captured.size, 0);
    f.surface.dispatchEvent(event("pointermove", { pointerId: 1, clientX: 250, clientY: 100 }));
    assert.deepEqual(f.input.getMove(), { x: 0, y: 0 }, "stale pointer movement cannot revive the previous drag");
  } finally { f.cleanup(); }
});
