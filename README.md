A library for performing multiple tasks in parallel with control over resource usage.

> [!WARNING]
> This library is still very much in beta. It only has basic functionalities and just ad-hoc testing. I developed it in a hurry to use somewhere else and I'll slowly transform it from a mess to a... somewhat better maintained mess 😎
> Expect a 1.0.0 release within a week or two

## Usage

### Basic usage

The `BasicCluster` class makes it easy to run a bunch of parallel tasks which don't depend on a managed instance object.

```typescript
import { BasicCluster } from './src/cluster/BasicCluster';

const clusterSize = 3;
const cluster: BasicCluster = new BasicCluster(clusterSize);

const result = cluster.submit(async () => {
    // Do something
});
```

### Usage with instances

You can create clusters that use (potentially complex) instance objects, reusing them for new tasks. The example that inspired this package was a cluster of [Puppeteer](https://www.npmjs.com/package/puppeteer) browser instances, which take some time to initiate and, as such, are a prime candidate for pooling.

To do so, you can implement the `Instance` interface and use the `Cluster` class directly with your instance.

(examples will be added soon)
