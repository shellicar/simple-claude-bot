// Shared tenant-level ACR — deployed separately from main.bicep
// Basic SKU, standard RBAC (LegacyRegistryPermissions), no ABAC
targetScope = 'resourceGroup'

param registryName string
param location string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  tags: {
    'hidden-title': 'Shared Container Registry'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

output name string = acr.name
output loginServer string = acr.properties.loginServer
output id string = acr.id
