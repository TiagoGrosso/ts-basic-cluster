import { BasicCluster } from '../../src/cluster/BasicCluster';

describe('BasicCluster', () => {

    it('does nothing on shutdown', async () => {
        const cluster = new BasicCluster(1);
        return cluster.shutdown().catch(() => {
            throw new Error('Should never reach this');
        });
    });


    it('does nothing on shutdownNow', async () => {
        const cluster = new BasicCluster(1);
        return cluster.shutdownNow().catch(() => {
            throw new Error('Should never reach this');
        });
    });
});
