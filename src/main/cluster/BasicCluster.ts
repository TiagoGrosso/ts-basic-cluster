import { Cluster, ClusterOptions } from './Cluster';
import { EmptyInstance } from '../instance/EmptyInstance';

/**
 * A cluster that that contains instances of type {@link EmptyInstance}.
 *
 * Tasks submitted to this cluster will have an empty execution context.
 */
export class BasicCluster extends Cluster<{}> {
    /**
     * Constructor.
     *
     * @param clusterSize how many instances the cluster can contain (and, conversely, how many tasks it can run in parallel)
     * @param defaultBackoffOptions the exponential-backoff options this cluster will use by default for retrying the acquisition of a free instance and for performing a graceful shutdown.
     */
    public constructor(clusterSize: number, clusterOptions?: ClusterOptions) {
        super(clusterSize, () => new EmptyInstance(), clusterOptions);
    }
}
