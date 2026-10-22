import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WizardStep } from '../../models';

@Component({
	selector: 'ov-step-indicator',
	imports: [TranslatePipe],
	templateUrl: './step-indicator.component.html',
	styleUrl: './step-indicator.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepIndicatorComponent {
	steps = input.required<WizardStep[]>();
	currentStepIndex = input.required<number>();
	allowNavigation = input<boolean>(true);
	editMode = input<boolean>(false);

	stepClick = output<{ index: number; step: WizardStep }>();

	visibleSteps = computed<WizardStep[]>(() => this.steps().filter((step) => step.isVisible));

	onStepSelect(index: number): void {
		if (!this.allowNavigation()) {
			return;
		}
		const step = this.visibleSteps()[index];
		if (!step) {
			return;
		}
		this.stepClick.emit({ index, step });
	}
}
