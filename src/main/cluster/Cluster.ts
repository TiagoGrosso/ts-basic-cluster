import { backOff, BackoffOptions } from 'exponential-backoff';
import { Instance } from '../instance/Instance';

/**
 * A cluster manages a number of instances and accepts tasks to be submitted to those instances.
 * It allows multiple async tasks to be submitted in parallel in a throttled way to preserve resource usage.
 */
export class Cluster<C> {
    /**
     * The instances managed by this cluster mapped to whether they are free to pick up new tasks.
     */
    protected instances: Set<Instance<C>> = new Set();

    /**
     * How many instances the cluster can contain (and, conversely, how many tasks it can run in parallel).
     */
    private maxInstances: number;

    /**
     * The function to call to create a new instance, when needed.
     */
    private instanceCreator: () => Instance<C> | Promise<Instance<C>>;

    /**
     * The cluster options. See {@link ClusterOptions}
     */
    private clusterOptions?: ClusterOptions;

    /**
     * The cluster state.
     */
    private state: ClusterState;

    /**
     * The instances whose creation is ongoing and the cluster is waiting on.
     */
    private instancesBeingCreated: Set<Promise<Instance<C>>>;

    /**
     * Constructor.
     *
     * @param clusterSize how many instances the cluster can contain (and, conversely, how many tasks it can run in parallel).
     * @param instanceCreator the function to call to create a new instance, when needed.
     * @param defaultBackoffOptions the exponential-backoff options this cluster will use by default for retrying the acquisition of a free instance and for performing a graceful shutdown.
     */ constructor(
        clusterSize: number,
        instanceCreator: () => Instance<C> | Promise<Instance<C>>,
        clusterOptions?: ClusterOptions
    ) {
        this.maxInstances = clusterSize;
        this.instanceCreator = instanceCreator;
        this.clusterOptions = clusterOptions;
        this.state = 'ready';
        this.createInitialInstances(clusterOptions?.eagerInstances ?? false);
    }

    private createInitialInstances(eager: boolean): void {
        this.instancesBeingCreated = new Set();

        if (!eager) {
            return;
        }

        for (let i = 0; i < this.maxInstances; ++i) {
            this.createNewInstance();
        }
    }

    /**
     * Submits a task to the cluster.
     * The cluster will attempt to acquire a free instance and execute the task within the context of that instance.
     *
     * @param task the task to run.
     * @param backoffOptions the exponential-backoff options to retry acquiring a free instance. If not provided, the cluster will use its default ones.
     * @returns a promise that completes when the task is done.
     */
    public async submit<R>(
        task: (i: C) => Promise<R>,
        backoffOptions: ClusterBackoffOptions = this.clusterOptions?.defaultBackoffOptions
    ): Promise<R> {
        return this.acquire(backoffOptions).then((instance) => instance.submit(task));
    }

    /**
     * Attempts to gracefully shut down the cluster by waiting for any ongoing task to be completed before shutting down all instances.
     * After the configured retries are exhausted, the cluster will initiate a forceful shutdown (see {@link shutdownNow})
     *
     * @param backoffOptions the exponential-backoff options to retry the graceful shutdown. If not provided, the cluster will use its default ones.
     * @returns a promise that completes when the cluster has been successfully shutdown.
     */
    public async shutdown(
        backoffOptions: ClusterBackoffOptions = this.clusterOptions?.defaultBackoffOptions
    ): Promise<boolean> {
        if (this.state !== 'ready') {
            console.log('Cluster is already shutdown or is shutting down');
            return Promise.resolve(false);
        }

        this.state = 'shutting down';

        return backOff(() => {
            const instancesInUse = [...this.instances].filter((instance) => !instance.isFree()).length;
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
    protected async performShutdown(): Promise<any> {
        const promises: Promise<void>[] = [...this.instances].map(async (instance) => instance.shutdown());
        return Promise.all(promises).then(() => (this.state = 'shutdown'));
    }

    /**
     * Attempts to acquire a instance. If no instance is free and the cluster is not yet full, it will return a newly spawned instance.
     *
     * @param backoffOptions the exponential-backoff options to retry acquiring a free instance. If not provided, the cluster will use its default ones.
     * @returns a promise that resolves to the acquired instance.
     */
    private async acquire(
        backoffOptions: ClusterBackoffOptions = this.clusterOptions?.defaultBackoffOptions
    ): Promise<Instance<C>> {
        return backOff<Instance<C>>(async () => {
            if (this.state === 'shutting down') {
                throw new UnretryableError('Cannot submit new tasks because the cluster is shutting down');
            }

            if (this.state === 'shutdown') {
                throw new UnretryableError('Cannot submit new tasks because the cluster has been shutdown');
            }

            const freeInstances = [...this.instances].filter((instance) => instance.isFree());

            if (freeInstances.length == 0) {
                if (
                    this.instances.size < this.maxInstances &&
                    this.instancesBeingCreated.size < this.maxInstances - this.instances.size
                ) {
                    const newInstancePromise = this.createNewInstance();
                    const newInstance = await newInstancePromise;

                    return Promise.resolve(newInstance);
                }
                throw new Error();
            }

            const instance = freeInstances[0];
            return Promise.resolve(instance);
        }, this.getBackoffOptions(backoffOptions)).catch((error: Error) => {
            return Promise.reject(error.message);
        });
    }

    private createNewInstance() {
        const newInstancePromise = this.getNewInstancePromise()
            .then((instance) => {
                this.instances.add(instance);
                return instance;
            })
            .finally(() => this.instancesBeingCreated.delete(newInstancePromise));
        this.instancesBeingCreated.add(newInstancePromise);
        return newInstancePromise;
    }

    private async getNewInstancePromise(): Promise<Instance<C>> {
        return await this.instanceCreator();
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

/**
 * Options for the Cluster behavior.
 */
export interface ClusterOptions {
    /**
     * The exponential-backoff options this cluster will use by default for retrying the acquisition of a free instance and for performing a graceful shutdown.
     */
    defaultBackoffOptions?: ClusterBackoffOptions;

    /**
     * Whether to create instances eagerly or lazily.
     */
    eagerInstances?: boolean;
}
