import { BackoffOptions, backOff } from 'exponential-backoff';
import { Instance } from '../instance/Instance';

export class Cluster<T extends Instance> {
    protected instances: Map<T, boolean> = new Map();
    private maxInstances: number;
    private instanceCreator: () => T | Promise<T>;
    private defaultBackoffOptions?: ClusterBackoffOptions;
    private state: ClusterState;

    constructor(
        clusterSize: number,
        instanceCreator: () => T | Promise<T>,
        defaultBackoffOptions?: ClusterBackoffOptions
    ) {
        this.maxInstances = clusterSize;
        this.instanceCreator = instanceCreator;
        this.defaultBackoffOptions = defaultBackoffOptions;
        this.state = 'ready';
    }

    public async submit(
        task: (i: T) => Promise<void>,
        backoffOptions: ClusterBackoffOptions = this.defaultBackoffOptions
    ): Promise<void> {
        return this.acquire(backoffOptions).then((instance) => task(instance).finally(() => this.release(instance)));
    }

    public async shutdown(backoffOptions: ClusterBackoffOptions = this.defaultBackoffOptions): Promise<boolean> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve(false);
        }

        this.state = 'shutting down';

        return backOff(() => {
            const instancesInUse = [...this.instances].filter(([_, inUse]) => inUse).length;
            if (instancesInUse > 0) {
                throw new Error(`${instancesInUse} still in use`);
            }
            return this.performShutdown();
        }, this.getBackoffOptions(backoffOptions))
            .catch(() => {
                console.warn('Forcefully shutting down cluster after graceful shutdown failure');
                return this.performShutdown();
            })
            .then(() => Promise.resolve(true));
    }

    public async shutdownNow(): Promise<boolean> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve(false);
        }
        this.state = 'shutting down';
        return this.performShutdown().then(() => Promise.resolve(true));
    }

    private async performShutdown(): Promise<any> {
        const promises: Promise<void>[] = [...this.instances].map(async ([instance, _]) => instance.shutdown());
        return Promise.all(promises).then(() => (this.state = 'shutdown'));
    }

    private async acquire(backoffOptions: ClusterBackoffOptions = this.defaultBackoffOptions): Promise<T> {
        return backOff<T>(async () => {
            if (this.state === 'shutting down') {
                throw new UnretryableError('Cannot submit new tasks because the cluster is shutting down');
            }

            if (this.state === 'shutdown') {
                throw new UnretryableError('Cannot submit new tasks because the cluster has been shutdown');
            }

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
        }, this.getBackoffOptions(backoffOptions)).catch((error: Error) => {
            return Promise.reject(error.message);
        });
    }

    private release(instance: T): void {
        this.instances.set(instance, false);
    }

    private getBackoffOptions(clusterBackoffOptions: ClusterBackoffOptions): BackoffOptions {
        return {
            ...clusterBackoffOptions,
            retry: (error) => !(error instanceof UnretryableError),
        };
    }
}

class UnretryableError extends Error {}

type ClusterState = 'shutdown' | 'shutting down' | 'ready';

export type ClusterBackoffOptions = Omit<BackoffOptions, 'retry'>;
