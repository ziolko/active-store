import { expect, describe, it, jest } from "@jest/globals";
import {
  createDependencySignal as createDependencySignal,
  execute,
} from "./core";

describe("createDependencySignal", () => {
  it("Calls subscribed function", () => {
    const listener = jest.fn();
    const dependency = createDependencySignal();
    dependency.subscribe(listener);
    dependency.notify();
    expect(listener).toBeCalledTimes(1);
  });

  it("Doesn't call subscribed function if unsubscribed", () => {
    const listener = jest.fn();
    const effect = createDependencySignal();
    const unsubscribe = effect.subscribe(listener);
    unsubscribe();
    effect.notify();
    expect(listener).not.toBeCalled();
  });
});

describe("execute", () => {
  it("Returns value from selector", () => {
    const { value } = execute(() => "test-value");
    expect(value).toEqual("test-value");
  });

  it("Returns registered effect from selector", () => {
    const effect = createDependencySignal({ getVersion: () => 1 });
    const { effects } = execute(() => execute.current.register(effect));
    expect(effects.size).toEqual(1);
    expect(effects.values().next().value.getVersion()).toEqual(1);
  });

  it("Registers the same effect once even if registered multiple times", () => {
    const effect = createDependencySignal();
    const { effects } = execute(() => {
      execute.current.register(effect);
      execute.current.register(effect);
      execute.current.register(effect);
    });
    expect(effects.size).toEqual(1);
  });

  it("Handles exceptions gracefully", () => {
    const testEffectsSet = new Set<any>();
    execute.current.effects = testEffectsSet;

    function selector() {
      throw new Error("test-error");
    }

    expect(() => execute(selector)).toThrow();
    expect(execute.current.effects).toBe(testEffectsSet);
  });
});
