targetScope = 'resourceGroup'

param insightsName string

@minLength(1)
param principalIds array

// Monitoring Metrics Publisher - on App Insights
resource monitoringMetricsPublisher 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '3913510d-42f4-4e42-8a64-420c390055eb'
  scope: subscription()
}

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: insightsName
}

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
