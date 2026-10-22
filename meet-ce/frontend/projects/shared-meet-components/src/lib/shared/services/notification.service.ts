import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ModalOptions, NZ_MODAL_DATA, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../components/dialogs/confirm-dialog/confirm-dialog.component';
import { DialogOptions } from '../models/notification.model';
import { TranslatePipe } from '../pipes/translate.pipe';

/** Payload contract for the text prompt modal. */
export interface TextPromptData {
	message: string;
	value?: string;
	minLength?: number;
}

/** Toast feedback type: maps to ng-zorro native message types. */
export type SnackbarType = 'success' | 'error' | 'info';

/**
 * 弹窗宽度契约（全站唯一取值来源）：确认 440 / 标准 520 / 表单 620。
 * 打开方一律从这里取宽度，禁止在业务代码里再写字面值。
 */
export const DIALOG_WIDTH = {
	confirm: '440px',
	standard: '520px',
	form: '620px'
} as const;

@Injectable({
	providedIn: 'root'
})
export class NotificationService {
	private message = inject(NzMessageService);
	private modal = inject(NzModalService);

	/**
	 * NzModal 统一打开入口：默认去原生页脚（弹窗内容自带 jmeet 按钮区），
	 * 调用方通过 options 覆盖任意 create 选项（含 nzFooter）。
	 */
	openModal(options: ModalOptions): NzModalRef {
		return this.modal.create({ nzFooter: null, ...options });
	}

	prompt(data: TextPromptData): Promise<string | undefined> {
		return firstValueFrom(
			this.openModal({
				nzContent: TextPromptModalContent,
				nzData: data,
				nzClosable: false,
				nzWidth: DIALOG_WIDTH.standard
			}).afterClose
		);
	}

	/**
	 * Toast feedback (former MatSnackBar): top-center notice with the `custom-snackbar`
	 * card chrome styled in _nz-theme.scss.
	 *
	 * 样式优先级：success/error 直接用 ng-zorro 原生 message 类型（内置图标与
	 * 语义色），仅复用全站卡片外观；info 沿用无图标的中性伪类型。默认 info，
	 * 存量调用无需改动。
	 */
	showSnackbar(message: string, duration: number = 3000, type: SnackbarType = 'info'): void {
		const nzType = type === 'success' ? 'success' : type === 'error' ? 'error' : 'snackbar';
		this.message.create(nzType, message, { nzDuration: duration, nzClass: 'custom-snackbar' });
	}

	showDialog(options: DialogOptions): void {
		this.openModal({
			nzContent: ConfirmDialogComponent,
			nzData: options,
			nzWidth: DIALOG_WIDTH.confirm,
			// 企业弹框壳：清 Zorro 默认 body 内边距，统一边框/圆角/背景
			nzClassName: 'ov-enterprise-dialog',
			nzMaskClosable: false,
			nzClosable: false
		});
	}

	showAlert(message: string): void {
		this.openModal({
			nzContent: ConfirmDialogComponent,
			nzData: {
				message,
				confirmText: 'OK'
			},
			nzWidth: DIALOG_WIDTH.confirm,
			nzMaskClosable: false,
			nzClosable: false
		});
	}
}

/**
 * NzModal content for the text prompt (replaces the Material dialog-based
 * TextPromptDialogComponent, which cannot be hosted by NzModal). Same data contract:
 * resolves the trimmed value on confirm and undefined on cancel/dismiss.
 */
@Component({
	selector: 'jmeet-text-prompt-modal',
	imports: [NzInputModule, TranslatePipe],
	template: `
		<div class="prompt-body">
			<h3 class="prompt-title">{{ data.message }}</h3>
			<textarea
				#promptInput
				nz-input
				name="value"
				rows="3"
				[attr.aria-label]="data.message"
				[value]="value()"
				(input)="value.set(promptInput.value)"
			></textarea>
			<footer class="prompt-footer">
				<button type="button" class="jmeet-button jmeet-button--outline" (click)="close()">
					{{ 'COMMON.PROMPT.CANCEL' | translate }}
				</button>
				<button type="button" class="jmeet-button jmeet-button--primary" [disabled]="!valid()" (click)="submit()">
					{{ 'COMMON.PROMPT.CONFIRM' | translate }}
				</button>
			</footer>
		</div>
	`,
	styles: `
		.prompt-body {
			display: grid;
			gap: var(--jmeet-layout-space-md);
		}

		.prompt-title {
			margin: 0;
			font-size: var(--jmeet-typography-font-size-md);
			font-weight: var(--jmeet-typography-font-weight-bold);
			color: var(--jmeet-color-text-primary);
			line-height: var(--jmeet-typography-line-height-tight);
		}

		.prompt-footer {
			display: flex;
			justify-content: flex-end;
			gap: var(--jmeet-layout-space-sm);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextPromptModalContent {
	readonly data = inject<TextPromptData>(NZ_MODAL_DATA);
	readonly nzModalRef = inject(NzModalRef<TextPromptModalContent, string>);
	readonly value = signal(this.data.value ?? '');

	valid(): boolean {
		return this.value().trim().length >= (this.data.minLength ?? 1);
	}

	close(): void {
		this.nzModalRef.close();
	}

	submit(): void {
		if (this.valid()) {
			this.nzModalRef.close(this.value().trim());
		}
	}
}
