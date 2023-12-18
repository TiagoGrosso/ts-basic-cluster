# Basic Cluster

[![npm version](https://img.shields.io/npm/v/basic-cluster.svg?style=flat-square)](https://www.npmjs.org/package/basic-cluster)
[![codecov](https://codecov.io/gh/TiagoGrosso/ts-basic-cluster/branch/master/graph/badge.svg?token=1WBXW0RE0Q)](https://codecov.io/gh/TiagoGrosso/ts-basic-cluster)
[![install size](https://packagephobia.com/badge?p=basic-cluster)](https://packagephobia.com/result?p=basic-cluster)
[![npm downloads](https://img.shields.io/npm/dm/basic-cluster.svg?style=flat-square)](http://npm-stat.com/charts.html?package=basic-cluster)
![License](https://img.shields.io/npm/l/basic-cluster)

A library for performing multiple tasks in parallel with control over resource usage.

## Installation

```
npm install basic-cluster
```

## Concepts

### Cluster

The cluster controls the execution of multiple async tasks. It has a size which will control how many [instances](#instances) it can manage.

The cluster also accepts options for how it retries obtaining an instance to run submitted tasks. Retries are managed via [exponential-backoff](https://github.com/coveooss/exponential-backoff) so check the docs over there for options.

### Instance

An instance is simply an object managed by the cluster and acts as a context for tasks to run in. While running a task, an instance is considered `busy` and it cannot accept a new task until the current one completes.

### Task

Task is what you submit to the cluster for it to run when possible.

## Usage

Here's what you do:

1. Create a Cluster.
1. Submit tasks to it.
1. When you are done, you can shutdown the cluster.

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

### Shutdown

If you no longer require the cluster, you can shut it down. There are two options for this:

1. `Cluster#shutdown()` will attempt to wait for any running task to complete before shutting down.
    1. After shutdown is requested, new task submissions are immediately rejected. Tasks waiting to be picked up will also be rejected.
    1. If there are running tasks, the cluster will retry to shutdown at a later time.
    1. When gracefully shutdown retries are exhausted, the cluster will forcefully shutdown.
1. `Cluster#shutdownNow()` will forcefully shutdown the cluster, calling `shutdown()` on all its instances immediately. 
    1. This does not cancel running tasks, so depending on how their built and what stage their in, they might still complete successfully.

### Usage with instances

You can create clusters that use (potentially complex) instance objects, reusing them for new tasks. The example that inspired this package was a cluster of [Puppeteer](https://www.npmjs.com/package/puppeteer) browser instances, which take some time to initiate and, as such, are a prime candidate for pooling.

To do so, you can implement the `Instance` interface and use the `Cluster` class directly with your instance.

### SimpleInstance

The `SimpleInstance` is a utility for when you need an instance with some state and the shutdown is a no-op. Here's an example:

```typescript
let i = 0;
const cluster: Cluster<SimpleInstance<number>> = new Cluster(3, () => new SimpleInstance(++i));
cluster.submit((instance) => {
  console.log(`Running task on instance ${instance.getValue()}`)
  // do something with the instance
})
```
