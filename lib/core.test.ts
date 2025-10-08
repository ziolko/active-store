import { expect, describe, it, jest } from "@jest/globals";
import { activeTopic, compute } from "./core";
import { activeAsync } from "./create-query";

describe("createTopic", () => {
  it("Calls subscribed function", () => {
    const listener = jest.fn();
    let notifyTopic: () => void;
    const state = activeTopic(
      () => 1,
      (notify) => (notifyTopic = notify)
    );
    state.subscribe(listener);
    notifyTopic!();
    expect(listener).toBeCalledTimes(1);
  });

  it("Doesn't call subscribed function if unsubscribed", () => {
    const listener = jest.fn();
    let notifyTopic: () => void;
    const state = activeTopic(
      () => 1,
      (notify) => (notifyTopic = notify)
    );
    const unsubscribe = state.subscribe(listener);
    unsubscribe();
    notifyTopic!();
    expect(listener).not.toBeCalled();
  });

  it("Throws error if get callback returns different object each time", () => {
    const state = activeTopic(
      () => ({}),
      () => () => null
    );

    expect(() => state.get()).toThrow();
  });
});

describe("compute", () => {
  it("Returns value from selector", () => {
    const { value } = compute(() => "test-value");
    expect(value).toEqual("test-value");
  });

  it("Returns registered dependency from selector", () => {
    const state = activeTopic(
      () => 1,
      () => () => null
    );
    const { dependencies } = compute(() => state.get());
    expect(dependencies.size).toEqual(1);
    expect(dependencies.values().next().value!.get()).toEqual(1);
  });

  it("Registers the same dependency once even if registered multiple times", () => {
    const state = activeTopic(
      () => 1,
      () => () => null
    );
    const { dependencies } = compute(() => {
      state.get();
      state.get();
      state.get();
    });
    expect(dependencies.size).toEqual(1);
  });

  it("Handles exceptions gracefully", () => {
    function selector() {
      throw new Error("test-error");
    }

    expect(compute(selector).error).not.toBeFalsy();
  });
});

