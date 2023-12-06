export class Cluster<T> {
  private instances: Map<T, boolean> = new Map();
  private maxInstances: number;
  private instanceCreator: () => T;
  private waitBetweenRetriesMs: number;
  private defaultMaxRetries: number;

  constructor(
    clusterSize: number,
    instanceCreator: () => T,
    waitBetweenRetriesMs: number = 1000,
    defaultMaxRetries: number = 0
  ) {
    this.maxInstances = clusterSize;
    this.instanceCreator = instanceCreator;
    this.waitBetweenRetriesMs = waitBetweenRetriesMs;
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

    if (waitBeforeTrying > 0) {
      console.debug(
        `Waiting ${waitBeforeTrying}ms before attempting to acquire instance again`
      );
      await new Promise((_) => setTimeout(_, waitBeforeTrying));
    }

    const freeInstances = [...this.instances]
      .filter(([_, inUse]) => !inUse)
      .map(([instance, _]) => instance);

    if (freeInstances.length == 0) {
      if (this.instances.size < this.maxInstances) {
        const newInstance = this.instanceCreator();
        this.instances.set(newInstance, true);
        return Promise.resolve(this.instanceCreator());
      }
      const retryingAttemptText = `${retry}${
        maxRetries > 1 ? `/${maxRetries}` : ''
      }`;
      console.debug(
        `Could not acquire instance. Retrying ${retryingAttemptText}`
      );
      return this.acquire(
        waitBetweenRetries,
        maxRetries,
        waitBetweenRetries,
        retry + 1
      );
    }

    const instance = freeInstances[0];
    this.instances.set(instance, true);
    return Promise.resolve(instance);
  }

  private release(instance: T): void {
    this.instances.set(instance, false);
  }
}
