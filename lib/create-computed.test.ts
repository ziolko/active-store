import { expect, describe, it, jest } from "@jest/globals";
import { createState } from "./create-state";
import { createComputed } from "./create-computed";
import { createTopic, execute } from "./core";

describe("createComputed", () => {
  it("Returns computed value", () => {
    const { computed } = createTestContext();
    expect(computed.get().text).toEqual("Hello World");
  });

  it("Updates returned value when one of dependencies changes", () => {
    const { world, computed, valueTopic } = createTestContext();
    const version = valueTopic.getVersion!();

    world.set("DEMO");
    expect(computed.get().text).toBe("Hello DEMO");
    expect(valueTopic.getVersion!()).toBe(version + 1);
  });

  it("Doesn't recompute value with each 'get' if there's no active subscription", () => {
    const { computed, valueTopic } = createTestContext();
    const version = valueTopic.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(valueTopic.getVersion!()).toBe(version);
  });

  it("Updates version if there's no active subscription and one of dependencies changes", () => {
    const { world, dependenciesTopic } = createTestContext();
    const version = dependenciesTopic.getVersion!();

    world.set("TEST");

    expect(dependenciesTopic.getVersion!()).toBe(version + 1);
  });

  it("Subscribes to effects of nested dependencies", () => {
    const {
      dependenciesTopic,
      computed,
      onNestedDependencySubscribed,
      onNestedDependencyUnsubscribed,
    } = createTestContext();

    computed.get();

    const unsubscribe1 = dependenciesTopic.subscribe(() => null);
    const unsubscribe2 = dependenciesTopic.subscribe(() => null);

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
    const { computed, valueTopic, dependenciesTopic } = createTestContext();

    dependenciesTopic.subscribe(() => null);

    const version = valueTopic.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(version).toBe(valueTopic.getVersion!());
  });

  it("Notifies about changes in one of dependencies if there's active subscription", () => {
    const { world, dependenciesTopic } = createTestContext();
    const listener = jest.fn();

    dependenciesTopic.subscribe(listener);

    const version = dependenciesTopic.getVersion!();

    expect(listener).toHaveBeenCalledTimes(0);

    world.set("DEMO 1");
    expect(dependenciesTopic.getVersion!()).toBe(version + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    world.set("DEMO 2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(dependenciesTopic.getVersion!()).toBe(version + 2);
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
    getVersion: () => 0,
    onSubscribe: onNestedDependencySubscribed,
  });
  const computed = createComputed(() => {
    nestedDependency.register();
    return { text: `${hello.get()} ${world.get()}` };
  });

  const { topics } = execute(() => computed.get());

  expect(topics.size).toEqual(2);
  const topicsArray = Array.from(topics.values());

  // @ts-ignore
  const dependenciesTopic = topicsArray.find((x) => x.isDependencies)!;
  // @ts-ignore
  const valueTopic = topicsArray.find((x) => !x.isDependencies)!;

  expect(dependenciesTopic).toBeDefined();
  expect(valueTopic).toBeDefined();

  return {
    hello,
    world,
    computed,
    dependenciesTopic: dependenciesTopic,
    valueTopic: valueTopic,
    onNestedDependencySubscribed,
    onNestedDependencyUnsubscribed,
  };
}
