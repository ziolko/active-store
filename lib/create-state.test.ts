import { expect, describe, it, jest } from "@jest/globals";
import { createState } from "./create-state";
import { Topic, execute } from "./core";

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

  it("Registers topics when run", () => {
    const state = createState("test-value");
    const { topics } = execute(() => state.get());
    expect(topics.size).toEqual(1);
  });

  it("Notifies registered subscriber and update version when value changed", () => {
    const state = createState("test-value");
    const { topics } = execute(() => state.get());
    const topic: Topic = topics.values().next().value;

    const listener = jest.fn();
    const version = topic.getVersion!();
    topic.subscribe(listener);
    state.set("another-value");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(topic.getVersion!()).toBe(version + 1);
  });

  it("Doesn't notify subscribers if new and old values are equal", () => {
    const state = createState("test-value");
    const { topics } = execute(() => state.get());
    const topic: Topic = topics.values().next().value;

    const listener = jest.fn();
    topic.subscribe(listener);
    const version = topic.getVersion!();

    state.set("test-value");
    expect(listener).toHaveBeenCalledTimes(0);
    expect(topic.getVersion!()).toBe(version);
  });
});
