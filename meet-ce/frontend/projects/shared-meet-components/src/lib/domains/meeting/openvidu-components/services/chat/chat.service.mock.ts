import { Injectable, signal } from '@angular/core';
import { ChatMessage } from '../../models/chat.model';

@Injectable()
export class ChatServiceMock {
	private readonly messageList = signal<ChatMessage[]>([]);
	private readonly toggleChatState = signal<boolean>(false);
	private readonly messagesUnread = signal<number>(0);

	subscribeToChat() {
	}

	sendMessage(message: string) {

	}

	toggleChat() {

	}

	private isChatOpened(): boolean {
		return false;
	}

	private addMessageUnread() {

	}
}
