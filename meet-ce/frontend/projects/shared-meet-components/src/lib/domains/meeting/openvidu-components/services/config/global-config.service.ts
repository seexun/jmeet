
import { inject, Injectable } from '@angular/core';
import {
	OPENVIDU_COMPONENTS_CONFIG,
	OpenViduComponentsConfig,
	ParticipantFactoryFunction
} from '../../config/openvidu-components-angular.config';

/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class GlobalConfigService {
	private readonly configuration = inject(OPENVIDU_COMPONENTS_CONFIG);

	hasParticipantFactory(): boolean {
		return typeof this.getConfig().participantFactory === 'function';
	}

	getParticipantFactory(): ParticipantFactoryFunction {
		const participantFactory = this.getConfig().participantFactory;
		if (!participantFactory) {
			throw new Error('Participant factory is not configured');
		}
		return participantFactory;
	}

	getConfig(): OpenViduComponentsConfig {
		return this.configuration;
	}
	isProduction(): boolean {
		return this.configuration?.production || false;
	}
}
