import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import type { WizardNavigationConfig, WizardNavigationEvent } from '../../models';

@Component({
    selector: 'ov-wizard-nav',
    imports: [NzIconModule, TranslatePipe],
    templateUrl: './wizard-nav.component.html',
    styleUrl: './wizard-nav.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WizardNavComponent {
	/**
	 * Navigation configuration with default values
	 */
	config = input<WizardNavigationConfig>({
		showPrevious: false,
		showNext: true,
		showCancel: false,
		showBack: true,
		showFinish: false,
		showSkipAndFinish: false,
		disableFinish: false,
		nextLabel: 'Next',
		previousLabel: 'Previous',
		cancelLabel: 'Cancel',
		finishLabel: 'Finish'
	});

	backButtonText = input('Back');

	/**
	 * Current step identifier for context
	 */
	currentStepId = input<number | undefined>(undefined);

	/**
	 * Event emitters for navigation actions
	 */
	previous = output<WizardNavigationEvent>();
	next = output<WizardNavigationEvent>();
	cancel = output<WizardNavigationEvent>();
	back = output<WizardNavigationEvent>();
	finish = output<WizardNavigationEvent>();

	/**
	 * Generic navigation event for centralized handling
	 */
	navigate = output<WizardNavigationEvent>();

	onPrevious() {
		if (!this.config().showPrevious) return;

		const event: WizardNavigationEvent = {
			action: 'previous',
			currentStepIndex: this.currentStepId()
		};
		this.previous.emit(event);
		this.navigate.emit(event);
	}

	onNext() {
		if (!this.config().showNext) return;

		const event: WizardNavigationEvent = {
			action: 'next',
			currentStepIndex: this.currentStepId()
		};
		this.next.emit(event);
		this.navigate.emit(event);
	}

	onCancel() {
		if (!this.config().showCancel) return;

		const event: WizardNavigationEvent = {
			action: 'cancel',
			currentStepIndex: this.currentStepId()
		};
		this.cancel.emit(event);
		this.navigate.emit(event);
	}

	onBack() {
		if (!this.config().showBack) return;
		const event: WizardNavigationEvent = {
			action: 'back',
			currentStepIndex: this.currentStepId()
		};
		this.back.emit(event);
		this.navigate.emit(event);
	}

	onFinish() {
		if (!this.config().showFinish) return;

		const event: WizardNavigationEvent = {
			action: 'finish',
			currentStepIndex: this.currentStepId()
		};
		this.finish.emit(event);
		this.navigate.emit(event);
	}

	skipAndFinish() {
		if (!this.config().showSkipAndFinish) return;

		const event: WizardNavigationEvent = {
			action: 'finish',
			currentStepIndex: this.currentStepId()
		};
		this.finish.emit(event);
		this.navigate.emit(event);
	}
}
