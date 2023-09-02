import { expect, describe, it, jest } from "@jest/globals";
import { createSignal as createSignal, execute } from "./core";

describe("createSignal", () => {
  it("Calls subscribed function", () => {
    const listener = jest.fn();
    const signal = createSignal();
    signal.subscribe(listener);
    signal.notify();
    expect(listener).toBeCalledTimes(1);
  });

  it("Doesn't call subscribed function if unsubscribed", () => {
    const listener = jest.fn();
    const signal = createSignal();
    const unsubscribe = signal.subscribe(listener);
    unsubscribe();
    signal.notify();
    expect(listener).not.toBeCalled();
  });
});

describe("execute", () => {
  it("Returns value from selector", () => {
    const { value } = execute(() => "test-value");
    expect(value).toEqual("test-value");
  });

  it("Returns registered signal from selector", () => {
    const signal = createSignal({ getVersion: () => 1 });
    const { signals } = execute(() => execute.current.register(signal));
    expect(signals.size).toEqual(1);
    expect(signals.values().next().value.getVersion()).toEqual(1);
  });

  it("Registers the same signal once even if registered multiple times", () => {
    const signal = createSignal();
    const { signals } = execute(() => {
      execute.current.register(signal);
      execute.current.register(signal);
      execute.current.register(signal);
    });
    expect(signals.size).toEqual(1);
  });

  it("Handles exceptions gracefully", () => {
    const testSignalSet = new Set<any>();
    execute.current.signals = testSignalSet;

    function selector() {
      throw new Error("test-error");
    }

    expect(() => execute(selector)).toThrow();
    expect(execute.current.signals).toBe(testSignalSet);
  });
});
