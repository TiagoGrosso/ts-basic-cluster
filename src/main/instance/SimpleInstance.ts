import { Instance } from './Instance';

export class SimpleInstance<T> implements Instance {
    private value: T;

    constructor(value: T) {
        this.value = value;
    }

    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }

    public getValue(): T {
        return this.value;
    }
}
