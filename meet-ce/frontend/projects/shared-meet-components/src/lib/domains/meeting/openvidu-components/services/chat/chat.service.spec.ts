import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatAttachmentRef } from '../../models/chat.model';
import { ChatService } from './chat.service';
import { HttpService } from '../../../../../shared/services/http.service';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { ActionService } from '../action/action.service';
import { LoggerService } from '../logger/logger.service';
import { PanelService } from '../panel/panel.service';
import { ParticipantService } from '../participant/participant.service';
import { MeetingTranslateService } from '../translate/meeting-translate.service';
import { MeetingContextService } from '../../../services/meeting-context.service';

const ATTACHMENT: ChatAttachmentRef = { attachmentId: 'a1', type: 'image', fileName: 'p.png', mimeType: 'image/png', size: 12 };

describe('ChatService attachments', () => {
	let service: ChatService;
	let http: { postBlobRequest: jasmine.Spy; postRequest: jasmine.Spy; getRequest: jasmine.Spy; getBlobRequest: jasmine.Spy };
	let publishData: jasmine.Spy;

	beforeEach(() => {
		http = {
			postBlobRequest: jasmine.createSpy().and.resolveTo({ ...ATTACHMENT }),
			postRequest: jasmine.createSpy().and.resolveTo({ meetingSessionId: 'ms-1' }),
			getRequest: jasmine.createSpy(),
			getBlobRequest: jasmine.createSpy().and.resolveTo(new Blob(['xx']))
		};
		publishData = jasmine.createSpy().and.resolveTo(undefined);
		TestBed.configureTestingModule({
			providers: [
				{ provide: HttpService, useValue: http },
				{ provide: ParticipantService, useValue: { getMyName: () => '甲', publishData, localParticipantIdentitySignal: signal('id-1') } },
				{ provide: PanelService, useValue: { isChatPanelOpened: () => false, togglePanel: () => {} } },
				{ provide: ActionService, useValue: { launchNotification: () => {} } },
				{ provide: AssetsService, useValue: { chatMessageSound: '' } },
				{ provide: MeetingTranslateService, useValue: { translate: (k: string) => ({ 'PANEL.CHAT.IMAGE_PLACEHOLDER': '[图片]', 'PANEL.CHAT.FILE_PLACEHOLDER': '[文件] {name}' } as Record<string, string>)[k] ?? k } },
				{ provide: MeetingContextService, useValue: { roomId: signal('room-1') } },
				{ provide: LoggerService, useValue: { get: () => ({ e: () => {}, w: () => {}, i: () => {} }) } }
			]
		});
		service = TestBed.inject(ChatService);
	});

	it('sendAttachment uploads, broadcasts payload with attachment, archives and backfills', async () => {
		await service.sendAttachment(new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' }));
		expect(http.postBlobRequest).toHaveBeenCalledWith(jasmine.stringMatching(/\/meetings\/room-1\/chat-attachments$/), jasmine.any(File), jasmine.any(Object));
		const payload = JSON.parse(new TextDecoder().decode(publishData.calls.mostRecent().args[0] as Uint8Array));
		expect(payload.message).toBe('[图片]');
		expect(payload.attachment.attachmentId).toBe('a1');
		expect(http.postRequest).toHaveBeenCalledWith(jasmine.stringMatching(/\/collaboration\/chat$/), { message: '[图片]', participantName: '甲', attachment: ATTACHMENT });
		const last = service.chatMessages().at(-1)!;
		expect(last.attachment?.attachmentId).toBe('a1');
		expect(last.meetingSessionId).toBe('ms-1');
		expect(last.uploadStatus).toBeUndefined();
	});

	it('sendAttachment marks the message failed (retryable) when upload rejects', async () => {
		http.postBlobRequest = jasmine.createSpy().and.rejectWith(new Error('boom'));
		await service.sendAttachment(new File([new Uint8Array([1])], 'p.png', { type: 'image/png' }));
		const last = service.chatMessages().at(-1)!;
		expect(last.uploadStatus).toBe('failed');
		expect(publishData).not.toHaveBeenCalled();
	});

	it('sendAttachment with reuseMessage retries in place instead of appending a new placeholder', async () => {
		http.postBlobRequest = jasmine.createSpy().and.rejectWith(new Error('boom'));
		const file = new File([new Uint8Array([1])], 'p.png', { type: 'image/png' });
		await service.sendAttachment(file);
		const failed = service.chatMessages().at(-1)!;
		expect(failed.uploadStatus).toBe('failed');
		expect(failed.errorHint).toBeTruthy();

		http.postBlobRequest = jasmine.createSpy().and.resolveTo({ ...ATTACHMENT });
		await service.sendAttachment(failed.pendingFile!, failed);
		expect(service.chatMessages().length).toBe(1);
		const retried = service.chatMessages().at(-1)!;
		expect(retried).toBe(failed);
		expect(retried.uploadStatus).toBeUndefined();
		expect(retried.pendingFile).toBeUndefined();
		expect(retried.errorHint).toBeUndefined();
		expect(retried.attachment?.attachmentId).toBe('a1');
		expect(publishData).toHaveBeenCalled();
	});

	it('removeMessage removes the target message from the list', async () => {
		await service.sendAttachment(new File([new Uint8Array([1])], 'p.png', { type: 'image/png' }));
		const target = service.chatMessages().at(-1)!;
		service.removeMessage(target);
		expect(service.chatMessages()).not.toContain(target);
		expect(service.chatMessages().length).toBe(0);
	});

	it('maps attachment from archived history items', async () => {
		http.getRequest = jasmine.createSpy().and.resolveTo({ hasMore: false, items: [{ messageId: 'm1', meetingSessionId: 'ms-0', participantIdentity: 'id-1', participantName: '甲', message: '[图片]', attachment: ATTACHMENT, createdAt: 5 }] });
		await service.loadHistory();
		expect(service.chatMessages()[0].attachment?.attachmentId).toBe('a1');
	});

	it('caches the blob objectURL per attachmentId (single fetch)', async () => {
		const first = await service.getAttachmentUrl('a1');
		const second = await service.getAttachmentUrl('a1');
		expect(first).toBeTruthy();
		expect(second).toBe(first);
		expect(http.getBlobRequest).toHaveBeenCalledTimes(1);
	});

	it('dedupes concurrent getAttachmentUrl requests (single fetch, single objectURL)', async () => {
		let resolveBlob!: (b: Blob) => void;
		http.getBlobRequest = jasmine.createSpy().and.returnValue(new Promise<Blob>((res) => (resolveBlob = res)));
		const p1 = service.getAttachmentUrl('a1');
		const p2 = service.getAttachmentUrl('a1');
		resolveBlob(new Blob(['xx']));
		const [u1, u2] = await Promise.all([p1, p2]);
		expect(u1).toBeTruthy();
		expect(u2).toBe(u1);
		expect(http.getBlobRequest).toHaveBeenCalledTimes(1);
	});
});

describe('ChatService private messages and mentions', () => {
	let service: ChatService;
	let publishData: jasmine.Spy;
	let postRequest: jasmine.Spy;

	beforeEach(() => {
		publishData = jasmine.createSpy().and.resolveTo(undefined);
		postRequest = jasmine.createSpy().and.resolveTo({ meetingSessionId: 'ms-2' });
		TestBed.configureTestingModule({
			providers: [
				{
					provide: HttpService,
					useValue: { postBlobRequest: jasmine.createSpy(), postRequest, getRequest: jasmine.createSpy(), getBlobRequest: jasmine.createSpy() }
				},
				{
					provide: ParticipantService,
					useValue: {
						getMyName: () => '张三',
						getMyIdentity: () => 'id-1',
						localParticipantIdentitySignal: signal('id-1'),
						remoteParticipants: () => [{ identity: 'id-2', name: '李四' }],
						publishData
					}
				},
				{ provide: PanelService, useValue: { isChatPanelOpened: () => true, togglePanel: () => {} } },
				{ provide: ActionService, useValue: { launchNotification: () => {} } },
				{ provide: AssetsService, useValue: { chatMessageSound: '' } },
				{ provide: MeetingTranslateService, useValue: { translate: (k: string) => k } },
				{ provide: MeetingContextService, useValue: { roomId: signal('room-1') } },
				{ provide: LoggerService, useValue: { get: () => ({ e: () => {}, w: () => {}, i: () => {} }) } }
			]
		});
		service = TestBed.inject(ChatService);
	});

	it('sends a private message targeted at the recipient and never archives it', async () => {
		await service.sendMessage('机密内容', 'id-2');
		const [, options] = publishData.calls.mostRecent().args as [Uint8Array, { destinationIdentities?: string[] }];
		expect(options.destinationIdentities).toEqual(['id-2']);
		const payload = JSON.parse(new TextDecoder().decode(publishData.calls.mostRecent().args[0] as Uint8Array));
		expect(payload.to).toBe('id-2');
		expect(postRequest).not.toHaveBeenCalled();

		const message = service.chatMessages().at(-1)!;
		expect(message.isPrivate).toBeTrue();
		expect(message.toName).toBe('李四');
	});

	it('sends a public message without destination and archives it', async () => {
		await service.sendMessage('大家好');
		const [, options] = publishData.calls.mostRecent().args as [Uint8Array, { destinationIdentities?: string[] }];
		expect(options.destinationIdentities).toBeUndefined();
		expect(postRequest).toHaveBeenCalled();
	});

	it('flags incoming messages that @mention the local participant', async () => {
		await service.addRemoteMessage('@张三 请看这里', '李四');
		expect(service.chatMessages().at(-1)!.mentionsMe).toBeTrue();
	});

	it('does not flag partial-name matches or messages without mentions', async () => {
		await service.addRemoteMessage('@张三丰 是另一位', '李四');
		expect(service.chatMessages().at(-1)!.mentionsMe).toBeFalsy();
		await service.addRemoteMessage('普通消息', '李四');
		expect(service.chatMessages().at(-1)!.mentionsMe).toBeFalsy();
	});

	it('labels incoming private messages with the private flag', async () => {
		await service.addRemoteMessage('悄悄话', '李四', undefined, { isPrivate: true, fromIdentity: 'id-2' });
		const message = service.chatMessages().at(-1)!;
		expect(message.isPrivate).toBeTrue();
		expect(message.isLocal).toBeFalse();
	});
});
