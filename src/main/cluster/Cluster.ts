import { BackoffOptions, backOff } from 'exponential-backoff';
import { Instance } from '../instance/Instance';

/**
 * A cluster manages a number of instances and accepts tasks to be submitted to those instances.
 * It allows multiple async tasks to be submitted in parallel in a throttled way to preserve resource usage.
 */
export class Cluster<T extends Instance> {
    /**
     * The instances managed by this cluster mapped to whether they are free to pick up new tasks.
     */
    protected instances: Map<T, boolean> = new Map();

    /**
     * How many instances the cluster can contain (and, conversely, how many tasks it can run in parallel).
     */
    private maxInstances: number;

    /**
     * The function to call to create a new instance, when needed.
     */
    private instanceCreator: () => T | Promise<T>;

    /**
     * the exponential-backoff options this cluster will use by default for retrying the acquisition of a free instance and for performing a graceful shutdown.
     */
    private defaultBackoffOptions?: ClusterBackoffOptions;

    /**
     * The cluster state.
     */
    private state: ClusterState;

    /**
     * Constructor.
     *
     * @param clusterSize how many instances the cluster can contain (and, conversely, how many tasks it can run in parallel).
     * @param instanceCreator the function to call to create a new instance, when needed.
     * @param defaultBackoffOptions the exponential-backoff options this cluster will use by default for retrying the acquisition of a free instance and for performing a graceful shutdown.
     */
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

    /**
     * Submits a task to the cluster.
     * The cluster will attempt to acquire a free instance and execute the task within the context of that instance.
     *
     * @param task the task to run.
     * @param backoffOptions the exponential-backoff options to retry acquiring a free instance. If not provided, the cluster will use its default ones.
     * @returns a promise that completes when the task is done.
     */
    public async submit(
        task: (i: T) => Promise<void>,
        backoffOptions: ClusterBackoffOptions = this.defaultBackoffOptions
    ): Promise<void> {
        return this.acquire(backoffOptions).then((instance) => task(instance).finally(() => this.release(instance)));
    }

    /**
     * Attempts to gracefully shut down the cluster by waiting for any ongoing task to be completed before shutting down all instances.
     * After the configured retries are exhausted, the cluster will initiate a forceful shutdown (see {@link #shutdownNow})
     *
     * @param backoffOptions the exponential-backoff options to retry the graceful shutdown. If not provided, the cluster will use its default ones.
     * @returns a promise that completes when the cluster has been successfully shutdown.
     */
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

    /**
     * Immediately initiates a cluster shutdown, shutting down all managed instances, without waiting for ongoing tasks to be finished.
     *
     * @returns a promise that completes when the cluster has been successfully shutdown.
     */
    public async shutdownNow(): Promise<boolean> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve(false);
        }
        this.state = 'shutting down';
        return this.performShutdown().then(() => Promise.resolve(true));
    }

    /**
     * Performs the shutdown operations.
     *
     * @returns a promise that completes when the cluster has been successfully shutdown.
     */
    private async performShutdown(): Promise<any> {
        const promises: Promise<void>[] = [...this.instances].map(async ([instance, _]) => instance.shutdown());
        return Promise.all(promises).then(() => (this.state = 'shutdown'));
    }

    /**
     * Attempts to acquire a instance. If no instance is free and the cluster is not yet full, it will return a newly spawned instance.
     *
     * @param backoffOptions the exponential-backoff options to retry acquiring a free instance. If not provided, the cluster will use its default ones.
     * @returns a promise that resolves to the acquired instance.
     */
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

/**
 * An error that causes the retrying flow to be exited immediately .
 */
class UnretryableError extends Error {}

/**
 * Possible cluster states.
 */
type ClusterState = 'shutdown' | 'shutting down' | 'ready';

/**
 * Options for the Cluster retries (instance acquisition & graceful shutdown).
 */
export type ClusterBackoffOptions = Omit<BackoffOptions, 'retry'>;
