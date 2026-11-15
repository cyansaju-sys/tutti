/** Archivos que casi seguro guardan secretos (claves, credenciales, .env): no se adjuntan al chat ni se listan para citarlos. */
const SENSITIVE = /^(\.env(\.(?!example$|sample$|template$|dist$).+)?|\.npmrc|\.netrc|\.pgpass|id_(rsa|dsa|ecdsa|ed25519)|credentials(\.json)?|.*\.(pem|key|p12|pfx|jks|keystore|kdbx)|.*secrets?\.(json|ya?ml|toml|env))$/i

export const isSensitive = (path: string): boolean => SENSITIVE.test(path.split(/[\\/]/).pop() ?? path)

/** Lo mismo como exclusiones de pathspec de git, para que un diff no los traiga. */
export const GIT_EXCLUDE = ['**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/id_rsa', '**/id_ed25519', '**/.npmrc', '**/.netrc'].map((g) => `:(exclude,glob)${g}`)
