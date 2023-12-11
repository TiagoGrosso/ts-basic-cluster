import { Instance } from './Instance';

export class EmptyInstance implements Instance {
    shutdown(): void | Promise<void> {
        console.trace('Nothing to do on shutdown');
    }
}
