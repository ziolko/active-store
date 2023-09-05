import { expect, describe, it, jest } from "@jest/globals";
import createState from "./create-state";
import { createComputed } from "./create-computed";
import { createSignal, execute } from "./core";

describe("createComputed", () => {
  it("Returns computed value", () => {
    const { computed } = createTestContext();
    expect(computed.get().text).toEqual("Hello World");
  });

  it("Updates returned value when one of dependencies changes", () => {
    const { world, computed, valueSignal } = createTestContext();
    const version = valueSignal.getVersion!();

    world.set("DEMO");
    expect(computed.get().text).toBe("Hello DEMO");
    expect(valueSignal.getVersion!()).toBe(version + 1);
  });

  it("Doesn't recompute value with each 'get' if there's no active subscription", () => {
    const { computed, valueSignal } = createTestContext();
    const version = valueSignal.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(valueSignal.getVersion!()).toBe(version);
  });

  it("Updates version if there's no active subscription and one of dependencies changes", () => {
    const { world, dependenciesSignal } = createTestContext();
    const version = dependenciesSignal.getVersion!();

    world.set("TEST");

    expect(dependenciesSignal.getVersion!()).toBe(version + 1);
  });

  it("Subscribes to effects of nested dependencies", () => {
    const {
      dependenciesSignal,
      computed,
      onNestedDependencySubscribed,
      onNestedDependencyUnsubscribed,
    } = createTestContext();

    computed.get();

    const unsubscribe1 = dependenciesSignal.subscribe(() => null);
    const unsubscribe2 = dependenciesSignal.subscribe(() => null);

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
    const { computed, valueSignal, dependenciesSignal } = createTestContext();

    dependenciesSignal.subscribe(() => null);

    const version = valueSignal.getVersion!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(version).toBe(valueSignal.getVersion!());
  });

  it("Notifies about changes in one of dependencies if there's active subscription", () => {
    const { world, dependenciesSignal } = createTestContext();
    const listener = jest.fn();

    dependenciesSignal.subscribe(listener);

    const version = dependenciesSignal.getVersion!();

    expect(listener).toHaveBeenCalledTimes(0);

    world.set("DEMO 1");
    expect(dependenciesSignal.getVersion!()).toBe(version + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    world.set("DEMO 2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(dependenciesSignal.getVersion!()).toBe(version + 2);
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

  const { signals } = execute(() => computed.get());

  expect(signals.size).toEqual(2);
  const signalsArray = Array.from(signals.values());

  // @ts-ignore
  const dependenciesSignal = signalsArray.find((x) => x.isDependencies)!;
  // @ts-ignore
  const valueSignal = signalsArray.find((x) => !x.isDependencies)!;

  expect(dependenciesSignal).toBeDefined();
  expect(valueSignal).toBeDefined();

  return {
    hello,
    world,
    computed,
    dependenciesSignal,
    valueSignal,
    onNestedDependencySubscribed,
    onNestedDependencyUnsubscribed,
  };
}
