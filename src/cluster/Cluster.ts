import { BackoffOptions, backOff } from 'exponential-backoff';
import { Instance } from '../instance/Instance';

export class Cluster<T extends Instance> {
    protected instances: Map<T, boolean> = new Map();
    private maxInstances: number;
    private instanceCreator: () => T | Promise<T>;
    private defaultBackoffOptions?: BackoffOptions;
    private state: ClusterState;
    private running: Promise<any>[];

    constructor(clusterSize: number, instanceCreator: () => T | Promise<T>, defaultBackoffOptions?: BackoffOptions) {
        this.maxInstances = clusterSize;
        this.instanceCreator = instanceCreator;
        this.defaultBackoffOptions = defaultBackoffOptions;
        this.state = 'ready';
        this.running = [];
    }

    public async submit(
        task: (i: T) => Promise<void>,
        backoffOptions: BackoffOptions = this.defaultBackoffOptions
    ): Promise<void> {
        const instance: T = await this.acquire(backoffOptions);
        return await task(instance).finally(() => this.release(instance));
    }

    public async shutdown(backoffOptions: BackoffOptions = this.defaultBackoffOptions): Promise<any> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve();
        }

        return backOff(() => {
            const instancesInUse = [...this.instances].filter(([_, inUse]) => inUse).length;
            if (instancesInUse > 0) {
                throw new Error(`${instancesInUse} still in use`);
            }
            return this.shutdownNow();
        }, backoffOptions).catch(() => {
            console.warn('Forcefully shutting down cluster after graceful shutdown failure');
            return this.shutdownNow();
        });
    }

    public async shutdownNow(): Promise<any> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve();
        }
        this.state = 'shutting down';
        const promises: Promise<void>[] = [...this.instances].map(async ([instance, _]) => await instance.shutdown());
        return Promise.all(promises).then(() => this.state = 'shutdown');
    }

    private async acquire(backoffOptions: BackoffOptions = this.defaultBackoffOptions): Promise<T> {
        return backOff<T>(async () => {
            if (this.state === 'shutting down') {
                return Promise.reject('Cannot submit new tasks because the cluster is shutting down');
            }

            if (this.state === 'shutdown') {
                return Promise.reject('Cannot submit new tasks because the cluster has been shutdown');
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
        }, backoffOptions);
    }

    private release(instance: T): void {
        this.instances.set(instance, false);
    }
}

type ClusterState = 'shutdown' | 'shutting down' | 'ready';
