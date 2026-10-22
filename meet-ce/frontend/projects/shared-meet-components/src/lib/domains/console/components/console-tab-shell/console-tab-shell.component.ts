import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

export interface ConsoleTabLink {
	path: string;
	label: string;
}

@Component({
	selector: 'ov-console-tab-shell',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
	templateUrl: './console-tab-shell.component.html',
	styleUrl: './console-tab-shell.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsoleTabShellComponent {
	readonly pageTitle = input.required<string>();
	readonly tabsAriaLabel = input.required<string>();
	readonly tabs = input.required<readonly ConsoleTabLink[]>();
}
