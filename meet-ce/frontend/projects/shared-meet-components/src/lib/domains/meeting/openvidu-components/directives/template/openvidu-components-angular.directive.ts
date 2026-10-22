import { Directive, TemplateRef, ViewContainerRef, inject } from '@angular/core';

/**
 * The ***ovToolbar** directive allows to replace the default toolbar component with a custom one.
 *
 * In the example below we've replaced the default toolbar and added the **toggleAudio** and **toggleVideo** buttons.
 * Here we are using the {@link ParticipantService} for enabling/disabling the audio and video.
 *
 * <!--ovToolbar-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 *   ParticipantService,
 *   OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 *   selector: 'app-root',
 *   template: `
 *     <ov-videoconference
 *       [token]="token"
 *       [livekitUrl]="LIVEKIT_URL"
 *       (onTokenRequested)="onTokenRequested($event)"
 *     >
 *       <div *ovToolbar style="text-align: center;">
 *         <button (click)="toggleVideo()">Toggle Video</button>
 *         <button (click)="toggleAudio()">Toggle Audio</button>
 *       </div>
 *     </ov-videoconference>
 *   `,
 *   standalone: true,
 *   imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 *   // For local development, leave these variables empty
 *   // For production, configure them with correct URLs depending on your deployment
 *
 *   APPLICATION_SERVER_URL = '';
 *   LIVEKIT_URL = '';
 *   // The name of the room.
 *   roomName = 'custom-toolbar';
 *
 *   // The token used to connect to the videoconference.
 *   token!: string;
 *
 *   constructor(
 *     private httpClient: HttpClient,
 *     private participantService: ParticipantService
 *   ) {
 *     this.configureUrls();
 *   }
 *
 *   private configureUrls() {
 *     // If APPLICATION_SERVER_URL is not configured, use default value from local development
 *     if (!this.APPLICATION_SERVER_URL) {
 *       if (window.location.hostname === 'localhost') {
 *         this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 *       } else {
 *         this.APPLICATION_SERVER_URL =
 *           'https://' + window.location.hostname + ':6443/';
 *       }
 *     }
 *
 *     // If LIVEKIT_URL is not configured, use default value from local development
 *     if (!this.LIVEKIT_URL) {
 *       if (window.location.hostname === 'localhost') {
 *         this.LIVEKIT_URL = 'ws://localhost:7880/';
 *       } else {
 *         this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 *       }
 *     }
 *   }
 *
 *   // Called when a token is requested for a participant.
 *   async onTokenRequested(participantName: string) {
 *     const { token } = await this.getToken(this.roomName, participantName);
 *     this.token = token;
 *   }
 *
 *   // Toggles the camera on and off.
 *   async toggleVideo() {
 *     const isCameraEnabled = this.participantService.isMyCameraEnabled();
 *     await this.participantService.setCameraEnabled(!isCameraEnabled);
 *   }
 *
 *   // Toggles the microphone on and off.
 *   async toggleAudio() {
 *     const isMicrophoneEnabled = this.participantService.isMyMicrophoneEnabled();
 *     await this.participantService.setMicrophoneEnabled(!isMicrophoneEnabled);
 *   }
 *
 *   // Gets a token for a participant.
 *   getToken(roomName: string, participantName: string): Promise<any> {
 *     try {
 *       return lastValueFrom(
 *         this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 *           roomName,
 *           participantName,
 *         })
 *       );
 *     } catch (error: any) {
 *       if (error.status === 404) {
 *         throw {
 *           status: error.status,
 *           message: 'Cannot connect with backend. ' + error.url + ' not found',
 *         };
 *       }
 *       throw error;
 *     }
 *   }
 * }
 *
 * ```
 * <!--ovToolbar-end-tutorial-->
 *
 * You can run the associated tutorial [here](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-toolbar/).
 */
@Directive({
	selector: '[ovToolbar]',
	standalone: true
})
export class ToolbarDirective {
	/**
	 * @ignore
	 */
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovToolbarAdditionalButtons** directive enables the addition of extra buttons to the central button group within the toolbar.
 *
 * In the following example, we've included the same buttons as those in the {@link ToolbarDirective}. Additionally, we utilize the {@link ParticipantService} to assess audio and video statuses.
 *
 * <!--ovToolbarAdditionalButtons-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 * 	ParticipantService,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 * import { NzIconModule } from 'ng-zorro-antd/icon';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<div *ovToolbarAdditionalButtons style="text-align: center;">
 * 				<button class="jmeet-button jmeet-button--icon" (click)="toggleVideo()">
 * 					<nz-icon nzType="video-camera" />
 * 				</button>
 * 				<button class="jmeet-button jmeet-button--icon" (click)="toggleAudio()">
 * 					<nz-icon nzType="audio" />
 * 				</button>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: [],
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule, MatIconButton, NzIconModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 *
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// The name of the room for the video conference.
 * 	roomName = 'toolbar-additionalbtn';
 *
 * 	// The token used to authenticate the user in the video conference.
 * 	token!: string;
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private participantService: ParticipantService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Called when the token is requested.
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Toggles the camera on/off.
 * 	async toggleVideo() {
 * 		const isCameraEnabled = this.participantService.isMyCameraEnabled();
 * 		await this.participantService.setCameraEnabled(!isCameraEnabled);
 * 	}
 *
 * 	// Toggles the microphone on/off.
 * 	async toggleAudio() {
 * 		const isMicrophoneEnabled = this.participantService.isMyMicrophoneEnabled();
 * 		await this.participantService.setMicrophoneEnabled(!isMicrophoneEnabled);
 * 	}
 *
 * 	// Retrieves a token from the server to authenticate the user.
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message: 'Cannot connect with backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovToolbarAdditionalButtons-end-tutorial-->
 *
 * To follow a step-by-step tutorial on this feature, please visit [this link](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-toolbar-buttons/).
 */

@Directive({
	selector: '[ovToolbarAdditionalButtons]',
	standalone: true
})
export class ToolbarAdditionalButtonsDirective {
	/**
	 * @ignore
	 */
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovToolbarAdditionalPanelButtons** directive allows to add additional **panel buttons** to the toolbar.
 * In the example below we've added a simple button without any functionality. To learn how to toggle the panel check the {@link AdditionalPanelsDirective}.
 *
 * <!--ovToolbarAdditionalPanelButtons-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import { OpenViduComponentsModule } from 'openvidu-components-angular';
 * import { NzIconModule } from 'ng-zorro-antd/icon';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			[toolbarDisplayRoomName]="false"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<div *ovToolbarAdditionalPanelButtons style="text-align: center;">
 * 				<button class="jmeet-button jmeet-button--icon" (click)="onButtonClicked()">
 * 					<nz-icon nzType="star" />
 * 				</button>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: [],
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule, MatIconButton, NzIconModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 *
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Set the room name
 * 	roomName = 'toolbar-additional-panel-btn';
 *
 * 	// Initialize the token variable
 * 	token!: string;
 *
 * 	constructor(private httpClient: HttpClient) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Method to request a token for a participant
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Method to handle button click
 * 	onButtonClicked() {
 * 		alert('button clicked');
 * 	}
 *
 * 	// Method to get a token from the backend
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message: 'Cannot connect with backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovToolbarAdditionalPanelButtons-end-tutorial-->
 *
 * You can run the associated tutorial [here](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-toolbar-panel-buttons/).
 */
@Directive({
	selector: '[ovToolbarAdditionalPanelButtons]',
	standalone: true
})
export class ToolbarAdditionalPanelButtonsDirective {
	/**
	 * @ignore
	 */
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovPanel** directive empowers you to seamlessly replace default panels with custom ones.
 * It also provides the flexibility to insert elements tagged with the {@link ChatPanelDirective}, {@link ParticipantsPanelDirective}, and {@link AdditionalPanelsDirective}.
 *
 * In the example below, we showcase how to entirely replace the {@link PanelComponent} using the {@link ChatPanelDirective}.
 * Within it, you can tailor the appearance and behavior of the {@link ParticipantsPanelComponent} and {@link ChatPanelComponent} using their respective directives.
 *
 * <!--ovPanel-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import { OpenViduComponentsModule } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Custom Panels -->
 * 			<ov-panel *ovPanel>
 * 				<!-- Custom Chat Panel -->
 * 				<div *ovChatPanel id="my-chat-panel">This is my custom chat panel</div>
 *
 * 				<!-- Custom Participants Panel -->
 * 				<div *ovParticipantsPanel id="my-participants-panel">
 * 					This is my custom participants panel
 * 				</div>
 *
 * 				<!-- Custom Activities Panel -->
 * 				<div *ovActivitiesPanel id="my-activities-panel">
 * 					This is my custom activities panel
 * 				</div>
 * 			</ov-panel>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		#my-chat-panel,
 * 		#my-participants-panel,
 * 		#my-activities-panel {
 * 			text-align: center;
 * 			height: calc(100% - 40px);
 * 			margin: 20px;
 * 		}
 *
 * 		#my-chat-panel {
 * 			background: #c9ffb2;
 * 		}
 *
 * 		#my-participants-panel {
 * 			background: #ddf2ff;
 * 		}
 *
 * 		#my-activities-panel {
 * 			background: #ffddc9;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'custom-panels';
 * 	token!: string;
 *
 * 	constructor(private httpClient: HttpClient) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovPanel-end-tutorial-->
 *
 *
 * For a comprehensive tutorial on implementing custom panels, please refer to the associated guide [here](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-panels/).
 */
@Directive({
	selector: '[ovPanel]',
	standalone: true
})
export class PanelDirective {
	/**
	 * @ignore
	 */
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 *
 * The ***ovAdditionalPanels** directive enables you to effortlessly integrate additional panels with the {@link PanelComponent}.
 *
 * In the example below, we showcase how to add a custom panel to the {@link PanelComponent} using the **ovAdditionalPanels** directive.
 *
 * <!--ovAdditionalPanels-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 * 	PanelStatusInfo,
 * 	PanelService,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * import { NzIconModule } from 'ng-zorro-antd/icon';
 *
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			[toolbarDisplayRoomName]="false"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Additional Toolbar Buttons -->
 * 			<div *ovToolbarAdditionalPanelButtons style="text-align: center;">
 * 				<button class="jmeet-button jmeet-button--icon" (click)="toggleMyPanel('my-panel1')">
 * 					<nz-icon nzType="global" />
 * 				</button>
 * 				<button class="jmeet-button jmeet-button--icon" (click)="toggleMyPanel('my-panel2')">
 * 					<nz-icon nzType="star" />
 * 				</button>
 * 			</div>
 *
 * 			<!-- Additional Panels -->
 * 			<div *ovAdditionalPanels id="my-panels">
 * 				@if (showExternalPanel) {
 * 				<div id="my-panel1">
 * 					<h2>NEW PANEL 1</h2>
 * 					<p>This is my new additional panel</p>
 * 				</div>
 * 				} @if (showExternalPanel2) {
 * 				<div id="my-panel2">
 * 					<h2>NEW PANEL 2</h2>
 * 					<p>This is another new panel</p>
 * 				</div>
 * 				}
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		#my-panels {
 * 			height: 100%;
 * 			overflow: hidden;
 * 		}
 * 		#my-panel1,
 * 		#my-panel2 {
 * 			text-align: center;
 * 			height: calc(100% - 40px);
 * 			margin: 20px;
 * 		}
 * 		#my-panel1 {
 * 			background: #c9ffb2;
 * 		}
 * 		#my-panel2 {
 * 			background: #ddf2ff;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule, MatIconButton, NzIconModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'additional-panels';
 * 	token!: string;
 *
 * 	// Flags to control the visibility of external panels
 * 	showExternalPanel: boolean = false;
 * 	showExternalPanel2: boolean = false;
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private panelService: PanelService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	ngOnInit() {
 * 		this.subscribeToPanelToggling();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: any) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Subscribe to panel toggling events
 * 	subscribeToPanelToggling() {
 * 		this.panelService.panelStatusObs.subscribe((ev: PanelStatusInfo) => {
 * 			this.showExternalPanel = ev.isOpened && ev.panelType === 'my-panel1';
 * 			this.showExternalPanel2 = ev.isOpened && ev.panelType === 'my-panel2';
 * 		});
 * 	}
 *
 * 	// Toggle the visibility of external panels
 * 	toggleMyPanel(type: string) {
 * 		this.panelService.togglePanel(type);
 * 	}
 *
 * 	// Function to get a token from the server
 * 	async getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovAdditionalPanels-end-tutorial-->
 *
 * For detailed instructions, refer to the tutorial available [here](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-additional-panels/).
 */
@Directive({
	selector: '[ovAdditionalPanels]',
	standalone: true
})
export class AdditionalPanelsDirective {
	/**
	 * @ignore
	 */
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovChatPanel** directive empowers you to effortlessly substitute the default chat panel template with a custom one.
 *
 * In the example below, we showcase how to replace the chat template with a custom one.
 *
 * <!--ovChatPanel-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 * 	DataPacket_Kind,
 * 	DataPublishOptions,
 * 	DataTopic,
 * 	ParticipantService,
 * 	RemoteParticipant,
 * 	Room,
 * 	RoomEvent,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			[toolbarDisplayRoomName]="false"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 			(onRoomCreated)="onRoomCreated($event)"
 * 		>
 * 			<!-- Chat Panel -->
 * 			<div *ovChatPanel id="my-panel">
 * 				<h3>Chat</h3>
 * 				<div>
 * 					<ul>
 * 						@for (msg of messages; track msg) {
 * 						<li>{{ msg }}</li>
 * 						}
 * 					</ul>
 * 				</div>
 * 				<input value="Hello" #input />
 * 				<button (click)="send(input.value)">Send</button>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		#my-panel {
 * 			background: #aafffc;
 * 			height: 100%;
 * 			overflow: hidden;
 * 			text-align: center;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'chat-panel-directive-example';
 * 	token!: string;
 * 	messages: string[] = [];
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private participantService: ParticipantService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Event handler for room creation
 * 	onRoomCreated(room: Room) {
 * 		room.on(
 * 			RoomEvent.DataReceived,
 * 			(
 * 				payload: Uint8Array,
 * 				participant?: RemoteParticipant,
 * 				_?: DataPacket_Kind,
 * 				topic?: string
 * 			) => {
 * 				if (topic === DataTopic.CHAT) {
 * 					const { message } = JSON.parse(new TextDecoder().decode(payload));
 * 					const participantName = participant?.name || 'Unknown';
 * 					this.messages.push(message);
 * 					console.log(`Message received from ${participantName}:`, message);
 * 				}
 * 			}
 * 		);
 * 	}
 *
 * 	// Function to send a chat message
 * 	async send(message: string): Promise<void> {
 * 		const strData = JSON.stringify({ message });
 * 		const data: Uint8Array = new TextEncoder().encode(strData);
 * 		const options: DataPublishOptions = { topic: DataTopic.CHAT };
 * 		await this.participantService.publishData(data, options);
 * 		this.messages.push(message);
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovChatPanel-end-tutorial-->
 *
 *
 * For a step-by-step tutorial on how to replace the chat template with just a few lines of code,
 * check out our comprehensive guide: [Customizing the Chat Panel](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-chat-panel/).
 */
@Directive({
	selector: '[ovChatPanel]',
	standalone: true
})
export class ChatPanelDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * backgroundEffectsPanel does not provide any customization for now
 * @internal
 */
@Directive({
	selector: '[ovBackgroundEffectsPanel]',
	standalone: true
})
export class BackgroundEffectsPanelDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovActivitiesPanel** directive empowers you to effortlessly substitute the default activities panel template with a custom one.
 *
 * In the example below, we showcase how to replace the activities template with a custom one.
 *
 * <!--ovActivitiesPanel-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 * import { OpenViduComponentsModule } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Custom activities panel -->
 * 			<div *ovActivitiesPanel id="my-panel">
 * 				<h3>ACTIVITIES</h3>
 * 				<div>CUSTOM ACTIVITIES</div>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		#my-panel {
 * 			background: #aafffc;
 * 			height: 100%;
 * 			overflow: hidden;
 * 			text-align: center;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 * 	roomName = 'custom-activities-panel';
 * 	token!: string;
 *
 * 	constructor(private httpClient: HttpClient) {
 * 		this.configureUrls();
 * 	}
 *
 * 	configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message: 'Cannot connect with backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovActivitiesPanel-end-tutorial-->
 *
 * For a step-by-step tutorial on how to replace the activities template with just a few lines of code,
 * check out our comprehensive guide: [Customizing the Activities Panel](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-activities-panel/).
 */
@Directive({
	selector: '[ovActivitiesPanel]',
	standalone: true
})
export class ActivitiesPanelDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovParticipantsPanel** directive empowers you to substitute the default participants panel template with a customized one.
 * In the following example, we demonstrate how to replace the participants template with just a few lines of code.
 *
 * <!--ovParticipantsPanel-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component, OnDestroy, OnInit } from '@angular/core';
 * import { lastValueFrom, Subscription } from 'rxjs';
 *
 * import {
 * 	ParticipantModel,
 * 	ParticipantService,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Custom Participants Panel -->
 * 			<div *ovParticipantsPanel id="my-panel">
 * 				<ul id="local">
 * 					<li>{{ localParticipant.name }}</li>
 * 				</ul>
 * 				<ul id="remote">
 * 					@for (p of remoteParticipants; track p) {
 * 					<li>{{ p.name }}</li>
 * 					}
 * 				</ul>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		#my-panel {
 * 			background: #faff7f;
 * 			height: 100%;
 * 			overflow: hidden;
 * 		}
 * 		#my-panel > #local {
 * 			background: #a184ff;
 * 		}
 * 		#my-panel > #remote {
 * 			background: #7fb8ff;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent implements OnInit, OnDestroy {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'custom-participants-panel';
 * 	token!: string;
 *
 * 	// Participant-related properties
 * 	localParticipant!: ParticipantModel;
 * 	remoteParticipants!: ParticipantModel[];
 * 	localParticipantSubs!: Subscription;
 * 	remoteParticipantsSubs!: Subscription;
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private participantService: ParticipantService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Subscribes to updates for local and remote participants.
 * 	ngOnInit() {
 * 		this.subscribeToParticipants();
 * 	}
 *
 * 	// Unsubscribes from updates for local and remote participants to prevent memory leaks.
 * 	ngOnDestroy() {
 * 		this.localParticipantSubs.unsubscribe();
 * 		this.remoteParticipantsSubs.unsubscribe();
 * 	}
 *
 * 	// Function called when a participant requests a token to join the meeting.
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Subscribes to updates for local and remote participants.
 * 	subscribeToParticipants() {
 * 		this.localParticipantSubs =
 * 			this.participantService.localParticipant$.subscribe((p) => {
 * 				if (p) this.localParticipant = p;
 * 			});
 *
 * 		this.remoteParticipantsSubs =
 * 			this.participantService.remoteParticipants$.subscribe(
 * 				(participants) => {
 * 					this.remoteParticipants = participants;
 * 				}
 * 			);
 * 	}
 *
 * 	// Sends a request to the server to obtain a token for a participant.
 * 	async getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovParticipantsPanel-end-tutorial-->
 *
 * For a comprehensive tutorial on customizing the participants panel, please visit [this link](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-participants-panel/).
 */

@Directive({
	selector: '[ovParticipantsPanel]',
	standalone: true
})
export class ParticipantsPanelDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

@Directive({
	selector: '[ovMediaQualityPanel]',
	standalone: true
})
export class MediaQualityPanelDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovParticipantPanelItem** directive allows you to customize the default participant panel item template within the {@link ParticipantsPanelComponent}.
 *
 * With the **ovParticipantPanelItem** directive, you can access the participant object from its context using the `let` keyword and referencing the `participant`
 * variable as follows: `*ovParticipantPanelItem="let participant"`. This allows you to access the {@link ParticipantModel} object.
 *
 * In the example below, we demonstrate how to replace the participant panel item template with just a few lines of code.
 *
 * <!--ovParticipantPanelItem-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import { NzIconModule } from 'ng-zorro-antd/icon';
 * import { OpenViduComponentsModule } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Participant Panel Items -->
 * 			<div *ovParticipantPanelItem="let participant" style="display: flex">
 * 				<p>{{ participant.name }}</p>
 *
 * 				<!-- More Options Menu -->
 * 				<button class="jmeet-button jmeet-button--icon" nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click">
 * 					<nz-icon nzType="more" />
 * 				</button>
 *
 * 				<!-- Menu Content -->
 * 				<nz-dropdown-menu #menu="nzDropdownMenu">
 * 					<ul nz-menu>
 * 						<li nz-menu-item>Button 1</li>
 * 						<li nz-menu-item>Button 2</li>
 * 					</ul>
 * 				</nz-dropdown-menu>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: [],
 * 	standalone: true,
 * 	imports: [
 * 		OpenViduComponentsModule,
 * 		NzIconModule,
 * 	],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'participant-panel-item';
 * 	token!: string;
 *
 * 	constructor(private httpClient: HttpClient) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovParticipantPanelItem-end-tutorial-->
 *
 * For a detailed tutorial on customizing participant panel items, please visit [this link](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-participant-panel-item/).
 */

@Directive({
	selector: '[ovParticipantPanelItem]',
	standalone: true
})
export class ParticipantPanelItemDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovParticipantPanelItemElements** directive allows you to incorporate additional elements into the {@link ParticipantPanelItemComponent}.
 * In the example below, we demonstrate how to add a simple button for disconnecting from the session.
 *
 * With the ***ovParticipantPanelItemElements** directive, you can access the participant object within its context using the `let` keyword and referencing the `participant` variable as follows: `*ovParticipantPanelItem="let participant"`.
 * This enables you to access the {@link ParticipantModel} object and activate the button exclusively for the local participant.
 *
 *
 * <!--ovParticipantPanelItemElements-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 * 	OpenViduService,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		@if (connected) {
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			[toolbarDisplayRoomName]="false"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Participant Panel Item Elements -->
 * 			<div *ovParticipantPanelItemElements="let participant">
 * 				<!-- Leave Button for Local Participant -->
 * 				@if (participant.isLocal) {
 * 				<button (click)="leaveSession()">Leave</button>
 * 				}
 * 			</div>
 * 		</ov-videoconference>
 * 		}
 *
 * 		<!-- Session Disconnected Message -->
 * 		@if (!connected) {
 * 		<div style="text-align: center;">Session disconnected</div>
 * 		}
 * 	`,
 * 	styles: [],
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'participant-panel-item-elements';
 * 	token!: string;
 *
 * 	// Flag to indicate session connection status
 * 	connected = true;
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private openviduService: OpenViduService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Function to leave the session
 * 	async leaveSession() {
 * 		await this.openviduService.disconnectRoom();
 * 		this.connected = false;
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovParticipantPanelItemElements-end-tutorial-->
 *
 * For a comprehensive tutorial on adding elements to participant panel items, please visit [this link](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-participant-panel-item-element/).
 */

@Directive({
	selector: '[ovParticipantPanelItemElements]',
	standalone: true
})
export class ParticipantPanelItemElementsDirective {
	public template = inject(TemplateRef<any>);
	public viewContainer = inject(ViewContainerRef);
}

/**
 * The ***ovLayout** directive empowers you to replace the default room layout with a customized one.
 *
 * To ensure that the default {@link StreamComponent} functions correctly with participant streams, you can access all local streams using the [streams](../classes/ParticipantModel.html#streams) accessor.
 * Extracting streams from remote participants can be more complex, but openvidu-angular simplifies the process with the {@link RemoteParticipantTracksPipe}, which facilitates the extraction of each participant's stream.
 *
 * In the example below, take note of the HTML template's structure. The `@for` statements employ the `| tracks` pipe to handle streams effectively.
 *
 * <!--ovLayout-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component, OnDestroy, OnInit } from '@angular/core';
 * import { lastValueFrom, Subscription } from 'rxjs';
 * import {
 * 	ParticipantModel,
 * 	ParticipantService,
 * 	OpenViduComponentsModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Custom Layout for Video Streams -->
 * 			<div *ovLayout>
 * 				<div class="container">
 * 					<!-- Local Participant's Streams -->
 * 					@for (stream of localParticipant.streams; track stream.streamId) {
 * 					<div class="item">
 * 						<ov-stream [stream]="stream"></ov-stream>
 * 					</div>
 * 					}
 *
 * 					<!-- Remote Participants' Streams -->
 * 					@for (stream of remoteParticipants | tracks; track stream.streamId) {
 * 					<div class="item">
 * 						<ov-stream [stream]="stream"></ov-stream>
 * 					</div>
 * 					}
 * 				</div>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		.container {
 * 			display: flex;
 * 			flex-wrap: wrap;
 * 			justify-content: space-between;
 * 		}
 * 		.item {
 * 			flex: 0 50%;
 * 			height: 250px;
 * 			margin-bottom: 2%;
 * 		}
 * 		.hidden {
 * 			display: none;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent implements OnInit, OnDestroy {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'custom-layout';
 * 	token!: string;
 *
 * 	// Participant-related properties
 * 	localParticipant!: ParticipantModel;
 * 	remoteParticipants!: ParticipantModel[];
 * 	localParticipantSubs!: Subscription;
 * 	remoteParticipantsSubs!: Subscription;
 *
 * 	constructor(
 * 		private httpClient: HttpClient,
 * 		private participantService: ParticipantService
 * 	) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	ngOnInit() {
 * 		// Subscribe to participants' updates
 * 		this.subscribeToParticipants();
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	ngOnDestroy() {
 * 		// Unsubscribe from participant updates to prevent memory leaks
 * 		this.localParticipantSubs.unsubscribe();
 * 		this.remoteParticipantsSubs.unsubscribe();
 * 	}
 *
 * 	// Subscribe to updates for local and remote participants
 * 	subscribeToParticipants() {
 * 		this.localParticipantSubs =
 * 			this.participantService.localParticipant$.subscribe((p) => {
 * 				if (p) this.localParticipant = p;
 * 			});
 *
 * 		this.remoteParticipantsSubs =
 * 			this.participantService.remoteParticipants$.subscribe(
 * 				(participants) => {
 * 					this.remoteParticipants = participants;
 * 				}
 * 			);
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovLayout-end-tutorial-->
 *
 *
 * For a comprehensive guide on implementing custom layouts, please refer to the associated tutorial [here](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-layout/).
 */
@Directive({
	selector: '[ovLayout]',
	standalone: true
})
export class LayoutDirective {
	public template = inject(TemplateRef<any>);
	public container = inject(ViewContainerRef);
}

/**
 * The ***ovStream** directive empowers you to substitute the default {@link StreamComponent} template with a custom one.
 * In the example below, we demonstrate how to customize the position and styles of a participant's nickname by replacing the default stream component.
 *
 * With the **ovStream** directive, you can access the stream object within its context using the `let` keyword and referencing the `stream` variable as follows: `*ovStream="let stream"`. This allows you to access the {@link ParticipantModel} object using `stream.participant`.
 *
 * In the example provided below, we illustrate how to achieve this customization with just a few lines of code.
 *
 * <!--ovStream-start-tutorial-->
 * ```typescript
 * import { HttpClient } from '@angular/common/http';
 * import { Component } from '@angular/core';
 * import { lastValueFrom } from 'rxjs';
 *
 * import {
 * 	OpenViduComponentsModule,
 * 	ApiDirectiveModule,
 * 	OpenViduComponentsDirectiveModule,
 * } from 'openvidu-components-angular';
 *
 * @Component({
 * 	selector: 'app-root',
 * 	template: `
 * 		<!-- OpenVidu Video Conference Component -->
 * 		<ov-videoconference
 * 			[token]="token"
 * 			[livekitUrl]="LIVEKIT_URL"
 * 			(onTokenRequested)="onTokenRequested($event)"
 * 		>
 * 			<!-- Display Video Streams -->
 * 			<div *ovStream="let stream">
 * 				<!-- Video Stream Component -->
 * 				<ov-stream [stream]="stream" [displayParticipantName]="false"></ov-stream>
 *
 * 				<!-- Display Participant's Name -->
 * 				<p>{{ stream.participant.name }}</p>
 * 			</div>
 * 		</ov-videoconference>
 * 	`,
 * 	styles: `
 * 		p {
 * 			position: absolute;
 * 			bottom: 0;
 * 			border: 2px solid;
 * 			background: #000000;
 * 		}
 * 	`,
 * 	standalone: true,
 * 	imports: [OpenViduComponentsModule],
 * })
 * export class AppComponent {
 * 	// For local development, leave these variables empty
 * 	// For production, configure them with correct URLs depending on your deployment
 * 	APPLICATION_SERVER_URL = '';
 * 	LIVEKIT_URL = '';
 *
 * 	// Define the name of the room and initialize the token variable
 * 	roomName = 'custom-stream';
 * 	token!: string;
 *
 * 	constructor(private httpClient: HttpClient) {
 * 		this.configureUrls();
 * 	}
 *
 * 	private configureUrls() {
 * 		// If APPLICATION_SERVER_URL is not configured, use default value from local development
 * 		if (!this.APPLICATION_SERVER_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.APPLICATION_SERVER_URL = 'http://localhost:6080/';
 * 			} else {
 * 				this.APPLICATION_SERVER_URL =
 * 					'https://' + window.location.hostname + ':6443/';
 * 			}
 * 		}
 *
 * 		// If LIVEKIT_URL is not configured, use default value from local development
 * 		if (!this.LIVEKIT_URL) {
 * 			if (window.location.hostname === 'localhost') {
 * 				this.LIVEKIT_URL = 'ws://localhost:7880/';
 * 			} else {
 * 				this.LIVEKIT_URL = 'wss://' + window.location.hostname + ':7443/';
 * 			}
 * 		}
 * 	}
 *
 * 	// Function to request a token when a participant joins the room
 * 	async onTokenRequested(participantName: string) {
 * 		const { token } = await this.getToken(this.roomName, participantName);
 * 		this.token = token;
 * 	}
 *
 * 	// Function to get a token from the server
 * 	getToken(roomName: string, participantName: string): Promise<any> {
 * 		try {
 * 			// Send a POST request to the server to obtain a token
 * 			return lastValueFrom(
 * 				this.httpClient.post<any>(this.APPLICATION_SERVER_URL + 'token', {
 * 					roomName,
 * 					participantName,
 * 				})
 * 			);
 * 		} catch (error: any) {
 * 			// Handle errors, e.g., if the server is not reachable
 * 			if (error.status === 404) {
 * 				throw {
 * 					status: error.status,
 * 					message:
 * 						'Cannot connect with the backend. ' + error.url + ' not found',
 * 				};
 * 			}
 * 			throw error;
 * 		}
 * 	}
 * }
 *
 * ```
 * <!--ovStream-end-tutorial-->
 *
 * For a detailed tutorial on customizing the stream component, please visit [this link](https://openvidu.io/latest/docs/tutorials/angular-components/openvidu-custom-stream/).
 */

@Directive({
	selector: '[ovStream]',
	standalone: true
})
export class StreamDirective {
	public template = inject(TemplateRef<any>);
	public container = inject(ViewContainerRef);
}
