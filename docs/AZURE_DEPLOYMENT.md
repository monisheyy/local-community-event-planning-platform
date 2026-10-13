# Deploying to Microsoft Azure

This guide puts the whole platform on Azure:

| Azure service | Purpose | Approx. tier |
| --- | --- | --- |
| **Resource group** | Holds every resource for the project | — |
| **Azure SQL Database** | Users, events, registrations, comments, notifications | Basic (5 DTU) or Free offer |
| **Storage account (Blob)** | Event cover images in a private `event-images` container | Standard LRS |
| **App Service (Linux, Node 22)** | Runs the Express API **and** serves the React build | B1 (or F1 Free) |
| **Application Insights** | Azure Monitor telemetry: requests, errors, response times | Pay-as-you-go (free allowance) |
| **Key Vault** *(optional)* | Stores secrets referenced by App Service settings | Standard |

> The commands use **Azure CLI** (`az`). Install it from https://aka.ms/installazurecli or use **Cloud Shell** in the Azure Portal, which already has it. Portal click-paths are given for each step too. Replace every `<...>` value. Names marked *globally unique* must be unique across all of Azure.

---

## 0. Sign in and choose names

```bash
az login

RG=rg-community-events
LOC=centralindia
SQL_SERVER=<sql-server-name>          # globally unique, e.g. ce-sql-team20
SQL_DB=communityevents
SQL_ADMIN=sqladminuser
SQL_PASSWORD='<Str0ng-Passw0rd!>'
STORAGE=<storageaccountname>          # globally unique, 3-24 lowercase letters/digits, e.g. cestorageteam20
PLAN=plan-community-events
APP=<web-app-name>                    # globally unique, becomes https://<APP>.azurewebsites.net
```

> **Azure for Students:** some regions or SKUs may be restricted by policy. If a command fails with *"RequestDisallowedByPolicy"* or a quota error, try `LOC=southindia`, `eastus` or `westeurope`.

## 1. Resource group

```bash
az group create --name $RG --location $LOC
```
*Portal:* Resource groups → Create.

## 2. Azure SQL Database

```bash
az sql server create -g $RG -n $SQL_SERVER -l $LOC \
  --admin-user $SQL_ADMIN --admin-password "$SQL_PASSWORD"

# Allow Azure services (App Service) to reach the server
az sql server firewall-rule create -g $RG -s $SQL_SERVER -n AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# Allow your own PC (for running db:init / db:seed from your laptop)
az sql server firewall-rule create -g $RG -s $SQL_SERVER -n MyPC \
  --start-ip-address <your-public-ip> --end-ip-address <your-public-ip>

az sql db create -g $RG -s $SQL_SERVER -n $SQL_DB --service-objective Basic
```
*Portal:* SQL databases → Create → new server (SQL authentication) → Compute + storage: **Basic**. Under **Networking**, enable *Allow Azure services and resources to access this server* and *Add current client IP address*.

Connection string (ADO.NET format, used by the app):

```
Server=tcp:<SQL_SERVER>.database.windows.net,1433;Database=communityevents;User Id=<SQL_ADMIN>;Password=<SQL_PASSWORD>;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;
```

**Creating the tables.** You don't need to do anything: the API runs `backend/src/db/schema.mssql.sql` automatically on start-up, and it is idempotent. You can also paste that file into the Portal's **Query editor** yourself.

## 3. Storage account for images

```bash
az storage account create -g $RG -n $STORAGE -l $LOC --sku Standard_LRS \
  --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false

az storage account show-connection-string -g $RG -n $STORAGE -o tsv
```
*Portal:* Storage accounts → Create → Standard / LRS. Then open **Security + networking → Access keys** and copy *Connection string*.

The app creates the private `event-images` container on first upload. Public blob access stays **disabled**, and images are served through `GET /api/files/:name`.

## 4. App Service (Linux, Node 22)

```bash
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP --runtime "NODE:22-lts"

# HTTPS only + health check
az webapp update -g $RG -n $APP --https-only true
az webapp config set -g $RG -n $APP --startup-file "npm start" --generic-configurations '{"healthCheckPath": "/api/health"}'
```
*Portal:* App Services → Create → Web App → Publish: **Code**, Runtime stack: **Node 22 LTS**, OS: **Linux**, Pricing plan **Basic B1**.

## 5. Application settings (environment variables)

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
az webapp config appsettings set -g $RG -n $APP --settings \
  NODE_ENV=production \
  JWT_SECRET="<paste-generated-secret>" \
  AZURE_SQL_CONNECTION_STRING="<connection string from step 2>" \
  AZURE_STORAGE_CONNECTION_STRING="<connection string from step 3>" \
  AZURE_STORAGE_CONTAINER=event-images \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  SEED_DEMO_DATA=true
```
*Portal:* App Service → **Settings → Environment variables → App settings** → add each one → Apply.

`SEED_DEMO_DATA=true` loads the demo users and events the first time (only when the users table is empty). Remove it after the first start if you like.

## 6. Application Insights (Azure Monitor)

```bash
az extension add --name application-insights
az monitor app-insights component create -g $RG -l $LOC --app ai-community-events --kind web
CONN=$(az monitor app-insights component show -g $RG --app ai-community-events --query connectionString -o tsv)
az webapp config appsettings set -g $RG -n $APP --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$CONN"
```
*Portal:* App Service → **Monitoring → Application Insights → Turn on**.

## 7. Deploy the code

### Option A — from your laptop (fastest)

```bash
npm run build:azure        # builds React into backend/public
```

Zip the **contents** of the `backend` folder, without `node_modules`, `data`, `uploads` or `.env`:

*macOS / Linux / Cloud Shell*
```bash
cd backend && zip -r ../deploy.zip . -x "node_modules/*" "data/*" "uploads/*" ".env" && cd ..
```
*Windows PowerShell*
```powershell
cd backend
Get-ChildItem -Force | Where-Object { $_.Name -notin 'node_modules','data','uploads','.env' } |
  Compress-Archive -DestinationPath ..\deploy.zip -Force
cd ..
```

Deploy:
```bash
az webapp deploy -g $RG -n $APP --src-path deploy.zip --type zip
```

App Service runs `npm install` (because of `SCM_DO_BUILD_DURING_DEPLOYMENT=true`) and then `npm start`. Open `https://<APP>.azurewebsites.net` and check `https://<APP>.azurewebsites.net/api/health`. It should report `"databaseDriver":"mssql"` and `"storageDriver":"azure-blob"`.

### Option B — GitHub Actions (CI/CD)

1. Push the project to a GitHub repository.
2. In the Portal, open the App Service → **Overview → Download publish profile**. If the download is disabled, turn on **Configuration → General settings → SCM Basic Auth Publishing Credentials** first.
3. In GitHub, open **Settings → Secrets and variables → Actions**:
   - Add the secret `AZURE_WEBAPP_PUBLISH_PROFILE` with the whole publish profile file as its value.
   - Add the variable `AZURE_WEBAPP_NAME` with your App Service name as its value.
4. Push to `main`. `.github/workflows/azure-deploy.yml` runs the tests, builds the frontend and deploys.

## 8. (Optional) Key Vault for secrets

```bash
az keyvault create -g $RG -n <kv-name> -l $LOC --enable-rbac-authorization false
az keyvault secret set --vault-name <kv-name> -n SqlConnection --value "<sql connection string>"
az webapp identity assign -g $RG -n $APP
PRINCIPAL=$(az webapp identity show -g $RG -n $APP --query principalId -o tsv)
az keyvault set-policy -n <kv-name> --object-id $PRINCIPAL --secret-permissions get list
az webapp config appsettings set -g $RG -n $APP --settings \
  AZURE_SQL_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=<kv-name>;SecretName=SqlConnection)"
```
App Service resolves the reference at runtime, so the secret never appears in the app's configuration.

## 9. Backups

Azure SQL Database takes **automatic backups** (point-in-time restore, 7 days on Basic). To restore, go to *Portal → SQL database → Restore*. For Blob Storage, enable **soft delete for blobs** under *Storage account → Data protection*.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/health` returns 503 / `database: unavailable` | Check the SQL firewall rule *Allow Azure services* and the connection string (user, password, database name). |
| *Login failed for user* | The username in the connection string must be the SQL admin login, without `@server`. |
| Image upload fails | Check `AZURE_STORAGE_CONNECTION_STRING`. The account key may have been rotated. |
| Application Error page | Open *App Service → Log stream*. The API logs its startup line and any errors. |
| Start-up error *Missing required environment variable: JWT_SECRET* | Add `JWT_SECRET` in App settings (required when `NODE_ENV=production`). |
| Blank page on refresh of `/events/...` | Make sure `npm run build:azure` ran, so `backend/public/index.html` is in the zip. |

## Clean up (avoid charges)

```bash
az group delete --name $RG --yes --no-wait
```
