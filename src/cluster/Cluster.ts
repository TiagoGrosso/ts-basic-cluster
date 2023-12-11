import { BackoffOptions, backOff } from 'exponential-backoff';
import { Instance } from '../instance/Instance';

export class Cluster<T extends Instance> {
    protected instances: Map<T, boolean> = new Map();
    private maxInstances: number;
    private instanceCreator: () => T | Promise<T>;
    private backoffOptions?: BackoffOptions;

    constructor(clusterSize: number, instanceCreator: () => T | Promise<T>, backoffOptions?: BackoffOptions) {
        this.maxInstances = clusterSize;
        this.instanceCreator = instanceCreator;
        this.backoffOptions = backoffOptions;
    }

    public async submit(task: (i: T) => Promise<void>): Promise<void> {
        const instance: T = await this.acquire();
        return await task(instance).finally(() => this.release(instance));
    }

    public async shutdownNow(): Promise<any> {
        const promises: Promise<void>[] = [...this.instances].map(async ([instance, _]) => await instance.shutdown());
        return Promise.all(promises);
    }

    private async acquire(): Promise<T> {
        return backOff<T>(async () => {
            const freeInstances = [...this.instances].filter(([_, inUse]) => !inUse).map(([instance, _]) => instance);

            if (freeInstances.length == 0) {
                if (this.instances.size < this.maxInstances) {
                    const newInstance = await this.instanceCreator();

                    if (this.instances.size == this.maxInstances) {
                        throw new Error();
                    }

                    this.instances.set(newInstance, true);
                    return Promise.resolve(newInstance);
                }
                throw new Error();
            }

            const instance = freeInstances[0];
            this.instances.set(instance, true);
            return Promise.resolve(instance);
        }, this.backoffOptions);
    }

    private release(instance: T): void {
        this.instances.set(instance, false);
    }
}
