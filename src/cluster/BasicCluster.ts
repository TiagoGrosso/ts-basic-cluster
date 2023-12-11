import { Cluster } from './Cluster';
import { EmptyInstance } from '../instance/EmptyInstance';
import { BackoffOptions } from 'exponential-backoff';

export class BasicCluster extends Cluster<EmptyInstance> {
  public constructor(clusterSize: number, backoffOptions?: BackoffOptions) {
    super(clusterSize, () => new EmptyInstance(), backoffOptions);
  }
}
