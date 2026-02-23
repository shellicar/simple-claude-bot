targetScope = 'resourceGroup'

param funcName string
param planName string
param location string
param storageName string
param insightsConnectionString string
param insightsName string
param uamiId string
param uamiClientId string
param uamiPrincipalId string
param sandboxShareName string
param homeShareName string
param auditShareName string

var containerName = 'app-package-${funcName}-${substring(uniqueString(functionId, storageName), 0, 7)}'
var functionId = resourceId('Microsoft.Web/sites', funcName)

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName

  resource blobServices 'blobServices' existing = {
    name: 'default'

    resource container 'containers' = {
      name: containerName
      properties: {
        publicAccess: 'None'
      }
    }
  }
}

module plan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: '${deployment().name}-plan'
  params: {
    name: planName
    tags: {
      'hidden-title': 'BananaNet - App Service Plan'
    }
    skuName: 'FC1'
    skuCapacity: 0
    kind: 'functionApp'
    reserved: true
    zoneRedundant: false
  }
}

module func 'br/public:avm/res/web/site:0.21.0' = {
  name: '${deployment().name}-func'
  params: {
    name: funcName
    tags: {
      'hidden-title': 'BananaNet - Brain'
    }
    managedIdentities: {
      userAssignedResourceIds: [uamiId]
    }
    kind: 'functionapp,linux'
    serverFarmResourceId: plan.outputs.resourceId
    publicNetworkAccess: 'Enabled'
    httpsOnly: true
    location: location
    clientAffinityEnabled: false
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: 'https://${storage.name}.blob.${environment().suffixes.storage}/${containerName}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: uamiId
          }
        }
      }
      runtime: {
        name: 'node'
        version: '22'
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 1
        instanceMemoryMB: 2048
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insightsConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'ClientId=${uamiClientId};Authorization=AAD'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: uamiClientId
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: 'https://${storageName}.blob.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: 'https://${storageName}.queue.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: 'https://${storageName}.table.${environment().suffixes.storage}'
        }
        {
          name: 'TZ'
          value: 'Australia/Melbourne'
        }
      ]
    }
    basicPublishingCredentialsPolicies: [
      {
        name: 'scm'
        allow: false
      }
      {
        name: 'ftp'
        allow: false
      }
    ]
    configs: [
      {
        name: 'web'
        properties: {
          http20Enabled: true
          alwaysOn: false
          use32BitWorkerProcess: false
          minTlsVersion: '1.2'
          ftpsState: 'Disabled'
        }
      }
      {
        name: 'azurestorageaccounts'
        properties: {
          home: {
            type: 'AzureFiles'
            shareName: homeShareName
            mountPath: '/bot'
            accountName: storage.name
            accessKey: storage.listKeys().keys[0].value
            protocol: 'Smb'
          }
          sandbox: {
            type: 'AzureFiles'
            shareName: sandboxShareName
            mountPath: '/sandbox'
            accountName: storage.name
            accessKey: storage.listKeys().keys[0].value
            protocol: 'Smb'
          }
          audit: {
            type: 'AzureFiles'
            shareName: auditShareName
            mountPath: '/audit'
            accountName: storage.name
            accessKey: storage.listKeys().keys[0].value
            protocol: 'Smb'
          }
        }
      }
    ]
  }
}

module assignment 'assignment.bicep' = {
  name: '${deployment().name}-assignment'
  params: {
    principalIds: [uamiPrincipalId]
    storageName: storageName
    blobContainerName: containerName
    insightsName: insightsName
  }
}

output defaultHostName string = func.outputs.defaultHostname
output name string = func.name
