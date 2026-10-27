# SweetHarvest — Azure Hosting Guide (Personal Use, No Domain Required)

SweetHarvest can be hosted directly on **Azure App Service** or **Azure Container Apps** using the default Microsoft domain (`https://<your-app-name>.azurewebsites.net`) completely free or on the B1 basic tier.

---

## Architecture on Azure

```
                User Browser
                     │
                     ▼
  https://sweetharvest-app.azurewebsites.net
  ┌──────────────────────────────────────────────┐
  │ Azure App Service (Node.js 20 Linux)         │
  │                                              │
  │  Express Server (Port 80/8080)               │
  │  ├── Serves SPA Frontend (React + Vite)      │
  │  ├── REST API Routes (/api/*)                │
  │  └── SQLite Database (sweetharvest.db)       │
  │      Stored in persistent /home volume       │
  └──────────────────────────────────────────────┘
```

---

## Option 1: Quick Deployment via Azure CLI (Recommended)

### Step 1: Open Terminal and Login to Azure
```bash
az login
```

### Step 2: Create a Resource Group (Central India or East US)
```bash
az group create --name SweetHarvest-RG --location centralindia
```

### Step 3: Create an App Service Plan (Free F1 or Basic B1)
```bash
az appservice plan create \
  --name SweetHarvest-Plan \
  --resource-group SweetHarvest-RG \
  --sku B1 \
  --is-linux
```
*(Note: B1 provides always-on and persistent storage for your SQLite database)*

### Step 4: Create the Web App
Replace `<your-unique-app-name>` with a name like `sweetharvest-personal`:
```bash
az webapp create \
  --resource-group SweetHarvest-RG \
  --plan SweetHarvest-Plan \
  --name <your-unique-app-name> \
  --runtime "NODE:20-lts"
```

### Step 5: Configure Persistent Storage & Environment
```bash
az webapp config appsettings set \
  --resource-group SweetHarvest-RG \
  --name <your-unique-app-name> \
  --settings \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=true \
    NODE_ENV=production \
    JWT_SECRET=sweetharvest-super-secret-key-change-this
```

### Step 6: Deploy the Built App (ZIP Deploy)
Run the build script in this workspace:
```powershell
npm run build
```
Then deploy the zip package:
```bash
az webapp deploy \
  --resource-group SweetHarvest-RG \
  --name <your-unique-app-name> \
  --src-path deploy.zip \
  --type zip
```

Your app will be live immediately at:
`https://<your-unique-app-name>.azurewebsites.net`

---

## Option 2: Deploy via Docker Container

If you prefer containers:
```bash
# Build and tag
docker build -t sweetharvest:latest .

# Run locally to test
docker run -p 3001:80 sweetharvest:latest
```
Then push to Azure Container Registry or Docker Hub, and configure your Azure Web App to run that container.

---

## Default Login Credentials
Once deployed, log in with:
- **Email:** `admin@sweetharvest.com`
- **Password:** `admin123`
*(Change this in the Users or Profile settings after initial login)*

