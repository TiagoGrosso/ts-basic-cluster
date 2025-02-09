import { SimpleInstance } from '../../main/instance/SimpleInstance';

describe('SimpleInstance', () => {
    it('does nothing on shutdown', () => {
        const instance = new SimpleInstance(1);
        expect(instance.shutdown()).toBe(undefined);
    });

    it('gets value', () => {
        const random = Math.floor(Math.random() * 1000);
        const instance = new SimpleInstance(random);
        expect(instance.getContext()).toEqual(random);
    });
});
