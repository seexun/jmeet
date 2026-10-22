import { Pipe, PipeTransform } from '@angular/core';

/**
 * @internal
 */
@Pipe({
	name: 'duration',
	standalone: true
})
export class DurationFromSecondsPipe implements PipeTransform {
	transform(durationInSeconds: number): string {
		if (durationInSeconds < 60) {
			return `${Math.floor(durationInSeconds)}s`;
		} else if (durationInSeconds < 3600) {
			const minutes = Math.floor(durationInSeconds / 60);
			const seconds = Math.floor(durationInSeconds % 60);
			return `${minutes}m ${seconds}s`;
		} else {
			const hours = Math.floor(durationInSeconds / 3600);
			const minutes = Math.floor((durationInSeconds - hours * 3600) / 60);
			return `${hours}h ${minutes}m`;
		}
	}
}
