import { expect, describe, it, jest } from "@jest/globals";
import { createTopic as createTopic, compute } from "./core";

describe("createTopic", () => {
  it("Calls subscribed function", () => {
    const listener = jest.fn();
    const topic = createTopic(() => 1);
    topic.subscribe(listener);
    topic.notify();
    expect(listener).toBeCalledTimes(1);
  });

  it("Doesn't call subscribed function if unsubscribed", () => {
    const listener = jest.fn();
    const topic = createTopic(() => 1);
    const unsubscribe = topic.subscribe(listener);
    unsubscribe();
    topic.notify();
    expect(listener).not.toBeCalled();
  });
});

describe("execute", () => {
  it("Returns value from selector", () => {
    const { value } = compute(() => "test-value");
    expect(value).toEqual("test-value");
  });

  it("Returns registered topic from selector", () => {
    const topic = createTopic(() => 1);
    const { topics } = compute(() => topic.get());
    expect(topics.size).toEqual(1);
    expect(topics.values().next().value.get()).toEqual(1);
  });

  it("Registers the same topic once even if registered multiple times", () => {
    const topic = createTopic(() => 1);
    const { topics } = compute(() => {
      topic.get();
      topic.get();
      topic.get();
    });
    expect(topics.size).toEqual(1);
  });

  it("Handles exceptions gracefully", () => {
    function selector() {
      throw new Error("test-error");
    }

    expect(() => compute(selector)).toThrow();
  });
});
