/**
 * Represents an instance that can run tasks.
 */
export interface Instance<C> {
    /**
     * Shuts down the instance.
     */
    shutdown(): void | Promise<void>;

    submit<R>(task: (i: C) => Promise<R>): Promise<R>;

    isFree(): boolean;
}
