import { expect, describe, it, jest } from "@jest/globals";
import createState from "./create-state";
import { createComputed } from "./create-computed";
import { createSignal, execute } from "./core";

describe("createComputed", () => {
  it("Return computed value", () => {
    const { computed } = createTestContext();
    expect(computed.get().text).toEqual("Hello World");
  });

  it("Updates returned value when one of dependencies changes", () => {
    const { world, computed, effect } = createTestContext();
    const version = effect.getVersion!();

    world.set("DEMO");
    expect(computed.get().text).toBe("Hello DEMO");
    expect(effect.getVersion!()).toBe(version + 1);
  });

  it("Doesn't recompute value with each 'get' if there's no active subscription", () => {
    const { computed, effect } = createTestContext();
    const version = effect.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(effect.getVersion!()).toBe(version);
  });

  it("Updates version if there's no active subscription and one of dependencies changes", () => {
    const { world, effect } = createTestContext();
    const version = effect.getVersion!();

    world.set("TEST");

    expect(effect.getVersion!()).toBe(version + 1);
  });

  it("Subscribes to effects of nested dependencies", () => {
    const {
      effect,
      computed,
      onNestedDependencySubscribed,
      onNestedDependencyUnsubscribed,
    } = createTestContext();

    computed.get();

    const unsubscribe1 = effect.subscribe(() => null);
    const unsubscribe2 = effect.subscribe(() => null);

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
    const { computed, effect } = createTestContext();

    effect.subscribe(() => null);

    const version = effect.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(version).toBe(effect.getVersion!());
  });

  it("Notifies about changes in one of dependencies if there's active subscription", () => {
    const { world, effect } = createTestContext();
    const listener = jest.fn();

    effect.subscribe(listener);

    const version = effect.getVersion!();

    expect(listener).toHaveBeenCalledTimes(0);

    world.set("DEMO 1");
    expect(effect.getVersion!()).toBe(version + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    world.set("DEMO 2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(effect.getVersion!()).toBe(version + 2);
  });
});

function createTestContext() {
  const hello = createState("Hello");
  const world = createState("World");
  const onNestedDependencyUnsubscribed = jest.fn(() => null);
  const onNestedDependencySubscribed = jest.fn(
    () => onNestedDependencyUnsubscribed
  );
  const nestedDependency = createSignal({
    getVersion: () => 0,
    onSubscribe: onNestedDependencySubscribed,
  });
  const computed = createComputed(() => {
    execute.current.register(nestedDependency);
    return { text: `${hello.get()} ${world.get()}` };
  });

  const { signals: effects } = execute(() => computed.get());

  expect(effects.size).toEqual(1);
  const effect = effects.values().next().value;

  return {
    hello,
    world,
    computed,
    effect,
    onNestedDependencySubscribed,
    onNestedDependencyUnsubscribed,
  };
}
