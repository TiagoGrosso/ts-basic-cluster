/**
 * Represents an instance that can run tasks.
 */
export interface Instance {
    /**
     * Shuts down the instance.
     */
    shutdown(): void | Promise<void>;
}
