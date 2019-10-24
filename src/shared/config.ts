export const ignoredMetadataTypes: string[] = ['AccountForecastSettings', 'AIAssistantTemplate', 'ApexTestSuite',
    'AppleDomainVerification', 'AssistantSkillQuickAction',
    'AssistantSkillSobjectAction', 'Audience', 'BlockchainSettings', 'Bot', 'BotSettings', 'BotVersion',
    'CampaignInfluenceModel', 'CaseSubjectParticle', 'ChatterEmailsMDSettings', 'ChatterExtension', 'CleanDataService',
    'CMSConnectSource', 'DataDotComSettings', 'DataPipeline', 'DelegateGroup', 'DeploymentSettings', 'DevHubSettings', 'Document',
    'EssentialsSettings', 'EssentialsTrialOrgSettings', 'FeatureParameterBoolean', 'FeatureParameterDate', 'FeatureParameterInteger',
    'GoogleAppsSettings', 'HighVelocitySalesSettings', 'Index', 'IndMfgSalesAgreementSettings', 'IndustriesManufacturingSettings',
    'IndustriesSettings', 'InstalledPackage', 'IntegrationHubSettings', 'IntegrationHubSettingsType', 'IoTSettings', 'IsvHammerSettings',
    'ListView', 'LoginFlow',
    'MarketingActionSettings', 'MarketingResourceType', 'MlDomain', 'MyDomainDiscoverableLogin', 'MyDomainSettings', 'Orchestration',
    'OrchestrationContext', 'OrderManagementSettings', 'OrderSettings', 'Package', 'PardotEinsteinSettings', 'PardotSettings',
    'PardotTenant', 'ProfilePasswordPolicy', 'Prompt', 'QuoteSettings', 'RetailExecutionSettings', 'Role', 'Scontrol',
    'SharingCriteriaRule', 'SharingOwnerRule', 'SharingRules',
    'SharingTerritoryRule', 'SocialCustomerServiceSettings',
    'SocialProfileSettings', 'Territory', 'Territory2', 'Territory2Model', 'Territory2Rule', 'Territory2Settings', 'Territory2Type',
    'TimeSheetTemplate', 'TrailheadSettings', 'WorkDotComSettings',

    'CustomObject', 'Group', 'Queue', 'QueueRoutingConfig', 'Report', 'Dashboard'];

// Ensure below line of metadata types are excluded from using listMetadataQuery. Tooling setup objects can be
// queried directly. listMetadata query performance is not optimal in a complex org that has sample volume
// as below (Class - 7944, Component - 329, Page - 1879, StaticResource - 1045, Trigger - 747, CustomObject - 1829)
export const ignoreComponentMap: Map<string, string[]> = new Map([
    ['Profile', ['Standard', 'ReadOnly', 'ContractManager', 'StandardAul', 'MarketingProfile', 'Company Communities User', 'Premier Support User', 'SolutionManager',
        'SalesforceIQ Integration User', 'Sales Insights Integration User', 'Analytics Cloud Integration User', 'Analytics Cloud Security User',
        'Force.com - App Subscription User']
    ]]);

// const toolingQueryByNameWithNamespace: string[] = ['ApexClass', 'ApexComponent', 'ApexPage', 'ApexTrigger',
//     'BusinessProcess', 'StaticResource', 'WebLink'];
export const toolingQueryByNameWithNamespace: Map<string, string> = new Map([
    ['ApexClass', 'ApexClass'],
    ['ApexComponent', 'ApexComponent'],
    ['ApexPage', 'ApexPage'],
    ['ApexTrigger', 'ApexTrigger'],
    ['BusinessProcess', 'BusinessProcess'],
    ['CustomLabel', 'ExternalString'],
    ['StaticResource', 'StaticResource'],
    ['WebLink', 'WebLink']
]);
export const toolingQueryByDeveloperNameWithNamespace: Map<string, string> = new Map([
    ['AuraDefinitionBundle', 'AuraDefinitionBundle'],
    ['CustomHelpMenuSection', 'CustomHelpMenuSection'],
    ['CustomPermission', 'CustomPermission'],
    ['ContentAsset', 'ContentAsset'],
    ['CspTrustedSite', 'CspTrustedSite'],
    ['EmailTemplate', 'EmailTemplate'],
    ['ExternalDataSource', 'ExternalDataSource'],
    ['LiveChatSensitiveDataRule', 'LiveChatSensitiveDataRule'],
    ['LightningExperienceTheme', 'LightningExperienceTheme'],
    ['MobileApplicationDetail', 'MobileApplicationDetail'],
    ['NamedCredential', 'NamedCredential'],
    ['PlatformCachePartition', 'PlatformCachePartition'],
    ['SamlSsoConfig', 'SamlSsoConfig'],
    ['TransactionSecurityPolicy', 'TransactionSecurityPolicy']
]);

// const toolingQueryByDeveloperNameWithNamespace: string[] = ['AuraDefinitionBundle', 'CustomHelpMenuSection',
//     'CustomPermission', 'ContentAsset', 'CspTrustedSite', 'EmailTemplate', 'ExternalDataSource',
//     'LiveChatSensitiveDataRule', 'LightningExperienceTheme', 'MobileApplicationDetail',
//     'NamedCredential', 'PlatformCachePartition', 'SamlSsoConfig', 'TransactionSecurityPolicy'];
export const toolingQueryByDeveloperNameWithoutNamespace: Map<string, string> = new Map([
    ['LiveChatButton', 'LiveChatButton'],
    ['OauthCustomScope', 'OauthCustomScope'],
    ['PresenceDeclineReason', 'PresenceDeclineReason'],
    ['PresenceUserConfig', 'PresenceUserConfig'],
    ['ServiceChannel', 'ServiceChannel'],
    ['ServicePresenceStatus', 'ServicePresenceStatus'],
    ['Skill', 'Skill']
]);