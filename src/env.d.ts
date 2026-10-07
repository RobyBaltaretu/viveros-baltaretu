interface ImportMetaEnv {
  /** Proyecto de Keystatic Cloud, con el formato "equipo/proyecto". */
  readonly PUBLIC_KEYSTATIC_CLOUD_PROJECT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
