import { BasicInstance } from './BasicInstance';
import { Instance } from './Instance';

/**
 * An instance with some context but which does not require any special shutdown action.
 */
export class SimpleInstance<T> extends BasicInstance {
    /**
     * The context of the instance.
     */
    private value: T;

    /**
     * Constructor.
     *
     * @param value the context of the instance.
     */
    constructor(value: T) {
        super();
        this.value = value;
    }

    /**
     * @inheritdoc
     */
    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }

    /**
     * Gets the context of the instance.
     *
     * @returns the context of the instance.
     */
    public getValue(): T {
        return this.value;
    }
}
