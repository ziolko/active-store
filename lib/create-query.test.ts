import { expect, describe, it, jest } from "@jest/globals";
import { createQuery } from "./create-query";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns idle result by default", () => {
    const query = createQuery(async (id: number) => ({ id }));
    expect(query(1).get().isIdle).toBe(true);
  });

  it("Returns isLoading after starting fetch", () => {
    const query = createQuery((id: number) => success(id));
    expect(query(1).get().isIdle).toBe(true);
    query(1).fetch();
    expect(query(1).get().isLoading).toBe(true);
    jest.advanceTimersByTime(2000);
  });

  it("Returns isSuccess after fetch is done", async () => {
    const query = createQuery((id: number) => success(id));
    query(1).fetch();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query(1).get().isSuccess).toBe(true);
  });

  it("Returns isError after fetch fails", async () => {
    const query = createQuery((id: number) => failure(id));
    query(1).fetch();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query(1).get().isError).toBe(true);
  });

  const success = <T>(data: T) =>
    new Promise((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise((resolve, reject) => setTimeout(() => reject(data), 500));
});
