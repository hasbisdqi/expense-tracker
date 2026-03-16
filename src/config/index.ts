interface Config {
  env: "localhost" | "staging" | "production";
  gDrive: {
    clientId: string;
    clientSecret: string;
  };
  appVersion: string;
  buildTime: string;
}

export const config: Config = {
  env: import.meta.env.VITE_ENV ?? "localhost",
  gDrive: {
    clientId: import.meta.env.VITE_GOOGLE_CLOUD_DRIVE_OAUTH2_CLIENT_ID ?? "",
    clientSecret: import.meta.env.VITE_GOOGLE_CLOUD_DRIVE_OAUTH2_CLIENT_SECRET ?? "",
  },
  appVersion: __APP_VERSION__,
  buildTime: new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }),
};
