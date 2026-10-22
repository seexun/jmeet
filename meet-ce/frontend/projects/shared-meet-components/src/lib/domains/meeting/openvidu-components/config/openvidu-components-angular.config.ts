import { InjectionToken } from '@angular/core';
import { ParticipantProperties } from '../models/participant.model';

export interface OpenViduComponentsConfig {
	production?: boolean;
	participantFactory?: ParticipantFactoryFunction;
}

export type ParticipantFactoryFunction = (props: ParticipantProperties) => any;

export const OPENVIDU_COMPONENTS_CONFIG = new InjectionToken<OpenViduComponentsConfig>('OPENVIDU_COMPONENTS_CONFIG');
