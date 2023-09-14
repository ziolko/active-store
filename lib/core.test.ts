import { expect, describe, it, jest } from "@jest/globals";
import { createTopic as createTopic, execute } from "./core";

describe("createTopic", () => {
  it("Calls subscribed function", () => {
    const listener = jest.fn();
    const topic = createTopic();
    topic.subscribe(listener);
    topic.newVersion();
    expect(listener).toBeCalledTimes(1);
  });

  it("Doesn't call subscribed function if unsubscribed", () => {
    const listener = jest.fn();
    const topic = createTopic();
    const unsubscribe = topic.subscribe(listener);
    unsubscribe();
    topic.newVersion();
    expect(listener).not.toBeCalled();
  });
});

describe("execute", () => {
  it("Returns value from selector", () => {
    const { value } = execute(() => "test-value");
    expect(value).toEqual("test-value");
  });

  it("Returns registered topic from selector", () => {
    const topic = createTopic({ getVersion: () => 1 });
    const { topics } = execute(() => topic.register());
    expect(topics.size).toEqual(1);
    expect(topics.values().next().value.getVersion()).toEqual(1);
  });

  it("Registers the same topic once even if registered multiple times", () => {
    const topic = createTopic();
    const { topics } = execute(() => {
      topic.register();
      topic.register();
      topic.register();
    });
    expect(topics.size).toEqual(1);
  });

  it("Handles exceptions gracefully", () => {
    function selector() {
      throw new Error("test-error");
    }

    expect(() => execute(selector)).toThrow();
  });
});
