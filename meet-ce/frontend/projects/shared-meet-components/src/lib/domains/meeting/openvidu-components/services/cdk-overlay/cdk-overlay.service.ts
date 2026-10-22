import { inject, Injectable } from '@angular/core';
import { CdkOverlayContainer } from '../../config/custom-cdk-overlay';

/**
 * @internal
 */
@Injectable({
	providedIn: 'root'
})
export class CdkOverlayService {
	private readonly cdkOverlayModel = inject(CdkOverlayContainer);

	constructor() {}

	setSelector(selector: string) {
		this.cdkOverlayModel.setContainerSelector(selector);
	}
}
