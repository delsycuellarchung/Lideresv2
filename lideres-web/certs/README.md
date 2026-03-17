# Certificados para pruebas TLS

Coloca aquí el certificado raíz (CA) que firma el certificado del servidor SMTP.

1. Crea la carpeta `certs/` en la raíz del proyecto (ya existe).
2. Copia el archivo PEM de la CA y nómbralo `ca.crt`.
3. No añadas archivos privados al control de versiones. Si quieres ignorarlos, añade `certs/*.crt` a tu `.gitignore`.

Correr la aplicación (desarrollo) usando este CA:

Windows PowerShell (desde la raíz `lideres-web`):

```powershell
npm install --no-audit --no-fund
npx cross-env NODE_EXTRA_CA_CERTS=./certs/ca.crt node ./scripts/predev.js && npx cross-env NODE_EXTRA_CA_CERTS=./certs/ca.crt next dev
```

Linux/macOS:

```bash
npm install --no-audit --no-fund
NODE_EXTRA_CA_CERTS=./certs/ca.crt node ./scripts/predev.js && NODE_EXTRA_CA_CERTS=./certs/ca.crt next dev
```

Alternativas:
- Instalar la CA en el almacén de certificados del sistema y ejecutar Node con `--use-system-ca` si tu Node soporta `--use-system-ca`.
- Para producción, instala la CA en el servidor o usa certificados emitidos por una CA pública (Let's Encrypt, etc.).
