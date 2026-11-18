import { createApp } from './create-app';

const app = createApp();
(app as unknown as { default: typeof app; app: typeof app }).default = app;
(app as unknown as { default: typeof app; app: typeof app }).app = app;

export = app;
