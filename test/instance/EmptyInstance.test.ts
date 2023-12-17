import {EmptyInstance} from '../../src/instance/EmptyInstance'

describe("EmptyInstance", () => {
    it("does nothing on shutdown", () => {
        const instance = new EmptyInstance()
        expect(instance.shutdown()).toBe(undefined)
    })
})