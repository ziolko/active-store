import { Effect, createDependencySignal } from "./core";
import createState from "./create-state";

export default function createSingleQuery<
  T extends (key: string) => Promise<any>
>(factory: T) {
  const data = new Map<
    string,
    {
      version: 0;
      promise: Promise<any>;
      dependency: Effect;
      sideEffect: Effect;
      state: any;
    }
  >();

  let subscribersCount = 0;
  function onSubscribe(key: string) {
    if (subscribersCount === 0) {
      console.log("Subscribe" + key);
    }
    subscribersCount += 1;

    let isUnsubscribed = false;
    return () => {
      if (isUnsubscribed) {
        return;
      }

      isUnsubscribed = true;
      subscribersCount -= 1;

      if (subscribersCount === 0) {
        console.log("Unsubscribe" + key);
      }
    };
  }

  return {
    get(key: string) {
      let entry = data.get(key);
      if (!entry) {
        entry = {
          version: 0,
          promise: factory(key),
          dependency: createDependencySignal({
            getVersion: () => entry!.version,
          }),
          sideEffect: createDependencySignal({
            onSubscribe: () => onSubscribe(key),
          }),
          state: createState({ status: "pending", data: null, error: null }),
        };
        data.set(key, entry);
      }
    },
  };
}
