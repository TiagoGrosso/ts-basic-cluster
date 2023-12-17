import {SimpleInstance} from '../../src/instance/SimpleInstance'

describe("SimpleInstance", () => {
    it("does nothing on shutdown", () => {
        const instance = new SimpleInstance(1)
        expect(instance.shutdown()).toBe(undefined)
    })
})