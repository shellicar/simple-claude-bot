targetScope = 'resourceGroup'

@minLength(3)
param storageName string

param blobContainerName string

param insightsName string

@minLength(1)
param principalIds array

// Storage Blob Data Owner - on storage account
resource blobDataOwner 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  scope: subscription()
}

// Storage Blob Data Contributor - on blob container
resource blobDataContributor 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  scope: subscription()
}

// Monitoring Metrics Publisher - on App Insights
resource monitoringMetricsPublisher 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '3913510d-42f4-4e42-8a64-420c390055eb'
  scope: subscription()
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName

  resource blobServices 'blobServices' existing = {
    name: 'default'

    resource container 'containers' existing = {
      name: blobContainerName
    }
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: insightsName
}

// Storage Blob Data Owner on storage account (for deployment + AzureWebJobsStorage)
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

// Storage Blob Data Contributor on blob container (for app package deployment)
resource containerContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for id in principalIds: {
    name: guid(storage::blobServices::container.id, blobDataContributor.name, id)
    scope: storage::blobServices::container
    properties: {
      principalId: id
      roleDefinitionId: blobDataContributor.id
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
