import { Pipe, PipeTransform } from '@angular/core';

import { nzIconType } from '../icons/nz-icons';

/**
 * Resolves a legacy Material icon name to an nz-icon `nzType` in template
 * bindings: `<nz-icon [nzType]="(item.icon) | nzIconType" />`.
 * Unknown names fall back to the registered default icon.
 */
@Pipe({ name: 'nzIconType' })
export class NzIconTypePipe implements PipeTransform {
	transform(value: string | null | undefined): string {
		return nzIconType(value);
	}
}
