import { SimpleInstance } from './SimpleInstance';

/**
 * An instance with no inner objects to run tasks that don't require an execution context.
 */
export class EmptyInstance extends SimpleInstance<{}> {
    constructor() {
        super({});
    }

    /**
     * @inheritdoc
     */
    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }
}
