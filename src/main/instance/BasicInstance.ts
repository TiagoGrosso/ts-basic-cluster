import { Instance } from './Instance';

export abstract class BasicInstance<C> implements Instance<C> {
    /**
     * The context of the instance.
     */
    private context: C;

    protected runningTask: boolean;

    abstract shutdown(): void | Promise<void>;

    constructor(context: C) {
        this.runningTask = false;
        this.context = context;
    }

    isFree(): boolean {
        return !this.runningTask;
    }

    async submit<R>(task: (i: C) => Promise<R>): Promise<R> {
        await this.lock();
        return task(this.context).finally(() => this.release());
    }

    lock(): void | Promise<void> {
        this.runningTask = true;
    }

    release(): void | Promise<void> {
        this.runningTask = false;
    }

    /**
     * Gets the context of the instance.
     *
     * @returns the context of the instance.
     */
    public getContext(): C {
        return this.context;
    }
}
