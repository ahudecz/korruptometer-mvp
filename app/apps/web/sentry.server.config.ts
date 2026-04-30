import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      const headers = event.request.headers ?? {};
      for (const key of Object.keys(headers)) {
        if (/email|name|reporter|ip|x-forwarded/i.test(key)) {
          delete (headers as Record<string, string>)[key];
        }
      }
    }
    return event;
  },
});
