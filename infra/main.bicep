targetScope = 'resourceGroup'

param location string = 'australiaeast'
param locationCode string = 'aue'
param env string = 'dev'

var org = 'sgh'
var project = 'banananet'

var insightsName = '${org}-appi-${locationCode}-${env}-${project}-01'
var storageName = '${org}sa${locationCode}${env}${project}01'
var planName = '${org}-plan-${locationCode}-${env}-${project}-01'
var funcName = '${org}-func-${locationCode}-${env}-${project}-01'

var uamiName = '${org}-uami-${locationCode}-${env}-${project}-01'
var sandboxShareName = 'sandbox'
var homeShareName = 'home'
var auditShareName = 'audit'

resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
  tags: {
    'hidden-title': 'BananaNet - Managed Identity'
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2025-07-01' existing = {
  name: 'DefaultWorkspace-383d501b-3906-496b-ac90-e336189d628f-EAU'
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'DefaultResourceGroup-EAU')
}

module insights 'br/public:avm/res/insights/component:0.6.0' = {
  name: '${deployment().name}-insights'
  params: {
    name: insightsName
    location: location
    tags: {
      'hidden-title': 'BananaNet - Application Insights'
    }
    workspaceResourceId: logs.id
    kind: 'web'
    applicationType: 'web'
    retentionInDays: 30
    samplingPercentage: 100
  }
}

module storage 'br/public:avm/res/storage/storage-account:0.26.2' = {
  name: '${deployment().name}-storage'
  params: {
    name: storageName
    location: location
    tags: {
      'hidden-title': 'BananaNet - Storage'
    }
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    requireInfrastructureEncryption: false
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Allow'
    }
    blobServices: {}
    fileServices: {
      shares: [
        {
          name: homeShareName
          shareQuota: 5
        }
        {
          name: sandboxShareName
          shareQuota: 5
        }
        {
          name: auditShareName
          shareQuota: 5
        }
      ]
    }
  }
}

module functionApp 'modules/function-app.bicep' = {
  name: '${deployment().name}-func'
  params: {
    funcName: funcName
    planName: planName
    location: location
    storageName: storage.outputs.name
    insightsConnectionString: insights.outputs.connectionString
    insightsName: insightsName
    uamiId: uami.id
    uamiClientId: uami.properties.clientId
    uamiPrincipalId: uami.properties.principalId
    sandboxShareName: sandboxShareName
    homeShareName: homeShareName
    auditShareName: auditShareName
  }
}

output functionAppName string = functionApp.outputs.name
output functionAppUrl string = 'https://${functionApp.outputs.defaultHostName}'
output storageName string = storage.outputs.name
output uamiClientId string = uami.properties.clientId
