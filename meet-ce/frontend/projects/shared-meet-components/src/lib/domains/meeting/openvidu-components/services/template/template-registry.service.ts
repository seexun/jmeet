import { Injectable, signal, TemplateRef } from '@angular/core';

/**
 * Service that centralizes all TemplateRef instances for the videoconference component tree.
 *
 * Provided at root level so it is available to all components regardless of injection context
 * (including content-projected components whose injector chain doesn't pass through VideoconferenceComponent).
 * All templates are exposed as writable signals — VideoconferenceComponent sets them directly in
 * `setupTemplates()`, and any descendant component can inject this service to read them reactively.
 */
@Injectable({ providedIn: 'root' })
export class TemplateRegistryService {
	// ── Core layout templates ─────────────────────────────────────────────────

	readonly toolbar = signal<TemplateRef<any> | undefined>(undefined);
	readonly panel = signal<TemplateRef<any> | undefined>(undefined);
	readonly layout = signal<TemplateRef<any> | undefined>(undefined);
	readonly stream = signal<TemplateRef<any> | undefined>(undefined);
	readonly preJoin = signal<TemplateRef<any> | undefined>(undefined);

	// ── Panel templates ───────────────────────────────────────────────────────

	readonly chatPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly captionsPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly activitiesPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly participantsPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly additionalPanels = signal<TemplateRef<any> | undefined>(undefined);
	readonly backgroundEffectsPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly settingsPanel = signal<TemplateRef<any> | undefined>(undefined);
	readonly mediaQualityPanel = signal<TemplateRef<any> | undefined>(undefined);

	// ── Participant templates ─────────────────────────────────────────────────

	readonly participantPanelItem = signal<TemplateRef<any> | undefined>(undefined);
	readonly participantPanelItemElements = signal<TemplateRef<any> | undefined>(undefined);
	readonly participantPanelAfterLocalParticipant = signal<TemplateRef<any> | undefined>(undefined);

	// ── Toolbar extension templates ───────────────────────────────────────────

	readonly toolbarAdditionalButtons = signal<TemplateRef<any> | undefined>(undefined);
	readonly toolbarLeaveButton = signal<TemplateRef<any> | undefined>(undefined);
	readonly toolbarAdditionalPanelButtons = signal<TemplateRef<any> | undefined>(undefined);
	readonly toolbarMoreOptionsAdditionalMenuItems = signal<TemplateRef<any> | undefined>(undefined);

	// ── Additional element templates ──────────────────────────────────────────

	readonly layoutAdditionalElements = signal<TemplateRef<any> | undefined>(undefined);
	readonly layoutAdditionalElementsSlot = signal<'top' | 'bottom' | 'default'>('default');
	readonly settingsPanelGeneralAdditionalElements = signal<TemplateRef<any> | undefined>(undefined);
}
