import { BasicCluster } from '../../src/cluster/BasicCluster';

describe('BasicCluster', () => {
    it('does nothing on shutdown', async () => {
        const cluster = new BasicCluster(1);
        const result = await cluster.shutdown();
        expect(result).toBeTruthy();
    });

    it('does nothing on shutdownNow', async () => {
        const cluster = new BasicCluster(1);
        const result = await cluster.shutdownNow();
        expect(result).toBeTruthy();
    });

    it('overrides default backoff options', async () => {
        const cluster = new BasicCluster(3, {
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
});
