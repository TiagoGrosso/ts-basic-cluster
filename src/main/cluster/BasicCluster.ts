import { Cluster, ClusterBackoffOptions } from './Cluster';
import { EmptyInstance } from '../instance/EmptyInstance';

export class BasicCluster extends Cluster<EmptyInstance> {
    public constructor(clusterSize: number, backoffOptions?: ClusterBackoffOptions) {
        super(clusterSize, () => new EmptyInstance(), backoffOptions);
    }
}
