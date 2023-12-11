import { Instance } from './Instance';

export class EmptyInstance implements Instance {
    shutdown(): void | Promise<void> {
        // nothing to do
    }
    
}