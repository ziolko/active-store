import { expect, describe, it, jest } from "@jest/globals";
import { activeState } from "./create-state";
import { Dependency, compute } from "./core";

describe("createState", () => {
  it("Returns initial value", () => {
    const state = activeState("test-value");
    expect(state.get()).toEqual("test-value");
  });

  it("Updates stored value", () => {
    const state = activeState("test-value");
    state.set("another-value");
    expect(state.get()).toEqual("another-value");
  });

  it("Registers topics when run", () => {
    const state = activeState("test-value");
    const { dependencies } = compute(() => state.get());
    expect(dependencies.size).toEqual(1);
  });

  it("Notifies registered subscriber and update version when value changed", () => {
    const state = activeState("test-value" as string | number);
    const { dependencies: topics } = compute(() => state.get());
    const topic: Dependency = topics.values().next().value;

    const listener = jest.fn();
    const version = topic.get!();
    topic.subscribe(listener);
    state.set("another-value");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(topic.get!()).toBe("another-value");
  });

  it("Doesn't notify subscribers if new and old values are equal", () => {
    const state = activeState("test-value");
    const { dependencies: topics } = compute(() => state.get());
    const topic: Dependency = topics.values().next().value;

    const listener = jest.fn();
    topic.subscribe(listener);
    const version = topic.get!();

    state.set("test-value");
    expect(listener).toHaveBeenCalledTimes(0);
    expect(topic.get!()).toBe(version);
  });

  it("Returns initial value for function initializer", () => {
    const state = activeState((x: number) => x * 2);
    expect(state.get(10)).toEqual(20);
  });

  it("Sets stored value for function initializer", () => {
    const state = activeState((x: number) => x * 2);
    state.set(100, 10);
    expect(state.get(10)).toEqual(100);
  });

  it("Updates stored value for function initializer", () => {
    const state = activeState((x: number) => x * 2);
    expect(state.get(10)).toEqual(20);
    state.set(100, 10);
    expect(state.get(10)).toEqual(100);
  });

  it("Calls onSubscribe when subscribed for function initializer", () => {
    const listener = jest.fn(() => null);
    const onUnsubscribe = jest.fn(() => null);
    const onSubscribe = jest.fn((x: number) => onUnsubscribe);
    const state = activeState((x: number) => x * 2, {
      onSubscribe,
    });

    const unsubscribe = state.subscribe(listener, 10);

    expect(listener).toHaveBeenCalledTimes(0);
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);

    state.set(100, 10);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).toHaveBeenCalledTimes(0);

    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);

    state.set(200, 10);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("Doesn't notify subscribers with function initializer when new and old values are equal", () => {
    const state = activeState((id: number) => (id * 2) as string | number);
    const onChange = jest.fn(() => null);
    const unsubscribe = state.subscribe(onChange, 10);

    state.set(20, 10);
    expect(onChange).toHaveBeenCalledTimes(0);

    state.set(30, 10);
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
