import React, { useState } from "react";
import shallowequal from "shallowequal";

//@ts-ignore
import { useSyncExternalStore } from 'use-sync-external-store/shim';

import { compute, isRunningReactSelector } from "./core";
import { createDependenciesTracker } from "./create-dependencies-tracker";

type ExcludeMethods<T> = {
  [P in keyof T]: T[P] extends Function ? never : ExcludeMethods<T[P]>;
};

export function useActive<R>(
  selector: { get: () => R } | (() => R extends Function ? never : R)
): ExcludeMethods<R> {
  const [state] = useState(createActiveSelectorState);
  const result = useSyncExternalStore(state.subscribe, () =>
    state.getSnapshot(typeof selector === "function" ? selector : selector.get)
  );

  if (typeof (result as any)?.then === "function") {
    throw result;
  }

  return result;
}

function createActiveSelectorState() {
  let onUpdated: any;
  let dependencies = createDependenciesTracker(() => onUpdated?.());
  let cachedValue: any = undefined;
  let subscriptionsCount = 0;

  return {
    subscribe(updated: () => void) {
      onUpdated = updated;
      dependencies.subscribe();
      subscriptionsCount += 1;

      return () => {
        // Unsubscribe a second later so that we don't
        // refetch if data is resubscribed in a moment
        setTimeout(() => {
          subscriptionsCount -= 1;
          if (subscriptionsCount === 0) {
            dependencies?.unsubscribe();
            onUpdated = null;
          }
        }, 1000);
      };
    },
    getSnapshot(selector: () => any) {
      let wasRunningReactSelector = isRunningReactSelector.value;
      try {
        isRunningReactSelector.value = true;
        const { value, error, dependencies: topics } = compute(selector);

        dependencies.update(topics);

        if (onUpdated) {
          dependencies.subscribe();
        }

        if (typeof (error as any)?.then === "function") {
          return error;
        }

        if (error) {
          throw error;
        }

        if (
          !Object.is(cachedValue, value) &&
          !shallowequal(cachedValue, value)
        ) {
          cachedValue = value;
        }

        return cachedValue;
      } finally {
        isRunningReactSelector.value = wasRunningReactSelector;
      }
    },
  };
}

export type ActiveBoundaryErrorProps = {
  error: Error;
  resetError: (...args: any) => void;
};

export type ActiveBoundaryProps<R = any> = React.PropsWithChildren<{
  fallback?: React.ReactNode | React.JSXElementConstructor<{}>;

  errorFallback?:
    | React.ReactNode
    | React.JSXElementConstructor<ActiveBoundaryErrorProps>;

  onError?: (error: Error, info: React.ErrorInfo) => void;
  onErrorReset?: (...args: R[]) => void;
}>;

type ActiveBoundaryState = {
  didCatch: boolean;
  error: Error | null;
};

const initialState: ActiveBoundaryState = {
  didCatch: false,
  error: null,
};

/**
 * Attribution: The ActiveBoundary component is based on the react-error-boundary library
 */
export class ActiveBoundary extends React.PureComponent<
  ActiveBoundaryProps,
  ActiveBoundaryState
> {
  constructor(props: ActiveBoundaryProps) {
    super(props);
    this.state = initialState;
  }

  static getDerivedStateFromError(error: Error) {
    return { didCatch: true, error };
  }

  resetError = (...args: any) => {
    const { error } = this.state;

    if (error !== null) {
      this.props.onErrorReset?.(...args);
      this.setState(initialState);
    }
  };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    const { children, fallback, errorFallback } = this.props;
    const { didCatch, error } = this.state;

    if (didCatch && typeof errorFallback === "function") {
      return React.createElement(errorFallback, {
        resetError: this.resetError,
        error: error!,
      });
    } else if (didCatch && typeof errorFallback !== "undefined") {
      return errorFallback as React.ReactNode;
    } else if (didCatch) {
      throw error;
    }

    if (typeof fallback === "function") {
      return React.createElement(
        React.Suspense,
        { fallback: React.createElement(fallback) },
        children
      );
    } else if (typeof fallback !== "undefined") {
      return React.createElement(React.Suspense, { fallback }, children);
    } else {
      return children;
    }
  }
}
