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
    const state = activeState("test-value");
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
});
