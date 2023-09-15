import { expect, describe, it, jest } from "@jest/globals";
import { createState } from "./create-state";
import { createComputed } from "./create-computed";
import { createTopic, compute } from "./core";

describe("createComputed", () => {
  it("Returns computed value", () => {
    const { computed } = createTestContext();
    expect(computed.get().text).toEqual("Hello World");
  });

  it("Updates returned value when one of dependencies changes", () => {
    const { world, computed } = createTestContext();

    world.set("DEMO");
    expect(computed.get().text).toBe("Hello DEMO");
  });

  it("Doesn't recompute value with each 'get' if there's no active subscription", () => {
    const { computed, topic } = createTestContext();
    const version = topic.get!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(topic.get()).toBe(version);
  });

  it("Subscribes to effects of nested dependencies", () => {
    const {
      topic,
      computed,
      onNestedDependencySubscribed,
      onNestedDependencyUnsubscribed,
    } = createTestContext();

    computed.get();

    const unsubscribe1 = topic.subscribe(() => null);
    const unsubscribe2 = topic.subscribe(() => null);

    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(0);

    unsubscribe1();
    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(0);

    unsubscribe2();
    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(1);
  });

  it("Doesn't recompute value with each 'get' if there's an active subscription", () => {
    const { computed, topic } = createTestContext();

    topic.subscribe(() => null);

    const version = topic.get();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(version).toBe(topic.get());
  });

  it("Notifies about changes in one of dependencies if there's active subscription", () => {
    const { world, topic } = createTestContext();
    const listener = jest.fn();

    topic.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(0);

    world.set("DEMO 1");
    expect(topic.get()).toEqual({ text: "Hello DEMO 1" });
    expect(listener).toHaveBeenCalledTimes(1);

    world.set("DEMO 2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(topic.get()).toEqual({ text: "Hello DEMO 2" });
  });
});

function createTestContext() {
  const hello = createState("Hello");
  const world = createState("World");
  const onNestedDependencyUnsubscribed = jest.fn(() => null);
  const onNestedDependencySubscribed = jest.fn(
    () => onNestedDependencyUnsubscribed
  );
  const nestedDependency = createTopic({
    get: () => 0,
    onSubscribe: onNestedDependencySubscribed,
  });
  const computed = createComputed(() => {
    nestedDependency.get();
    return { text: `${hello.get()} ${world.get()}` };
  });

  const { topics } = compute(() => computed.get());

  expect(topics.size).toEqual(1);
  const topic = topics.values().next().value;

  return {
    hello,
    world,
    computed,
    topic,
    onNestedDependencySubscribed,
    onNestedDependencyUnsubscribed,
  };
}
