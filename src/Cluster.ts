export class Cluster<T> {
  private instances: Map<T, boolean> = new Map();
  private waitBetweenRetriesMs: number;
  private defaultMaxRetries: number;

  constructor(waitBetweenRetriesMs: number = 1000, defaultMaxRetries: number = 0) {
    this.waitBetweenRetriesMs = waitBetweenRetriesMs
    this.defaultMaxRetries = defaultMaxRetries;
  }

  async submit(task: (i: T) => Promise<void>): Promise<void> {
    const instance: T = await this.acquire();
    return task(instance).finally(() => this.release(instance));
  }

  private async acquire(
    waitBetweenRetries: number = this.waitBetweenRetriesMs,
    maxRetries: number = this.defaultMaxRetries,
    waitBeforeTrying: number = 0,
    retry: number = 0
  ): Promise<T> {
    if (maxRetries > 1 && retry > maxRetries) {
      throw new Error('Max retries exceeded');
    }

    await new Promise((_) => setTimeout(_, waitBeforeTrying));

    const freeInstance = [...this.instances].find(([_, inUse]) => !inUse)?.[0];

    if (!freeInstance) {
      const retryingAttemptText = `${retry}${
        maxRetries > 1 ? `/${maxRetries}` : ''
      }`;
      console.info(
        `Could not acquire instance. Retrying ${retryingAttemptText}`
      );
      return this.acquire(waitBetweenRetries, maxRetries, waitBetweenRetries, retry + 1);
    }

    return Promise.resolve(freeInstance);
  }

  private release(instance: T): void {
    this.instances.set(instance, false);
  }
}
