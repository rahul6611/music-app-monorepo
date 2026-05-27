import './library.setup';

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const Platform = jest.requireActual('react-native/Libraries/Utilities/Platform');
  return {
    ...Platform,
    OS: 'web',
    select: (spec: Record<string, unknown>) =>
      'web' in spec ? spec.web : 'default' in spec ? spec.default : spec.native,
  };
});
