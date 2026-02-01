const PENDING = Symbol('pending');

export const isBusy = async (promise: Promise<unknown> | undefined): Promise<boolean> => {
  if (promise == null) {
    return false;
  }
  return await Promise.race([promise, Promise.resolve(PENDING)]) === PENDING;
};
