import { expect, describe, it, jest } from "@jest/globals";
import createState from "./create-state";
import { Effect, execute } from "./core";

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

  it("Registers side effect when run", () => {
    const state = createState("test-value");
    const { effects } = execute(() => state.get());
    expect(effects.size).toEqual(1);
  });

  it("Notifies registered subscriber and update version when value changed", () => {
    const state = createState("test-value");
    const { effects } = execute(() => state.get());
    const effect: Effect = effects.values().next().value;

    const listener = jest.fn();
    const version = effect.getVersion!();
    effect.subscribe(listener);
    state.set("another-value");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(effect.getVersion!()).toBe(version + 1);
  });

  it("Doesn't notify subscribers if new and old values are equal", () => {
    const state = createState("test-value");
    const { effects } = execute(() => state.get());
    const effect: Effect = effects.values().next().value;

    const listener = jest.fn();
    effect.subscribe(listener);
    const version = effect.getVersion!();

    state.set("test-value");
    expect(listener).toHaveBeenCalledTimes(0);
    expect(effect.getVersion!()).toBe(version);
  });
});
