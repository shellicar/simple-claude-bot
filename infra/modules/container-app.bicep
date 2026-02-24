targetScope = 'resourceGroup'

param appName string
param location string
param environmentId string
param acrLoginServer string
param imageName string
param imageTag string
param uamiId string
param insightsConnectionString string
@secure()
param storageConnectionString string

var image = '${acrLoginServer}/${imageName}:${imageTag}'

resource app 'Microsoft.App/containerapps@2025-02-02-preview' = {
  name: appName
  location: location
  kind: 'functionapp'
  tags: {
    'hidden-title': 'BananaNet - Brain'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uamiId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'Auto'
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: [
        {
          server: acrLoginServer
          identity: uamiId
        }
      ]
      secrets: [
        {
          name: 'azurewebjobsstorage'
          value: storageConnectionString
        }
        {
          name: 'appinsightsconnectionstring'
          value: insightsConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'brain'
          image: image
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            {
              name: 'AzureWebJobsStorage'
              secretRef: 'azurewebjobsstorage'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsightsconnectionstring'
            }
            {
              name: 'FUNCTIONS_WORKER_RUNTIME'
              value: 'node'
            }
            {
              name: 'TZ'
              value: 'Australia/Melbourne'
            }
            {
              name: 'CLAUDE_CONFIG_DIR'
              value: '/bot/.claude'
            }
            {
              name: 'SANDBOX_ENABLED'
              value: 'true'
            }
            {
              name: 'SANDBOX_DIR'
              value: '/sandbox'
            }
            {
              name: 'BOT_HOME'
              value: '/bot'
            }
          ]
          volumeMounts: [
            {
              volumeName: 'home'
              mountPath: '/bot'
            }
            {
              volumeName: 'sandbox'
              mountPath: '/sandbox'
            }
            {
              volumeName: 'audit'
              mountPath: '/audit'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        cooldownPeriod: 300
        pollingInterval: 30
      }
      volumes: [
        {
          name: 'home'
          storageName: 'home'
          storageType: 'AzureFile'
        }
        {
          name: 'sandbox'
          storageName: 'sandbox'
          storageType: 'AzureFile'
        }
        {
          name: 'audit'
          storageName: 'audit'
          storageType: 'AzureFile'
        }
      ]
    }
  }
}

output name string = app.name
output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = app.identity.userAssignedIdentities[uamiId].principalId
