import { EmptyInstance } from '../../main/instance/EmptyInstance';

describe('EmptyInstance', () => {
    it('does nothing on shutdown', () => {
        const instance = new EmptyInstance();
        expect(instance.shutdown()).toBe(undefined);
    });
});
