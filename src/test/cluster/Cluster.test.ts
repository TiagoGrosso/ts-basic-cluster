import { Cluster, ClusterOptions } from '../../main/cluster/Cluster';
import { BasicInstance } from '../../main/instance/BasicInstance';
import { EmptyInstance } from '../../main/instance/EmptyInstance';
import { Instance } from '../../main/instance/Instance';

describe('Cluster', () => {
    it('executes tasks with max parallel rate', async () => {
        const cluster = new Cluster(3, () => new EmptyInstance(), {
            defaultBackoffOptions: {
                startingDelay: 1000,
                maxDelay: 1000,
            },
        });

        const done: number[] = [];

        for (let i = 0; i < 7; ++i) {
            cluster.submit(async () => {
                await new Promise((_) => setTimeout(_, 100));
                done.push(i);
            });
        }

        await new Promise((_) => setTimeout(_, 150));
        expect(done.length).toBe(3);

        await new Promise((_) => setTimeout(_, 1000));
        expect(done.length).toBe(6);

        await new Promise((_) => setTimeout(_, 1000));
        expect(done.length).toBe(7);
    });

    it('overrides default backoff options', async () => {
        const cluster = new Cluster(3, () => new EmptyInstance(), {
            defaultBackoffOptions: {
                startingDelay: 10000,
                maxDelay: 10000,
            },
        });

        const done: number[] = [];

        for (let i = 0; i < 7; ++i) {
            cluster.submit(
                async () => {
                    await new Promise((_) => setTimeout(_, 100));
                    done.push(i);
                },
                {
                    startingDelay: 1000,
                    maxDelay: 1000,
                }
            );
        }

        await new Promise((_) => setTimeout(_, 150));
        expect(done.length).toBe(3);

        await new Promise((_) => setTimeout(_, 1000));
        expect(done.length).toBe(6);

        await new Promise((_) => setTimeout(_, 1000));
        expect(done.length).toBe(7);
    });

    it('starts shutdown immediately when requested', async () => {
        const cluster = new Cluster<{}>(1, () => new EmptyInstance());

        let done = false;
        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
            done = true;
        });

        await new Promise((_) => setTimeout(_, 100));

        const shutdownResult = await cluster.shutdownNow();
        expect(shutdownResult).toBeTruthy();

        expect(done).toBeFalsy();
    });

    const possibleClusterOptions: (ClusterOptions | undefined)[] = [undefined, {}, { defaultBackoffOptions: {} }];

    describe('waits for task completion before shutting down', () => {
        possibleClusterOptions.forEach((options) => {
            test(`${possibleClusterOptions.indexOf(options)}`, async () => {
                const cluster = new Cluster<{}>(1, () => new EmptyInstance(), options);

                let done = false;
                cluster.submit(async () => {
                    await new Promise((_) => setTimeout(_, 1000));
                    done = true;
                });

                await new Promise((_) => setTimeout(_, 100));

                const shutdownPromise = cluster.shutdown();
                expect(done).toBeFalsy();

                const shutdownResult = await shutdownPromise;
                expect(shutdownResult).toBeTruthy();
                expect(done).toBeTruthy();
            });
        });
    });

    it('forcefully shuts down after failing to do so gracefully', async () => {
        const cluster = new Cluster<{}>(1, () => new EmptyInstance());

        let done = false;
        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
            done = true;
        });
        await new Promise((_) => setTimeout(_, 100));

        const shutdownResult = await cluster.shutdown({
            numOfAttempts: 1,
        });

        expect(shutdownResult).toBeTruthy();

        expect(done).toBeFalsy();
    });

    it('does not accept more tasks after shutdown', async () => {
        const cluster = new Cluster<{}>(
            1,
            () =>
                new (class extends BasicInstance<{}> {
                    shutdown(): void | Promise<void> {
                        return new Promise((_) => setTimeout(_, 1000));
                    }
                })({})
        );

        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
        });
        const secondTask = cluster.submit(async () => {});

        await new Promise((_) => setTimeout(_, 100));

        const shutdownPromise = cluster.shutdown();

        expect(secondTask).rejects.toContain('Cannot submit new tasks because the cluster is shutting down');

        const shutdownResult = await shutdownPromise;
        expect(shutdownResult).toBeTruthy();

        const newAttempt = cluster.submit(async () => {});
        return expect(newAttempt).rejects.toContain('Cannot submit new tasks because the cluster has been shutdown');
    });

    it('does not shutdown twice', async () => {
        const cluster = new Cluster<{}>(1, () => new EmptyInstance());

        expect(cluster.shutdown()).resolves.toBeTruthy();
        expect(cluster.shutdown()).resolves.toBeFalsy();
    });

    it('does not shutdown twice (force shutdown)', async () => {
        const cluster = new Cluster<{}>(1, () => new EmptyInstance());

        expect(cluster.shutdownNow()).resolves.toBeTruthy();
        expect(cluster.shutdownNow()).resolves.toBeFalsy();
    });

    it('returns task value when it completes', async () => {
        const cluster = new Cluster<{}>(1, () => new EmptyInstance());
        const random = Math.floor(Math.random() * 1000);

        const result = await cluster.submit(() => Promise.resolve(random));

        expect(result).toEqual(random);
    });

    it('respects max instances even on async creator', async () => {
        const maxInstances = 5;
        let createdInstances = 0;
        const cluster = new Cluster(
            maxInstances,
            async () => {
                await new Promise((_) => setTimeout(_, 500));
                createdInstances++;
                return new EmptyInstance();
            },
            { defaultBackoffOptions: { startingDelay: 1000, maxDelay: 1000 } }
        );

        const promises: Promise<any>[] = [];

        for (let i = 0; i < maxInstances * 3; ++i) {
            promises.push(
                cluster.submit(async () => {
                    await new Promise((_) => setTimeout(_, 100));
                })
            );
        }

        await Promise.all(promises);
        expect(createdInstances).toEqual(maxInstances);
    });

    it('eagerly creates instances', async () => {
        const maxInstances = 5;
        let createdInstances = 0;
        const cluster = new Cluster(
            maxInstances,
            () => {
                createdInstances++;
                return new EmptyInstance();
            },
            { eagerInstances: true }
        );

        expect(createdInstances).toEqual(maxInstances);

        await cluster.submit(async () => {});

        expect(createdInstances).toEqual(maxInstances);
    });

    it('eagerly creates instances (async creator)', async () => {
        const maxInstances = 5;
        let createdInstances = 0;
        const cluster = new Cluster(
            maxInstances,
            async () => {
                await new Promise((_) => setTimeout(_, 500));
                createdInstances++;
                return new EmptyInstance();
            },
            { eagerInstances: true }
        );

        await new Promise((_) => setTimeout(_, 750));

        expect(createdInstances).toEqual(maxInstances);

        await cluster.submit(async () => {});

        expect(createdInstances).toEqual(maxInstances);
    });
});
