import { Instance } from './Instance';

export abstract class BasicInstance implements Instance {
    protected runningTask: boolean;

    abstract shutdown(): void | Promise<void>;

    constructor() {
        this.runningTask = false;
    }

    isFree(): boolean {
        return !this.runningTask;
    }

    async submit<R>(task: (i: this) => Promise<R>): Promise<R> {
        await this.lock();
        return task(this).finally(() => this.release());
    }

    lock(): void | Promise<void> {
        this.runningTask = true;
    }

    release(): void | Promise<void> {
        this.runningTask = false;
    }
}
