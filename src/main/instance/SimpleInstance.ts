import { BasicInstance } from './BasicInstance';

/**
 * An instance with some context but which does not require any special shutdown action.
 */
export class SimpleInstance<C> extends BasicInstance<C> {
    /**
     * Constructor.
     *
     * @param value the context of the instance.
     */
    constructor(value: C) {
        super(value);
    }

    /**
     * @inheritdoc
     */
    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }
}
