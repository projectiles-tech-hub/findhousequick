import { addressKey } from './address.js';

describe('addressKey', () => {
  it('matches the same address written differently', () => {
    const a = addressKey({ cityId: 'c1', area: 'Ugbowo', street: 'Ekosodin Road', houseNumber: 'No. 12' });
    const b = addressKey({ cityId: 'c1', area: ' ugbowo ', street: 'ekosodin rd.', houseNumber: '12' });
    expect(a).toBe(b);
  });

  it('keeps different houses and cities apart', () => {
    const a = addressKey({ cityId: 'c1', area: 'Ugbowo', street: 'Ekosodin Road', houseNumber: '12' });
    expect(addressKey({ cityId: 'c1', area: 'Ugbowo', street: 'Ekosodin Road', houseNumber: '14' })).not.toBe(a);
    expect(addressKey({ cityId: 'c2', area: 'Ugbowo', street: 'Ekosodin Road', houseNumber: '12' })).not.toBe(a);
  });
});
