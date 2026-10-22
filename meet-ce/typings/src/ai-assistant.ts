/**
 * Assistant creation options
 */
export interface MeetCreateAssistantRequest {
	// scope: MeetAssistantScope;
	capabilities: MeetAssistantCapability[];
}

/**
 * Defines the scope of an assistant, i.e. the resource(s) it is associated with.
 */
// export interface MeetAssistantScope {
// 	resourceType: MeetAssistantScopeResourceType;
// 	resourceIds: string[];
// }

/**
 * Defines a capability that an assistant can have, such as live captions.
 */
export interface MeetAssistantCapability {
	name: MeetAssistantCapabilityName;
}

/**
 * Enumeration of supported assistant capabilities.
 */
export enum MeetAssistantCapabilityName {
	LIVE_CAPTIONS = 'live_captions',
}

/**
 * Enumeration of supported resource types that an assistant can be associated with.
 */
// export enum MeetAssistantScopeResourceType {
// 	MEETING = 'meeting',
// }


export interface MeetCreateAssistantResponse {
	id: string;
	status: 'active';
}
