import { Cluster } from '../../src/cluster/Cluster';
import { EmptyInstance } from '../../src/instance/EmptyInstance';
import { Instance } from '../../src/instance/Instance';

describe('Cluster', () => {
    it('executes tasks with max parallel rate', async () => {
        const cluster = new Cluster(3, () => new EmptyInstance(), {
            startingDelay: 1000,
            maxDelay: 1000,
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
            startingDelay: 10000,
            maxDelay: 10000,
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

    it('starts shutdown immeadiately when requested', async () => {
        const cluster = new Cluster<Instance>(1, () => new EmptyInstance());

        let done = false;
        const promise = cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
            done = true;
        });

        await new Promise((_) => setTimeout(_, 100));

        await cluster.shutdownNow();

        expect(done).toBeFalsy();
    });

    it('waits for task completion before shutting down', async () => {
        const cluster = new Cluster<Instance>(1, () => new EmptyInstance());

        let done = false;
        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
            done = true;
        });

        await new Promise((_) => setTimeout(_, 100));

        const shutdownPromise = cluster.shutdown();
        expect(done).toBeFalsy();
        return shutdownPromise.then(() => expect(done).toBeTruthy());
    });

    it('forcefully shuts down after failing to do so gracefully', async () => {
        const cluster = new Cluster<Instance>(1, () => new EmptyInstance());

        let done = false;
        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
            done = true;
        });
        await new Promise((_) => setTimeout(_, 100));

        await cluster.shutdown({
            retry: () => false,
        });

        expect(done).toBeFalsy();
    });

    it('does not accept more tasks after shutdown', async () => {
        const cluster = new Cluster<Instance>(1, () => new EmptyInstance());

        cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
        });
        const secondTask = cluster.submit(async () => {
            await new Promise((_) => setTimeout(_, 1000));
        });
        
        await new Promise((_) => setTimeout(_, 100));

        const shutdownPromise = cluster.shutdown();

        expect(secondTask).rejects.toContain("Cannot submit new tasks because the cluster is shutting down");

        return shutdownPromise.then(() => {
            const newAttemp = cluster.submit(async () => {});
            return expect(newAttemp).rejects.toContain("Cannot submit new tasks because the cluster has been shutdown")
        }).catch(() => {
            throw new Error('Should never reach this');
        })
    });
});
