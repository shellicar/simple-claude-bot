targetScope = 'resourceGroup'

param location string = 'australiaeast'
param locationCode string = 'aue'
param env string = 'dev'
param imageTag string = 'latest'
param firstDeploy bool = false

var org = 'sgh'
var project = 'banananet'

var insightsName = '${org}-appi-${locationCode}-${env}-${project}-01'
var storageName = '${org}sa${locationCode}${env}${project}01'
var appName = '${org}-ca-${locationCode}-${env}-${project}-01'
var envName = '${org}-cae-${locationCode}-${env}-${project}-01'
var acrName = '${org}acr${locationCode}01'
var imageName = '${project}-brain'

var uamiName = '${org}-uami-${locationCode}-${env}-${project}-01'
var sandboxShareName = 'sandbox'
var homeShareName = 'home'
var auditShareName = 'audit'

// AcrPull role definition
resource acrPullRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  scope: subscription()
}

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

// ACR — shared tenant-level, deployed separately via modules/container-registry.bicep
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'CentralRG')
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

module containerEnv 'modules/container-apps-env.bicep' = {
  name: '${deployment().name}-env'
  params: {
    envName: envName
    location: location
    logAnalyticsCustomerId: logs.properties.customerId
    logAnalyticsSharedKey: logs.listKeys().primarySharedKey
    storageName: storage.outputs.name
    homeShareName: homeShareName
    sandboxShareName: sandboxShareName
    auditShareName: auditShareName
  }
}

resource storageRef 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName
  dependsOn: [ storage ]
}


resource containerAppRef 'Microsoft.App/containerapps@2025-02-02-preview' existing = if (!firstDeploy) {
  name: appName
}

module containerApp 'modules/container-app.bicep' = {
  name: '${deployment().name}-app'
  params: {
    appName: appName
    location: location
    environmentId: containerEnv.outputs.id
    acrLoginServer: acr.properties.loginServer
    image: containerAppRef.?properties.template.containers[0].image
    defaultImageName: imageName
    defaultImageTag: imageTag
    uamiId: uami.id
    insightsConnectionString: insights.outputs.connectionString
    storageConnectionString: 'DefaultEndpointsProtocol=https;AccountName=${storageRef.name};AccountKey=${storageRef.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
  }
}

// AcrPull role assignment — UAMI can pull images from shared ACR
module acrRoleAssignment 'modules/acr-role-assignment.bicep' = {
  name: '${deployment().name}-acr-role'
  scope: resourceGroup('383d501b-3906-496b-ac90-e336189d628f', 'CentralRG')
  params: {
    acrName: acrName
    principalId: uami.properties.principalId
    roleDefinitionId: acrPullRole.id
  }
}

module assignment 'modules/assignment.bicep' = {
  name: '${deployment().name}-assignment'
  params: {
    principalIds: [uami.properties.principalId]
    storageName: storage.outputs.name
    insightsName: insightsName
  }
}

output appName string = containerApp.outputs.name
output appUrl string = 'https://${containerApp.outputs.fqdn}'
output storageName string = storage.outputs.name
output uamiClientId string = uami.properties.clientId
