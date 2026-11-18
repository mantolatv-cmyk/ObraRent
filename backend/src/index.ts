import { createApp } from './app';

export const app = createApp();
export default app;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.createApp = createApp;
}
