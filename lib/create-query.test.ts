import { expect, describe, it, jest } from "@jest/globals";
import { createQuery } from "./create-query";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns idle result by default", () => {
    const query = createQuery((id: number) => ({ id }));
    expect(query.get(1).isIdle).toBe(true);
  });

  it("Returns isLoading after starting fetch", () => {
    const query = createQuery((id: number) => success(id));
    expect(query.get(1).isIdle).toBe(true);
    query.fetch(1);
    expect(query.get(1).isLoading).toBe(true);
    jest.advanceTimersByTime(2000);
  });

  it("Returns isSuccess after fetch is done", () => {
    const query = createQuery((id: number) => success(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    expect(query.get(1).isSuccess).toBe(true);
  });

  it("Returns isError after fetch is fails", () => {
    const query = createQuery((id: number) => failure(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    expect(query.get(1).isError).toBe(true);
  });

  const success = <T>(data: T) =>
    new Promise((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise((resolve, reject) => setTimeout(() => reject(data), 500));
});
