// @ts-ignore
import { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED as reactInternals } from "react";

export interface ActiveExternalState<R> {
  get: () => R;
  state: () => State<R>;
  notify: () => void;
  subscribe: (listener: (dependency: Dependency) => any) => () => void;
}

export interface State<R> {
  status: "pending" | "success" | "error";
  data?: R;
  error?: any;
}

export function activeExternalState<R = any>(
  get: () => R,
  onSubscribe: (notify: () => void) => () => void
) {
  let listenerCount = 0;
  let unsubscribe: (() => void) | void;

  const listeners = new Map();

  function notify() {
    for (const entry of listeners) {
      entry[1](result);
    }
  }

  const result: ActiveExternalState<R> = {
    get() {
      if (
        reactInternals?.ReactCurrentOwner?.current &&
        !isRunningReactSelector.value
      ) {
        throw new Error(
          "Accessing state value directly during React rendering is not allowed. Use useActive instead."
        );
      }

      currentDependencies?.add(result as any);
      return get();
    },
    state() {
      try {
        return { status: "success", data: result.get() };
      } catch (error: any) {
        if (error instanceof Promise || typeof error?.then === "function") {
          return { status: "pending" };
        } else {
          return { error, status: "error" };
        }
      }
    },
    notify,
    subscribe(listener: (dependency: Dependency) => void) {
      const id = listenerCount++;
      listeners.set(id, listener);

      if (listeners.size === 1) {
        unsubscribe = onSubscribe?.(notify);
      }

      let hasUnsubscribed = false;
      return () => {
        if (hasUnsubscribed) {
          return;
        }

        listeners.delete(id);
        hasUnsubscribed = true;

        if (listeners.size === 0 && typeof unsubscribe === "function") {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
  };
  return result;
}

export interface Dependency {
  get: () => unknown;
  subscribe: (listener: (dependency: Dependency) => any) => () => void;
}

let currentDependencies: Set<Dependency> | null = null;

export interface ComputeOptions {
  trackDependencies?: boolean;
}

export function compute<R>(
  selector: () => R,
  { trackDependencies = true }: ComputeOptions = {}
) {
  const previousDependencies = currentDependencies;

  const dependencies = trackDependencies ? new Set<Dependency>() : null;
  try {
    currentDependencies = dependencies;
    return { value: selector() as R, dependencies: dependencies ?? new Set() };
  } catch (error) {
    return { error, dependencies: dependencies ?? new Set() };
  } finally {
    currentDependencies = previousDependencies;
  }
}

export let isRunningReactSelector = { value: false };
