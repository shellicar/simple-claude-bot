targetScope = 'resourceGroup'

@minLength(3)
param storageName string

param insightsName string

@minLength(1)
param principalIds array

// Storage Blob Data Owner - on storage account (for AzureWebJobsStorage)
resource blobDataOwner 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  scope: subscription()
}

// Monitoring Metrics Publisher - on App Insights
resource monitoringMetricsPublisher 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '3913510d-42f4-4e42-8a64-420c390055eb'
  scope: subscription()
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName
}

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: insightsName
}

// Storage Blob Data Owner on storage account (for AzureWebJobsStorage)
resource storageOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for id in principalIds: {
    name: guid(storage.id, blobDataOwner.name, id)
    scope: storage
    properties: {
      principalId: id
      roleDefinitionId: blobDataOwner.id
      principalType: 'ServicePrincipal'
    }
  }
]

// Monitoring Metrics Publisher on App Insights
resource insightsAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for id in principalIds: {
    name: guid(insights.id, monitoringMetricsPublisher.name, id)
    scope: insights
    properties: {
      principalId: id
      roleDefinitionId: monitoringMetricsPublisher.id
      principalType: 'ServicePrincipal'
    }
  }
]
