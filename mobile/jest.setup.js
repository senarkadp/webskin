/* global jest */
// Test doubles for native modules that can't run in Node

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Fake WebView: records its props and the scripts injected into it
global.__web = { props: null, injected: [], ref: null };
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => {
    global.__web.props = props;
    React.useImperativeHandle(ref, () => {
      const api = {
        injectJavaScript: (s) => global.__web.injected.push(s),
        goBack: jest.fn(),
        goForward: jest.fn(),
        reload: jest.fn(),
      };
      global.__web.ref = api;
      return api;
    });
    return React.createElement(View, { testID: 'webview' });
  });
  return { WebView };
});
