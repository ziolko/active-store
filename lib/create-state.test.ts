import { expect, describe, it, jest } from "@jest/globals";
import createState from "./create-state";
import { Signal, execute } from "./core";

describe("createState", () => {
  it("Returns initial value", () => {
    const state = createState("test-value");
    expect(state.get()).toEqual("test-value");
  });

  it("Updates stored value", () => {
    const state = createState("test-value");
    state.set("another-value");
    expect(state.get()).toEqual("another-value");
  });

  it("Registers signals when run", () => {
    const state = createState("test-value");
    const { signals } = execute(() => state.get());
    expect(signals.size).toEqual(1);
  });

  it("Notifies registered subscriber and update version when value changed", () => {
    const state = createState("test-value");
    const { signals } = execute(() => state.get());
    const signal: Signal = signals.values().next().value;

    const listener = jest.fn();
    const version = signal.getVersion!();
    signal.subscribe(listener);
    state.set("another-value");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(signal.getVersion!()).toBe(version + 1);
  });

  it("Doesn't notify subscribers if new and old values are equal", () => {
    const state = createState("test-value");
    const { signals } = execute(() => state.get());
    const signal: Signal = signals.values().next().value;

    const listener = jest.fn();
    signal.subscribe(listener);
    const version = signal.getVersion!();

    state.set("test-value");
    expect(listener).toHaveBeenCalledTimes(0);
    expect(signal.getVersion!()).toBe(version);
  });
});
