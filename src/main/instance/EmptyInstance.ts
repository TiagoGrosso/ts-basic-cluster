import { Instance } from './Instance';

export class EmptyInstance implements Instance {
    shutdown(): void | Promise<void> {
        // Nothing to do on shutdown
    }
}
