targetScope = 'resourceGroup'

param appName string
param location string
param environmentId string
param acrLoginServer string
param defaultImageName string
param defaultImageTag string
param image string?
param uamiId string
@secure()
param insightsConnectionString string
@secure()
param discordToken string
param discordGuild string
param brainUrl string
@secure()
param brainKey string
param sandboxEnabled string
param botAliases string = ''

var resolvedImage = image ?? '${acrLoginServer}/${defaultImageName}:${defaultImageTag}'

resource app 'Microsoft.App/containerapps@2025-02-02-preview' = {
  name: appName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Ears'
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
      registries: [
        {
          server: acrLoginServer
          identity: uamiId
        }
      ]
      secrets: [
        {
          name: 'appinsightsconnectionstring'
          value: insightsConnectionString
        }
        {
          name: 'discordtoken'
          value: discordToken
        }
        {
          name: 'brainkey'
          value: brainKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ears'
          image: resolvedImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsightsconnectionstring'
            }
            {
              name: 'DISCORD_TOKEN'
              secretRef: 'discordtoken'
            }
            {
              name: 'BRAIN_KEY'
              secretRef: 'brainkey'
            }
            {
              name: 'DISCORD_GUILD'
              value: discordGuild
            }
            {
              name: 'BRAIN_URL'
              value: brainUrl
            }
            {
              name: 'SANDBOX_ENABLED'
              value: sandboxEnabled
            }
            {
              name: 'BOT_ALIASES'
              value: botAliases
            }
            {
              name: 'TZ'
              value: 'Australia/Melbourne'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output name string = app.name
