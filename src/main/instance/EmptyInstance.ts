import { Instance } from './Instance';

/**
 * An instance with no inner objects to run tasks that don't require an execution context.
 */
export class EmptyInstance implements Instance {
    /**
     * @inheritdoc
     */
    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }
}
