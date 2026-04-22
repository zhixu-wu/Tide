# Code signing (future)

Shipping an unsigned `.dmg` / `.msi` works for personal / internal use, but
first-launch shows scary warnings. To sign the installers:

## macOS (notarisation)

Prerequisites:

1. Apple Developer Program membership (US$99/yr).
2. "Developer ID Application" certificate (Apple Developer → Certificates →
   add new → Developer ID Application). Install the `.cer` into your login
   keychain.
3. App-specific password for notarisation (appleid.apple.com → sign-in →
   app-specific passwords).

Set environment variables before `npm run tauri build`:

```bash
export APPLE_CERTIFICATE="<base64 .p12 contents>"   # optional, if signing in CI
export APPLE_CERTIFICATE_PASSWORD="<p12 password>"  # optional, if signing in CI
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Update `src-tauri/tauri.conf.json`:

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
  "providerShortName": "TEAMID"
}
```

Then:

```bash
npm run tauri build
```

Tauri signs the `.app`, wraps it in the `.dmg`, and submits to Apple's
notary service. The notarisation round-trip adds a few minutes.

## Windows (Authenticode)

1. Obtain an EV or OV code-signing certificate from a CA (DigiCert, Sectigo…).
2. Import the certificate into the Windows certificate store, note its SHA-1
   thumbprint.
3. Update `src-tauri/tauri.conf.json`:

```json
"windows": {
  "certificateThumbprint": "<SHA1 thumbprint>",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

Then `npm run tauri build` on a Windows machine with `signtool.exe` in PATH.

## Status in this project

Neither platform is signed yet. Both `tauri.conf.json` slots (`signingIdentity`,
`certificateThumbprint`) are present but null. Distribute unsigned builds
with the caveat that first-launch requires right-click → Open (macOS) or
"More info → Run anyway" (Windows SmartScreen).
